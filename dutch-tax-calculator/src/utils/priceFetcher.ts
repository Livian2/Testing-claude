/**
 * Fetches live market prices from Yahoo Finance via the Vite dev-server proxy
 * (configured in vite.config.ts). Works in development only.
 *
 * Uses the v8/finance/chart endpoint (one request per symbol) which does not
 * require a CSRF crumb, unlike the v7/finance/quote batch endpoint.
 *
 * All returned prices are converted to EUR using live FX rates fetched
 * in the same batch. GBp (British pence) is handled automatically.
 */

// Common FX pairs to fetch alongside stock quotes (→ EUR)
const FX_TICKERS = [
  'USDEUR=X',  // US Dollar → EUR
  'GBPEUR=X',  // British Pound → EUR
  'CHFEUR=X',  // Swiss Franc → EUR
  'SEKEUR=X',  // Swedish Krona → EUR
  'NOKEUR=X',  // Norwegian Krone → EUR
  'DKKEUR=X',  // Danish Krone → EUR
  'JPYEUR=X',  // Japanese Yen → EUR
  'CADEUR=X',  // Canadian Dollar → EUR
  'AUDEUR=X',  // Australian Dollar → EUR
];

export interface QuoteData {
  priceEur: number;        // EUR-equivalent (what to store in currentPrice)
  priceLocal: number;      // original exchange price
  currency: string;        // e.g. "USD", "GBp", "EUR"
  rate: number;            // 1 local unit = rate EUR (1.0 for EUR)
  dividendPerShareEur?: number;  // annual div per share converted to EUR (undefined = no div)
  dividendYield?: number;        // decimal (e.g. 0.025 = 2.5%)
  exDivDate?: string | null;     // ISO date YYYY-MM-DD
  divPayDate?: string | null;    // ISO date YYYY-MM-DD
  country?: string;              // company/ETF domicile from assetProfile
}

export interface FetchResult {
  quotes: Record<string, QuoteData>;  // keyed by ticker symbol
  rates: Record<string, number>;      // currency → EUR rate
  timestamp: string;                  // ISO timestamp
}

// The v8 chart meta includes price data; dividend fields are unreliable here
interface ChartMeta {
  symbol: string;
  regularMarketPrice: number;
  currency: string;
}

interface ChartResult {
  meta: ChartMeta;
  annualDivPerShare: number;  // sum of dividend events in past 12 months (local currency)
}

interface QuoteSummaryResult {
  exDivDate: string | null;
  divPayDate: string | null;
  country: string | null;
}

/**
 * Fetch price + (optionally) dividend event history via v8/chart.
 * withDivs=true fetches 1y of quarterly data with dividend events.
 */
