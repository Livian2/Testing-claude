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

// The v8 chart meta includes dividend fields alongside price data
interface ChartMeta {
  symbol: string;
  regularMarketPrice: number;
  currency: string;
  // Dividend fields (present for distributing equities/ETFs)
  dividendRate?: number;
  dividendYield?: number;
  trailingAnnualDividendRate?: number;
  trailingAnnualDividendYield?: number;
}

interface QuoteSummaryResult {
  exDivDate: string | null;
  divPayDate: string | null;
  country: string | null;
}

/** Fetch a single ticker via the v8/finance/chart endpoint (no crumb needed). */
async function fetchChart(ticker: string): Promise<ChartMeta | null> {
  try {
    const url = `/api/finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;
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

/**
 * Fetch ex-div date, pay date and country via quoteSummary.
 * Tries v11 first, falls back gracefully. Dividend rate is taken from chart meta.
 */
async function fetchQuoteSummary(ticker: string): Promise<QuoteSummaryResult | null> {
  const tryFetch = async (base: string): Promise<QuoteSummaryResult | null> => {
    try {
      const url = `${base}${encodeURIComponent(ticker)}?modules=summaryDetail%2CcalendarEvents%2CassetProfile&formatted=false`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const json = await res.json() as {
        quoteSummary?: {
          result?: Array<{
            summaryDetail?: {
              exDividendDate?: { raw?: number } | number;
            };
            calendarEvents?: {
              exDividendDate?: { raw?: number } | number;
              dividendDate?: { raw?: number } | number;
            };
            assetProfile?: { country?: string };
          }>;
        };
      };
      const r = json?.quoteSummary?.result?.[0];
      if (!r) return null;

      const sd = r.summaryDetail ?? {};
      const ce = r.calendarEvents ?? {};
      const ap = r.assetProfile ?? {};

      const tsToDate = (v?: { raw?: number } | number): string | null => {
        const ts = typeof v === 'number' ? v : v?.raw;
        return ts ? new Date(ts * 1000).toISOString().split('T')[0] : null;
      };

      const exDivDate  = tsToDate(ce.exDividendDate ?? sd.exDividendDate);
      const divPayDate = tsToDate(ce.dividendDate);
      const country    = ap.country ?? null;

      return { exDivDate, divPayDate, country };
    } catch {
      return null;
    }
  };

  return (
    (await tryFetch('/api/finance/v11/finance/quoteSummary/')) ??
    (await tryFetch('/api/finance/v10/finance/quoteSummary/'))
  );
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

  // Fetch chart (price + dividend from meta) and quoteSummary (dates + country) in parallel
  const allTickers = [...unique, ...FX_TICKERS];
  const [chartResults, summaryResults] = await Promise.all([
    Promise.all(allTickers.map(t => fetchChart(t))),
    Promise.all(unique.map(t => fetchQuoteSummary(t))),
  ]);

  // Build FX rate map: currency → EUR
  const rates: Record<string, number> = { EUR: 1 };
  FX_TICKERS.forEach((fx, i) => {
    const meta = chartResults[unique.length + i];
    if (!meta?.regularMarketPrice) return;
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

    // Dividend: prefer forward rate, fall back to trailing (both from chart meta)
    const divRateLocal = meta.dividendRate ?? meta.trailingAnnualDividendRate ?? 0;
    const divYield     = meta.dividendYield ?? meta.trailingAnnualDividendYield ?? 0;

    let dividendPerShareEur: number | undefined;
    let dividendYieldOut: number | undefined;

    if (divRateLocal > 0 || divYield > 0) {
      dividendYieldOut     = divYield || undefined;
      dividendPerShareEur  = divRateLocal > 0 ? divRateLocal * rate : undefined;
    }

    const summary = summaryResults[i];

    quotes[ticker] = {
      priceEur,
      priceLocal: price,
      currency,
      rate,
      dividendPerShareEur,
      dividendYield: dividendYieldOut,
      exDivDate:  summary?.exDivDate  ?? null,
      divPayDate: summary?.divPayDate ?? null,
      country:    summary?.country    ?? undefined,
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
