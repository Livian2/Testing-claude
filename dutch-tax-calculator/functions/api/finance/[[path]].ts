const YAHOO_BASE = 'https://query2.finance.yahoo.com';
const FC_URL     = 'https://fc.yahoo.com/';
const CRUMB_URL  = 'https://query2.finance.yahoo.com/v1/test/getcrumb';

// Cached in Cloudflare's Cache API (persists across Worker invocations within a PoP)
const CRUMB_CACHE_KEY = 'https://internal.invalid/yahoo-crumb-v1';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

interface CrumbData {
  crumb:  string;
  cookie: string;
}

interface PagesContext {
  request: Request;
  params: Record<string, string | string[]>;
}

/** Extract all Set-Cookie values from a Response into a single cookie string. */
function extractCookies(response: Response): string {
  // Cloudflare Workers expose getAll() as a non-standard extension for Set-Cookie.
  const all: string[] =
    typeof (response.headers as unknown as Record<string, unknown>).getAll === 'function'
      ? (response.headers as unknown as { getAll(k: string): string[] }).getAll('set-cookie')
      : [response.headers.get('set-cookie') ?? ''];

  return all
    .flatMap(h => h.split(/,(?=[^;]+=[^;]+)/))   // handle comma-folded values
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/** Fetch a fresh Yahoo Finance crumb (requires their consent cookie). */
async function fetchFreshCrumb(): Promise<CrumbData | null> {
  try {
    // Step 1 – hit fc.yahoo.com to get the A3 / consent cookie
    const fcRes = await fetch(FC_URL, { headers: BROWSER_HEADERS, redirect: 'follow' });
    const cookie = extractCookies(fcRes);
    if (!cookie) return null;

    // Step 2 – exchange the cookie for a crumb token
    const crumbRes = await fetch(CRUMB_URL, {
      headers: { ...BROWSER_HEADERS, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    // Guard against HTML error pages being returned as the crumb body
    if (!crumb || crumb.startsWith('<') || crumb.length > 30) return null;

    return { crumb, cookie };
  } catch {
    return null;
  }
}

/**
 * Return a cached crumb, or fetch a new one and cache it for 25 minutes.
 * Uses Cloudflare's default cache so the crumb is reused across warm Worker invocations.
 */
async function getCrumb(): Promise<CrumbData | null> {
  const cache    = caches.default;
  const cacheReq = new Request(CRUMB_CACHE_KEY);

  const hit = await cache.match(cacheReq);
  if (hit) {
    try { return await hit.json() as CrumbData; } catch { /* stale */ }
  }

  const data = await fetchFreshCrumb();
  if (!data) return null;

  await cache.put(
    cacheReq,
    new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=1500',   // 25 min; Yahoo crumbs last ~1 h
      },
    }),
  );

  return data;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, params } = context;

  // Pre-flight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
  }

  const pathSegments = Array.isArray(params.path) ? params.path : [params.path ?? ''];
  const yahooPath    = '/' + pathSegments.join('/');
  const incomingUrl  = new URL(request.url);
  const targetUrl    = new URL(`${YAHOO_BASE}${yahooPath}${incomingUrl.search}`);

  // Attempt 1 – no crumb (works for chart/v8 endpoints)
  let yahooRes = await fetch(targetUrl.toString(), {
    method: 'GET',
    headers: BROWSER_HEADERS,
  }).catch(() => null);

  // Attempt 2 – retry with a crumb when the first attempt is rejected
  if (!yahooRes || yahooRes.status === 401 || yahooRes.status === 403) {
    const auth = await getCrumb();
    if (auth) {
      const retryUrl = new URL(targetUrl.toString());
      retryUrl.searchParams.set('crumb', auth.crumb);
      yahooRes = await fetch(retryUrl.toString(), {
        method: 'GET',
        headers: { ...BROWSER_HEADERS, Cookie: auth.cookie },
      }).catch(() => null);
    }
  }

  if (!yahooRes) {
    return new Response(
      JSON.stringify({ error: 'upstream fetch failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }

  const contentType = yahooRes.headers.get('Content-Type') ?? 'application/json';
  const body        = await yahooRes.arrayBuffer();

  return new Response(body, {
    status: yahooRes.status,
    headers: {
      'Content-Type': contentType,
      ...CORS_HEADERS,
      'Cache-Control': yahooRes.ok ? 'public, max-age=60, s-maxage=60' : 'no-store',
    },
  });
}
