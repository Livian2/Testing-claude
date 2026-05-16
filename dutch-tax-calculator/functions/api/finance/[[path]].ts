const YAHOO_BASE = 'https://query2.finance.yahoo.com';

const FORWARD_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

export const onRequest: PagesFunction = async (context) => {
  const { request, params } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept, Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // params.path is an array of path segments after /api/finance/
  const pathSegments = Array.isArray(params.path) ? params.path : [params.path ?? ''];
  const yahoPath = '/' + pathSegments.join('/');

  const incomingUrl = new URL(request.url);
  const targetUrl = `${YAHOO_BASE}${yahoPath}${incomingUrl.search}`;

  let yahooResponse: Response;
  try {
    yahooResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: FORWARD_HEADERS,
      // Cloudflare Workers do not support keepalive in fetch options
      cf: { cacheEverything: false },
    } as RequestInit & { cf?: Record<string, unknown> });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'upstream fetch failed', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const contentType = yahooResponse.headers.get('Content-Type') ?? 'application/json';
  const body = await yahooResponse.arrayBuffer();

  return new Response(body, {
    status: yahooResponse.status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      // Cache successful price responses for 60 s at the edge to reduce Yahoo rate-limit risk
      'Cache-Control': yahooResponse.ok ? 'public, max-age=60, s-maxage=60' : 'no-store',
    },
  });
};
