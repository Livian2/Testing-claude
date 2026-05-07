/**
 * Fetches live market prices from Yahoo Finance via the Vite dev-server proxy
 * (configured in vite.config.ts). Works in development only.
 *
 * All returned prices are converted to EUR using live FX rates fetched
 * in the same call. GBp (British pence) is handled automatically.
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
}

export interface FetchResult {
  quotes: Record<string, QuoteData>;  // keyed by ticker symbol
  rates: Record<string, number>;      // currency → EUR rate
  timestamp: string;                  // ISO timestamp
}

/** Resolve ISIN codes to Yahoo Finance ticker symbols via the search endpoint. */
export async function resolveIsins(isins: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(isins.filter(Boolean))];
  if (unique.length === 0) return {};

  const result: Record<string, string> = {};
  await Promise.all(unique.map(async (isin) => {
    try {
      const url = `/api/finance/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=3&newsCount=0&enableFuzzyQuery=false`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const json = await res.json() as { finance?: { result?: { quotes?: { symbol: string; quoteType?: string }[] }[] } };
      const quotes = json?.finance?.result?.[0]?.quotes ?? [];
      // Prefer ETF or EQUITY quotes, take the first match
      const match = quotes.find(q => q.quoteType === 'ETF' || q.quoteType === 'EQUITY') ?? quotes[0];
      if (match?.symbol) result[isin] = match.symbol;
    } catch { /* ignore per-ISIN failures */ }
  }));
  return result;
}

/** Returns true if the string looks like an ISIN (2 letters + 10 alphanumeric). */
export function looksLikeIsin(s: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(s.trim().toUpperCase());
}

async function callYahoo(tickers: string[]): Promise<Record<string, unknown>[]> {
  const symbols = tickers.map(encodeURIComponent).join(',');
  const url = `/api/finance/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,currency,shortName,quoteType`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Yahoo Finance: HTTP ${res.status}`);
  const json = await res.json();
  return (json as { quoteResponse?: { result?: Record<string, unknown>[] } })?.quoteResponse?.result ?? [];
}

export async function fetchPricesWithFX(tickers: string[]): Promise<FetchResult> {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return { quotes: {}, rates: { EUR: 1 }, timestamp: new Date().toISOString() };

  // Fetch stock quotes + FX rates in parallel
  const [stockRows, fxRows] = await Promise.all([
    callYahoo(unique),
    callYahoo(FX_TICKERS),
  ]);

  // Build FX rate map: currency → EUR (e.g. USD → 0.923)
  const rates: Record<string, number> = { EUR: 1 };
  for (const q of fxRows) {
    const sym   = q.symbol as string ?? '';
    const price = q.regularMarketPrice as number;
    if (!sym || typeof price !== 'number') continue;
    // "USDEUR=X" → currency key "USD"
    const key = sym.replace('EUR=X', '');
    if (key && key !== sym) rates[key] = price;
  }

  // Process stock rows → convert to EUR
  const quotes: Record<string, QuoteData> = {};
  for (const q of stockRows) {
    const sym   = q.symbol as string ?? '';
    const price = q.regularMarketPrice as number;
    if (!sym || typeof price !== 'number') continue;

    const currency = (q.currency as string) ?? 'EUR';
    let priceEur = price;
    let rate     = 1;

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
      // if no FX rate found, keep priceEur === price (fallback, will show currency warning)
    }

    quotes[sym] = { priceEur, priceLocal: price, currency, rate };
  }

  return { quotes, rates, timestamp: new Date().toISOString() };
}

/** Backward-compat wrapper: returns only the EUR prices. */
export async function fetchYahooPrices(tickers: string[]): Promise<Record<string, number>> {
  const result = await fetchPricesWithFX(tickers);
  return Object.fromEntries(
    Object.entries(result.quotes).map(([k, v]) => [k, v.priceEur])
  );
}
