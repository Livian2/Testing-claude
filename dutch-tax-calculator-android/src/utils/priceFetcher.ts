import { API_BASE } from './apiBase';
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
  dividendPerShareEur?: number;  // annual div per share converted to EUR (undefined = accumulating/no div)
  dividendYield?: number;         // decimal (e.g. 0.025 = 2.5%)
  exDivDate?: string | null;      // ISO date YYYY-MM-DD
  divPayDate?: string | null;     // ISO date YYYY-MM-DD
}

export interface FetchResult {
  quotes: Record<string, QuoteData>;  // keyed by ticker symbol
  rates: Record<string, number>;      // currency → EUR rate
  timestamp: string;                  // ISO timestamp
}

interface ChartMeta {
  symbol: string;
  regularMarketPrice: number;
  currency: string;
}

interface DividendInfo {
  divRateLocal: number;  // annual dividend in local exchange currency
  divYield: number;      // decimal
  exDivDate: string | null;
  divPayDate: string | null;
}

interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      summaryDetail?: {
        trailingAnnualDividendRate?: { raw?: number };
        trailingAnnualDividendYield?: { raw?: number };
        dividendRate?: { raw?: number };
        dividendYield?: { raw?: number };
        exDividendDate?: { raw?: number };
      };
      calendarEvents?: {
        exDividendDate?: { raw?: number };
        dividendDate?: { raw?: number };
      };
    }>;
  };
}

/** Fetch a single ticker via the v8/finance/chart endpoint (no crumb needed). */
async function fetchChart(ticker: string): Promise<ChartMeta | null> {
  try {
    const url = `${API_BASE}/api/finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json() as { chart?: { result?: { meta?: ChartMeta }[] } };
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return meta;
  } catch {
    return null;
  }
}

/** Fetch dividend data via the v11/quoteSummary endpoint (no crumb needed). */
async function fetchDividendInfo(ticker: string): Promise<DividendInfo | null> {
  try {
    const url = `${API_BASE}/api/finance/v11/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=summaryDetail%2CcalendarEvents`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json() as QuoteSummaryResponse;
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const sd = result.summaryDetail ?? {};
    const ce = result.calendarEvents ?? {};

    const divRateLocal = sd.dividendRate?.raw ?? sd.trailingAnnualDividendRate?.raw ?? 0;
    const divYield     = sd.dividendYield?.raw ?? sd.trailingAnnualDividendYield?.raw ?? 0;

    if (divRateLocal === 0 && divYield === 0) return null;

    const tsToDate = (ts?: number): string | null =>
      ts ? new Date(ts * 1000).toISOString().split('T')[0] : null;

    const exDivDate = tsToDate(ce.exDividendDate?.raw ?? sd.exDividendDate?.raw);
    const divPayDate = tsToDate(ce.dividendDate?.raw);

    return { divRateLocal, divYield, exDivDate, divPayDate };
  } catch {
    return null;
  }
}

// Preferred exchange suffixes for European investors, in priority order.
// ISIN resolution picks the earliest match so e.g. TDIV resolves to TDIV.AS
// (Euronext Amsterdam) instead of a random US OTC listing.
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
      const url = `${API_BASE}/api/finance/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
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
 * e.g. "TDIV" → "TDIV.AS", "VWRL" → "VWRL.AS"
 */
export async function resolveBareTickers(tickers: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(tickers.filter(t => t && !t.includes('.')))];
  if (unique.length === 0) return {};

  const result: Record<string, string> = {};
  await Promise.all(unique.map(async (ticker) => {
    try {
      const url = `${API_BASE}/api/finance/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const json = await res.json() as { quotes?: { symbol: string; quoteType?: string }[] };
      // Only accept results whose symbol starts with our ticker followed by a dot
      // (avoids false matches like TDIVX for query "TDIV")
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

  // Fetch chart data (prices + FX) and dividend info in parallel
  const allTickers = [...unique, ...FX_TICKERS];
  const [chartResults, divResults] = await Promise.all([
    Promise.all(allTickers.map(t => fetchChart(t))),
    Promise.all(unique.map(t => fetchDividendInfo(t))),
  ]);

  // Build FX rate map: currency → EUR
  const rates: Record<string, number> = { EUR: 1 };
  FX_TICKERS.forEach((fx, i) => {
    const meta = chartResults[unique.length + i];
    if (!meta?.regularMarketPrice) return;
    // "USDEUR=X" → key "USD"
    const key = fx.replace('EUR=X', '');
    if (key && key !== fx) rates[key] = meta.regularMarketPrice;
  });

  // Process stock results → convert prices and dividends to EUR
  const quotes: Record<string, QuoteData> = {};
  unique.forEach((ticker, i) => {
    const meta = chartResults[i];
    if (!meta?.regularMarketPrice) return;

    const price    = meta.regularMarketPrice;
    const currency = meta.currency ?? 'EUR';
    let priceEur   = price;
    let rate       = 1;

    if (currency === 'EUR') {
      rate = 1;
    } else if (currency === 'GBp' || currency === 'GBX') {
      // British pence: 100 GBp = 1 GBP
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

    // Convert dividend rate to EUR using the same FX rate as the price
    const div = divResults[i];
    let dividendPerShareEur: number | undefined;
    let dividendYield: number | undefined;
    let exDivDate: string | null | undefined;
    let divPayDate: string | null | undefined;

    if (div) {
      dividendYield       = div.divYield;
      exDivDate           = div.exDivDate;
      divPayDate          = div.divPayDate;
      dividendPerShareEur = div.divRateLocal * rate;
    }

    quotes[ticker] = { priceEur, priceLocal: price, currency, rate, dividendPerShareEur, dividendYield, exDivDate, divPayDate };
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
