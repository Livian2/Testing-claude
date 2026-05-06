/**
 * Fetches current market prices from Yahoo Finance via the Vite dev proxy.
 * Proxy is configured in vite.config.ts → server.proxy['/api/finance'].
 * Works in development only; production deployments need a backend proxy.
 */
export async function fetchYahooPrices(
  tickers: string[],
): Promise<Record<string, number>> {
  const filtered = [...new Set(tickers.filter(Boolean))];
  if (filtered.length === 0) return {};

  const symbols = filtered.map(encodeURIComponent).join(',');
  const url = `/api/finance/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,currency,shortName`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`Yahoo Finance responded with ${res.status}`);

  const data = await res.json();
  const results: Record<string, number> = {};

  for (const quote of data?.quoteResponse?.result ?? []) {
    if (typeof quote.regularMarketPrice === 'number') {
      results[quote.symbol] = quote.regularMarketPrice;
    }
  }
  return results;
}