async function fetchChart(ticker: string, withDivs: boolean = false): Promise<ChartResult | null> {
  try {
    const range    = withDivs ? '1y'  : '1d';
    const interval = withDivs ? '3mo' : '1d';
    const events   = withDivs ? '&events=div' : '';
    const url = `/api/finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false${events}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: ChartMeta;
          events?: { dividends?: Record<string, { amount: number; date: number }> };
        }>;
      };
    };
    const result = json?.chart?.result?.[0];
    const meta   = result?.meta;
    if (!meta?.regularMarketPrice) return null;

    // Sum actual dividend payments from the last 12 months
    const divEvents = result?.events?.dividends ?? {};
    const cutoff    = Date.now() / 1000 - 365 * 24 * 3600;
    const annualDivPerShare = Object.values(divEvents)
      .filter(d => d.date >= cutoff)
      .reduce((sum, d) => sum + (d.amount ?? 0), 0);

    return { meta, annualDivPerShare };
  } catch {
    return null;
  }
}

// Maps exchange suffix to country name (fallback when assetProfile unavailable)
const SUFFIX_COUNTRY: Record<string, string> = {
  '.AS': 'Netherlands', '.PA': 'France',      '.DE': 'Germany',
  '.MI': 'Italy',       '.MC': 'Spain',        '.L':  'United Kingdom',
  '.BR': 'Belgium',     '.LS': 'Portugal',     '.ST': 'Sweden',
  '.CO': 'Denmark',     '.OL': 'Norway',       '.HE': 'Finland',
  '.VX': 'Switzerland', '.VI': 'Austria',      '.WA': 'Poland',
  '.PR': 'Czech Republic',
};

/** Infer country from a ticker's exchange suffix. Returns null if no suffix known. */
function countryFromSuffix(ticker: string): string | null {
  for (const [sfx, country] of Object.entries(SUFFIX_COUNTRY)) {
    if (ticker.endsWith(sfx)) return country;
  }
  // No dot = US market
  if (!ticker.includes('.')) return 'United States';
  return null;
}

type RawNum = { raw?: number } | number | null | undefined;
type RawStr = { raw?: string } | string | null | undefined;

const tsToDate = (v: RawNum): string | null => {
  const ts = typeof v === 'number' ? v : (v as { raw?: number })?.raw;
  return ts ? new Date(ts * 1000).toISOString().split('T')[0] : null;
};
const toStr = (v: RawStr): string | null => {
  if (v == null) return null;
  return typeof v === 'string' ? v : (v as { raw?: string }).raw ?? null;
};

/**
 * Fetch dividend data + country via quoteSummary.
 * Tries v10 on query2, then v10 on query1, with a summaryDetail-only fallback.
 * Country falls back to exchange-suffix inference if assetProfile is unavailable.
 */
async function fetchQuoteSummary(ticker: string): Promise<QuoteSummaryResult | null> {
  const BASES = [
    '/api/finance/v10/finance/quoteSummary/',
    '/api/finance2/v10/finance/quoteSummary/',
    '/api/finance/v11/finance/quoteSummary/',
  ];
  const MODULE_SETS = [
    'summaryDetail%2CcalendarEvents%2CassetProfile',
    'summaryDetail%2CcalendarEvents',
    'summaryDetail',
  ];

  for (const base of BASES) {
    for (const modules of MODULE_SETS) {
      try {
        const url = `${base}${encodeURIComponent(ticker)}?modules=${modules}&formatted=false&lang=en-US&region=US`;
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (!res.ok) continue;
        const json = await res.json() as {
          quoteSummary?: {
            result?: Array<{
              summaryDetail?: { exDividendDate?: RawNum };
              calendarEvents?: { exDividendDate?: RawNum; dividendDate?: RawNum };
              assetProfile?: { country?: RawStr };
            }>;
            error?: unknown;
          };
        };
        if (json?.quoteSummary?.error) continue;
        const r = json?.quoteSummary?.result?.[0];
        if (!r) continue;

        const sd = r.summaryDetail  ?? {};
        const ce = r.calendarEvents ?? {};
        const ap = r.assetProfile   ?? {};

        const exDivDate  = tsToDate(ce.exDividendDate ?? sd.exDividendDate);
        const divPayDate = tsToDate(ce.dividendDate);
        const country    = toStr(ap.country) ?? countryFromSuffix(ticker);

        return { exDivDate, divPayDate, country };
      } catch {
        continue;
      }
    }
  }

  // All endpoints failed: at least provide exchange-inferred country
  return { exDivDate: null, divPayDate: null, country: countryFromSuffix(ticker) };
}

// Preferred exchange suffixes for European investors, in priority order.
const EXCHANGE_PRIORITY = [
  '.AS',  // Euronext Amsterdam
  '.L',   // London Stock Exchange
  '.PA',  // Euronext Paris
  '.DE',  // Xetra Frankfurt
  '.MI',  // Borsa Italiana
  '.MC',  // Bolsa Madrid
  '.BR',  // Euronext Brussels
  '.LS',  // Euronext Lisbon
  '.ST',  // Nasdaq Stockholm
  '.CO',  // Nasdaq Copenhagen
  '.OL',  // Oslo Børs
  '.HE',  // Nasdaq Helsinki
];

function exchangeScore(symbol: string): number {
  const idx = EXCHANGE_PRIORITY.findIndex(sfx => symbol.endsWith(sfx));
  return idx === -1 ? EXCHANGE_PRIORITY.length : idx;
}

/** Resolve ISIN codes to Yahoo Finance ticker symbols via the search endpoint. */
export async function resolveIsins(isins: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(isins.filter(Boolean))];
  if (unique.length === 0) return {};

  const result: Record<string, string> = {};
  await Promise.all(unique.map(async (isin) => {
    try {
      const url = `/api/finance/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const json = await res.json() as {
        quotes?: { symbol: string; quoteType?: string }[];
      };
      const quotes = (json?.quotes ?? [])
        .filter(q => q.quoteType === 'ETF' || q.quoteType === 'EQUITY');
      if (quotes.length === 0) return;
      quotes.sort((a, b) => exchangeScore(a.symbol) - exchangeScore(b.symbol));
      result[isin] = quotes[0].symbol;
    } catch { /* ignore per-ISIN failures */ }
  }));
  return result;
}

/**
 * Resolve bare ticker symbols (no exchange suffix) to exchange-specific Yahoo Finance
 * symbols via the search endpoint, using European exchange priority.
 */
export async function resolveBareTickers(tickers: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(tickers.filter(t => t && !t.includes('.')))];
  if (unique.length === 0) return {};

  const result: Record<string, string> = {};
  await Promise.all(unique.map(async (ticker) => {
    try {
      const url = `/api/finance/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const json = await res.json() as { quotes?: { symbol: string; quoteType?: string }[] };
      const quotes = (json?.quotes ?? [])
        .filter(q => q.quoteType === 'ETF' || q.quoteType === 'EQUITY')
        .filter(q => q.symbol === ticker || q.symbol.startsWith(ticker + '.'));
      if (quotes.length === 0) return;
      quotes.sort((a, b) => exchangeScore(a.symbol) - exchangeScore(b.symbol));
      const best = quotes[0];
      if (best.symbol.includes('.')) {
        result[ticker] = best.symbol;
      }
    } catch { /* ignore per-ticker failures */ }
  }));
  return result;
}

/** Returns true if the string looks like an ISIN (2 letters + 10 alphanumeric). */
export function looksLikeIsin(s: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(s.trim().toUpperCase());
}

export async function fetchPricesWithFX(tickers: string[]): Promise<FetchResult> {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return { quotes: {}, rates: { EUR: 1 }, timestamp: new Date().toISOString() };

  // Stock tickers: fetch 1y chart with dividend events + quoteSummary (country/dates)
  // FX tickers: fetch 1d chart only (no dividends needed)
  const [stockCharts, fxCharts, summaryResults] = await Promise.all([
    Promise.all(unique.map(t => fetchChart(t, true))),
    Promise.all(FX_TICKERS.map(t => fetchChart(t, false))),
    Promise.all(unique.map(t => fetchQuoteSummary(t))),
  ]);

  // Build FX rate map: currency → EUR
  const rates: Record<string, number> = { EUR: 1 };
  FX_TICKERS.forEach((fx, i) => {
    const cr = fxCharts[i];
    if (!cr?.meta.regularMarketPrice) return;
    const key = fx.replace('EUR=X', '');
    if (key && key !== fx) rates[key] = cr.meta.regularMarketPrice;
  });

  // Process stock results → convert prices and dividends to EUR
  const quotes: Record<string, QuoteData> = {};
  unique.forEach((ticker, i) => {
    const cr = stockCharts[i];
    if (!cr?.meta.regularMarketPrice) return;

    const price    = cr.meta.regularMarketPrice;
    const currency = cr.meta.currency ?? 'EUR';
    let priceEur   = price;
    let rate       = 1;

    if (currency === 'EUR') {
      rate = 1;
    } else if (currency === 'GBp' || currency === 'GBX') {
      const gbpRate = rates['GBP'] ?? 1;
      rate     = gbpRate / 100;
      priceEur = price * rate;
    } else {
      const r = rates[currency];
      if (r !== undefined) {
        rate     = r;
        priceEur = price * r;
      }
    }

    const summary = summaryResults[i];

    // Dividend: use actual payment history from chart events (most reliable).
    // annualDivPerShare is the sum of all dividend payments in the last 12 months
    // in local currency. Convert to EUR using the same rate as the price.
    const annualDivLocal = cr.annualDivPerShare;
    const dividendPerShareEur = annualDivLocal > 0 ? annualDivLocal * rate : undefined;
    const dividendYieldOut    = (annualDivLocal > 0 && priceEur > 0)
      ? annualDivLocal * rate / priceEur
      : undefined;

    quotes[ticker] = {
      priceEur,
      priceLocal: price,
      currency,
      rate,
      dividendPerShareEur,
      dividendYield: dividendYieldOut,
      exDivDate:  summary?.exDivDate  ?? null,
      divPayDate: summary?.divPayDate ?? null,
      country:    summary?.country    ?? countryFromSuffix(ticker) ?? undefined,
    };
  });

  return { quotes, rates, timestamp: new Date().toISOString() };
}

/** Backward-compat wrapper: returns only the EUR prices. */
export async function fetchYahooPrices(tickers: string[]): Promise<Record<string, number>> {
  const result = await fetchPricesWithFX(tickers);
  return Object.fromEntries(
    Object.entries(result.quotes).map(([k, v]) => [k, v.priceEur])
  );
}
