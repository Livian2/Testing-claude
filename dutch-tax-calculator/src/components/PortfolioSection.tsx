import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import {
  TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle,
  LayoutList, RefreshCw, AlertCircle, CheckCircle2, FileUp, Clock, Globe, Layers,
  ChevronUp, ChevronDown, ChevronsUpDown, Search, Building2,
} from 'lucide-react';
import type { PortfolioData, Holding, Transaction, AssetType, TransactionType } from '../types';
import { computePositions } from '../utils/taxCalculations';
import { fetchPricesWithFX, resolveIsins, resolveBareTickers, looksLikeIsin, fetchEtfHoldings, countryFromSuffix } from '../utils/priceFetcher';
import type { EtfHoldingsResult } from '../utils/priceFetcher';
import { useLanguage } from '../i18n/LanguageContext';
import SectionCard from './SectionCard';
import PieChart from './PieChart';
// Lazy: only rendered when the Import inner tab is selected
const CsvImportPanel = lazy(() => import('./CsvImportPanel'));

interface Props {
  data: PortfolioData;
  onChange: (d: PortfolioData) => void;
}

export const ASSET_COLORS: Record<AssetType, string> = {
  savings:    '#10b981',
  stocks:     '#3b82f6',
  etf:        '#6366f1',
  bonds:      '#f59e0b',
  realEstate: '#ef4444',
  crypto:     '#8b5cf6',
  other:      '#64748b',
};

function uid() { return Math.random().toString(36).slice(2); }

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type InnerTab = 'holdings' | 'transactions' | 'import' | 'overview' | 'analyse';
type FetchState = 'idle' | 'loading' | 'ok' | 'error';
type SortCol = 'name' | 'qty' | 'marketValue' | 'gainPct' | 'gainAbs' | 'dividend';

const fmtDate = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

const isPast = (iso: string): boolean => new Date(iso + 'T00:00:00') < new Date();

// Cache one Intl.NumberFormat per currency — creating them is expensive and
// fmtLocal is called once per holding row on every render.
const localFmtCache = new Map<string, Intl.NumberFormat>();
const fmtLocal = (price: number, currency: string) => {
  if (currency === 'GBp' || currency === 'GBX') {
    return `${(price).toFixed(2)} GBp`;
  }
  try {
    let fmt = localFmtCache.get(currency);
    if (!fmt) {
      fmt = new Intl.NumberFormat('nl-NL', {
        style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
      localFmtCache.set(currency, fmt);
    }
    return fmt.format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
};

interface SearchResultItem {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
}

interface AutocItem {
  symbol: string;
  name: string;
  exch: string;
  type: string;
  exchDisp: string;
  typeDisp: string;
}

interface FondsSearchProps {
  value: string;
  holdings: Holding[];
  onChange: (name: string, ticker?: string) => void;
}

function FondsSearch({ value, holdings, onChange }: FondsSearchProps) {
  const { t } = useLanguage();
  const [query, setQuery]     = useState(value);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef            = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (raw: string) => {
    setQuery(raw);
    onChange(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (raw.length < 2) { setResults([]); setOpen(false); return; }

    // Open immediately so the loading spinner is visible while debouncing
    setOpen(true);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const upper = raw.trim().toUpperCase();
        const isExactTicker = /^[A-Z0-9]{1,12}(=[A-Z]{1,2})?(\.[A-Z]{1,3})?$/.test(upper);
        // If query looks like an exact ticker (especially futures like GC=F), go straight to
        // Layer 3 so Layer 1/2 text-search results don't shadow the correct match.
        const skipTextSearch = isExactTicker && (upper.includes('=') || upper.includes('.'));

        if (!skipTextSearch) {
          // Layer 1: Yahoo Finance search API (crumb handled server-side)
          try {
            const res = await fetch(
              `/api/finance/v1/finance/search?q=${encodeURIComponent(raw)}&quotesCount=15&newsCount=0&enableFuzzyQuery=false`,
              { headers: { Accept: 'application/json' } }
            );
            if (res.ok) {
              const json = await res.json() as { quotes?: SearchResultItem[] };
              const found = (json.quotes ?? []).filter(q =>
                q.quoteType === 'ETF' || q.quoteType === 'EQUITY' ||
                q.quoteType === 'MUTUALFUND' || q.quoteType === 'FUTURE'
              );
              if (found.length > 0) { setResults(found); return; }
            }
          } catch { /* fall through */ }

          // Layer 2: autoc endpoint (no auth needed, supports text like "vanguard")
          try {
            const autcRes = await fetch(
              `/api/finance/autoc?query=${encodeURIComponent(raw)}&region=1&lang=en`,
              { headers: { Accept: 'application/json' } }
            );
            if (autcRes.ok) {
              const autcJson = await autcRes.json() as { ResultSet?: { Result?: AutocItem[] } };
              const found = (autcJson.ResultSet?.Result ?? [])
                .filter(r => r.type === 'ETF' || r.type === 'S' || r.type === 'M' || r.type === 'F')
                .map(r => ({
                  symbol: r.symbol,
                  shortname: r.name,
                  quoteType: r.type === 'ETF' ? 'ETF' : r.type === 'M' ? 'MUTUALFUND' : r.type === 'F' ? 'FUTURE' : 'EQUITY',
                  exchDisp: r.exchDisp,
                } as SearchResultItem));
              if (found.length > 0) { setResults(found); return; }
            }
          } catch { /* fall through */ }
        }

        // Layer 3: exact ticker probe via v8/chart (no auth, ticker-pattern only)
        if (isExactTicker) {
          const suffixes = (upper.includes('.') || upper.includes('='))
            ? ['']
            : ['', '.AS', '.L', '.DE', '.PA', '.MI', '.F'];
          const hits = (
            await Promise.all(suffixes.map(async sfx => {
              const ticker = upper + sfx;
              try {
                const r = await fetch(
                  `/api/finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`,
                  { headers: { Accept: 'application/json' } }
                );
                if (!r.ok) return null;
                const d = await r.json() as { chart?: { result?: { meta?: { symbol: string; longName?: string; quoteType?: string; exchangeName?: string } }[] } };
                const meta = d?.chart?.result?.[0]?.meta;
                if (!meta?.symbol) return null;
                return {
                  symbol: meta.symbol,
                  shortname: meta.longName ?? meta.symbol,
                  quoteType: meta.quoteType ?? 'EQUITY',
                  exchDisp: meta.exchangeName,
                } as SearchResultItem;
              } catch { return null; }
            }))
          ).filter((r): r is SearchResultItem => r !== null);
          setResults(hits);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }, 400);
  };

  const existingMatches = holdings.filter(h =>
    query.length >= 2 &&
    (h.name.toLowerCase().includes(query.toLowerCase()) ||
     h.ticker.toLowerCase().includes(query.toLowerCase()))
  );

  const hasDropdown = open && (existingMatches.length > 0 || results.length > 0 || loading);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
        placeholder={t.portfolioExtra.searchPlaceholder}
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">…</span>
      )}
      {hasDropdown && (
        <div className="absolute top-full left-0 mt-1 z-[9999] w-full min-w-[260px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl text-xs overflow-y-auto max-h-64">
          {existingMatches.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-200 dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-800">{t.portfolioExtra.ownPositions}</div>
              {existingMatches.map(h => (
                <button
                  key={h.id}
                  onMouseDown={e => { e.preventDefault(); onChange(h.name, h.ticker); setQuery(h.name); setOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-0 bg-transparent flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{h.name}</span>
                  {h.ticker && <span className="font-mono text-slate-400">{h.ticker}</span>}
                </button>
              ))}
            </>
          )}
          {results.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-200 dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-800">Yahoo Finance</div>
              {results.map(r => (
                <button
                  key={r.symbol}
                  onMouseDown={e => {
                    e.preventDefault();
                    const name = r.shortname || r.longname || r.symbol;
                    onChange(name, r.symbol);
                    setQuery(name);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-0 bg-transparent flex items-center justify-between gap-2"
                >
                  <span className="text-slate-700 dark:text-slate-200 truncate">{r.shortname || r.longname || r.symbol}</span>
                  <span className="text-slate-400 font-mono shrink-0 ml-2">{r.symbol}{r.exchDisp ? ` · ${r.exchDisp}` : ''}</span>
                </button>
              ))}
            </>
          )}
          {loading && results.length === 0 && existingMatches.length === 0 && (
            <div className="px-3 py-3 text-slate-400 text-center">{t.portfolioExtra.searching}</div>
          )}
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, col, sortCol, sortDir, onSort, align }: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc';
  onSort: (col: SortCol) => void; align: 'left' | 'right';
}) {
  const active = sortCol === col;
  const Icon = active ? (sortDir === 'desc' ? ChevronDown : ChevronUp) : ChevronsUpDown;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0 font-medium transition-colors
        ${align === 'right' ? 'flex-row-reverse ml-auto' : ''}
        ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
    >
      {label}
      <Icon size={11} className={active ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'} />
    </button>
  );
}

export default function PortfolioSection({ data, onChange }: Props) {
  const { t } = useLanguage();
  const [tab, setTab]               = useState<InnerTab>('holdings');
  const [txType, setTxType]         = useState<TransactionType>('buy');
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchMsg, setFetchMsg]     = useState('');
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [fxRates, setFxRates]            = useState<Record<string, number>>({});
  const [sortCol, setSortCol]       = useState<SortCol>('marketValue');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const autoFetched = useRef(false);
  const [etfHoldings, setEtfHoldings] = useState<Record<string, EtfHoldingsResult>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dutch-tax-etf-holdings-v2') || '{}') as Record<string, EtfHoldingsResult>;
      // Discard entries with empty holdings arrays (stale cache from before the parsing fix)
      return Object.fromEntries(Object.entries(stored).filter(([, v]) => v.holdings?.length > 0));
    } catch { return {}; }
  });
  const [etfFetchState, setEtfFetchState] = useState<FetchState>('idle');
  const [etfProgress, setEtfProgress]     = useState<{ done: number; total: number } | null>(null);

  const setHoldings = (holdings: Holding[])         => onChange({ ...data, holdings });
  const setTxs      = (transactions: Transaction[]) => onChange({ ...data, transactions });

  const addHolding = () =>
    setHoldings([...data.holdings, {
      id: uid(), name: '', type: 'etf',
      quantity: 0, pricePerUnit: 0, broker: '', ticker: '', currentPrice: 0,
    }]);
  const removeHolding = (id: string) => setHoldings(data.holdings.filter(h => h.id !== id));
  const updateHolding = (id: string, p: Partial<Holding>) =>
    setHoldings(data.holdings.map(h => h.id === id ? { ...h, ...p } : h));

  const addTx = () =>
    setTxs([{
      id: uid(), holdingName: '', type: txType,
      date: new Date().toISOString().split('T')[0],
      quantity: 0, pricePerUnit: 0, broker: '',
    }, ...data.transactions]);
  const removeTx = (id: string) => setTxs(data.transactions.filter(t => t.id !== id));
  const updateTx = (id: string, p: Partial<Transaction>) =>
    setTxs(data.transactions.map(t => t.id === id ? { ...t, ...p } : t));

  const doFetch = async (holdingsSnapshot: Holding[]) => {
    const hasAnyTicker = holdingsSnapshot.some(h => h.ticker || h.isin);
    if (!hasAnyTicker) {
      setFetchMsg(t.portfolioExtra.noTickerError);
      setFetchState('error');
      return;
    }
    setFetchState('loading');
    setFetchMsg('');
    try {
      // Step 1a: resolve ISINs → tickers (DEGIRO: has ISIN, bare or no ticker)
      const needsIsinRes = holdingsSnapshot.filter(h => {
        if (!h.isin || !looksLikeIsin(h.isin)) return false;
        if (!h.ticker) return true;
        return !h.ticker.includes('.');  // bare ticker without exchange suffix
      });

      // Step 1b: resolve bare tickers via search (IBKR: no ISIN, bare ticker like "TDIV")
      const needsTickerRes = holdingsSnapshot.filter(h => {
        if (!h.ticker || h.ticker.includes('.')) return false;  // no ticker or already has suffix
        if (h.isin && looksLikeIsin(h.isin)) return false;     // handled by ISIN resolution
        return true;
      });

      const [isinMap, tickerMap] = await Promise.all([
        needsIsinRes.length > 0 ? resolveIsins(needsIsinRes.map(h => h.isin!)) : Promise.resolve({} as Record<string, string>),
        needsTickerRes.length > 0 ? resolveBareTickers(needsTickerRes.map(h => h.ticker)) : Promise.resolve({} as Record<string, string>),
      ]);

      // Apply resolved tickers. BUG FIX: also replace bare tickers (no ".") when a
      // better exchange-specific ticker (with ".") was resolved — previously only holdings
      // with no ticker at all were updated, so "TDIV" was never replaced with "TDIV.AS".
      const resolvedSnapshot = holdingsSnapshot.map(h => {
        if (h.isin && isinMap[h.isin]) {
          const resolved = isinMap[h.isin];
          if (!h.ticker || (!h.ticker.includes('.') && resolved.includes('.'))) {
            return { ...h, ticker: resolved };
          }
        }
        if (h.ticker && !h.ticker.includes('.') && tickerMap[h.ticker]) {
          return { ...h, ticker: tickerMap[h.ticker] };
        }
        return h;
      });

      // Step 2: fetch prices for all resolved tickers
      const tickers = [...new Set(resolvedSnapshot.map(h => h.ticker).filter(Boolean))];
      if (tickers.length === 0) {
        setFetchMsg(t.portfolioExtra.noValidTickerError);
        setFetchState('error');
        return;
      }

      const result = await fetchPricesWithFX(tickers);
      setFxRates(result.rates);
      const now = new Date(result.timestamp);
      setLastFetchTime(now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }));

      const updated = resolvedSnapshot.map(h => {
        if (!h.ticker) return h;
        const q = result.quotes[h.ticker];
        if (!q) return h;
        return {
          ...h,
          currentPrice:        q.priceEur,
          currentPriceLocal:   q.priceLocal,
          currentCurrency:     q.currency,
          currentRate:         q.rate,
          fetchedAt:           result.timestamp,
          dividendPerShareEur: q.dividendPerShareEur ?? h.dividendPerShareEur,
          dividendYield:       q.dividendYield       ?? h.dividendYield,
          exDivDate:           q.exDivDate,
          divPayDate:          q.divPayDate,
          country:             q.country ?? h.country,
          sector:              q.sector  ?? h.sector,
        };
      });
      onChange({ ...data, holdings: updated });

      const found = Object.keys(result.quotes).length;
      const resolvedTotal = Object.keys(isinMap).length + Object.keys(tickerMap).length;
      const resolvedNote = resolvedTotal > 0 ? ` (${resolvedTotal} ${t.portfolioExtra.resolvedNote})` : '';
      const priceWord = tickers.length !== 1 ? t.portfolioExtra.pricesUpdatedPlural : t.portfolioExtra.pricesUpdated;
      setFetchMsg(`${found} ${t.portfolioExtra.fetchedOf} ${tickers.length} ${priceWord} ${t.portfolioExtra.bijgewerkt}${resolvedNote}`);
      setFetchState('ok');
    } catch (err) {
      console.error('Price fetch failed:', err);
      setFetchMsg(t.portfolioExtra.fetchError);
      setFetchState('error');
    }
  };

  const handleRefreshPrices = () => doFetch(data.holdings);

  const handleFetchEtfHoldings = async () => {
    // Fetch for all holdings with tickers — regardless of tagged type, because users
    // may have ETFs tagged as "stocks". fetchEtfHoldings uses small batches (3 at a
    // time) to avoid Yahoo Finance rate-limiting. Plain stocks return no topHoldings
    // and are silently skipped.
    const allTickers = [...new Set(data.holdings.filter(h => h.ticker).map(h => h.ticker!))];
    if (!allTickers.length) return;
    setEtfFetchState('loading');
    setEtfProgress({ done: 0, total: allTickers.length });
    try {
      const base = { ...etfHoldings };
      const fresh = await fetchEtfHoldings(allTickers, (done, total, partial) => {
        setEtfProgress({ done, total });
        // Live update as batches complete — `partial` is passed in, no TDZ issue
        setEtfHoldings({ ...base, ...partial });
      });
      const merged = { ...etfHoldings, ...fresh };
      setEtfHoldings(merged);
      localStorage.setItem('dutch-tax-etf-holdings-v2', JSON.stringify(merged));
      setEtfFetchState('ok');
      setEtfProgress(null);
    } catch (err) {
      console.error('ETF holdings fetch failed:', err);
      setEtfFetchState('error');
      setEtfProgress(null);
    }
  };

  // Auto-fetch once on mount when tickers are present
  useEffect(() => {
    if (autoFetched.current) return;
    const hasTickers = data.holdings.some(h => h.ticker);
    if (!hasTickers) return;
    autoFetched.current = true;
    doFetch(data.holdings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetLabels: Record<AssetType, string> = useMemo(() => ({
    savings:    t.portfolio.assetSavings,
    stocks:     t.portfolio.assetStocks,
    etf:        t.portfolio.assetEtf,
    bonds:      t.portfolio.assetBonds,
    realEstate: t.portfolio.assetRealEstate,
    crypto:     t.portfolio.assetCrypto,
    other:      t.portfolio.assetOther,
  }), [t]);

  const positions = useMemo(
    () => computePositions(data.holdings, data.transactions),
    [data.holdings, data.transactions],
  );

  const totalCurrentValue = useMemo(
    () => positions.reduce((s, p) => s + p.currentValue, 0),
    [positions],
  );

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const sortedPositions = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const divByName: Record<string, number>   = {};
    const divByTicker: Record<string, number> = {};
    for (const h of data.holdings) {
      if (h.name   && h.dividendPerShareEur) divByName[h.name]     = h.dividendPerShareEur;
      if (h.ticker && h.dividendPerShareEur) divByTicker[h.ticker] = h.dividendPerShareEur;
    }
    const annualDiv = (p: { name: string; ticker?: string; quantity: number }) => {
      const dps = (p.ticker && divByTicker[p.ticker]) || divByName[p.name] || 0;
      return p.quantity * dps;
    };
    return [...positions].sort((a, b) => {
      switch (sortCol) {
        case 'name':        return dir * a.name.localeCompare(b.name);
        case 'qty':         return dir * (a.quantity - b.quantity);
        case 'marketValue': return dir * (a.currentValue - b.currentValue);
        case 'gainPct': {
          const ga = a.avgCost > 0 && a.currentPrice > 0 ? (a.currentPrice - a.avgCost) / a.avgCost : -Infinity;
          const gb = b.avgCost > 0 && b.currentPrice > 0 ? (b.currentPrice - b.avgCost) / b.avgCost : -Infinity;
          return dir * (ga - gb);
        }
        case 'gainAbs': {
          const ga = a.avgCost > 0 && a.currentPrice > 0 ? a.quantity * (a.currentPrice - a.avgCost) : -Infinity;
          const gb = b.avgCost > 0 && b.currentPrice > 0 ? b.quantity * (b.currentPrice - b.avgCost) : -Infinity;
          return dir * (ga - gb);
        }
        case 'dividend': return dir * (annualDiv(a) - annualDiv(b));
        default: return 0;
      }
    });
  }, [positions, sortCol, sortDir, data.holdings]);

  // Filter transactions by current type once — was filtered twice (empty check + map)
  const filteredTxs = useMemo(
    () => data.transactions.filter(tx => tx.type === txType),
    [data.transactions, txType],
  );

  const pieSlices = useMemo(() => {
    const totals: Partial<Record<AssetType, number>> = {};
    for (const p of positions) totals[p.type] = (totals[p.type] ?? 0) + p.currentValue;
    return Object.entries(totals).map(([type, value]) => ({
      label: assetLabels[type as AssetType],
      value: value ?? 0,
      color: ASSET_COLORS[type as AssetType],
    }));
  }, [positions, assetLabels]);

  const totalAnnualDiv = useMemo(() => {
    const divByName: Record<string, number | undefined>   = {};
    const divByTicker: Record<string, number | undefined> = {};
    for (const h of data.holdings) {
      if (h.name)   divByName[h.name]     = h.dividendPerShareEur;
      if (h.ticker) divByTicker[h.ticker] = h.dividendPerShareEur;
    }
    let s = 0;
    for (const p of positions) {
      if (p.quantity <= 0) continue;
      const dps = (p.ticker && divByTicker[p.ticker]) || (p.name && divByName[p.name]) || 0;
      if (dps) s += p.quantity * dps;
    }
    return s;
  }, [data.holdings, positions]);

  // O(1) lookup of Holding by either name or ticker — was data.holdings.find() per row (O(N²))
  const holdingByKey = useMemo(() => {
    const byName: Record<string, Holding>   = {};
    const byTicker: Record<string, Holding> = {};
    for (const h of data.holdings) {
      if (h.name)   byName[h.name]     = h;
      if (h.ticker) byTicker[h.ticker] = h;
    }
    return (name?: string, ticker?: string): Holding | undefined =>
      (ticker && byTicker[ticker]) || (name && byName[name]) || undefined;
  }, [data.holdings]);

  const INNER_TABS = [
    { id: 'holdings' as InnerTab,     label: t.portfolioExtra.tabHoldings,     icon: <TrendingUp size={13} /> },
    { id: 'transactions' as InnerTab, label: t.portfolioExtra.tabTransactions,  icon: <ArrowUpCircle size={13} /> },
    { id: 'import' as InnerTab,       label: t.portfolioExtra.tabImport,        icon: <FileUp size={13} /> },
    { id: 'overview' as InnerTab,     label: t.portfolioExtra.tabOverview,      icon: <LayoutList size={13} /> },
    { id: 'analyse' as InnerTab,      label: 'Analyse',     icon: <Globe size={13} /> },
  ];

  const hasTickers = data.holdings.some(h => h.ticker);

  return (
    <SectionCard title={t.portfolioExtra.sectionTitle} icon={<TrendingUp size={20} />} accent="border-purple-400">
      {/* Live total banner — always show when there are holdings with tickers */}
      {(hasTickers || totalCurrentValue > 0 || fetchState === 'loading') && (
        <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.portfolioExtra.currentValue}</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{nl0.format(totalCurrentValue)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={handleRefreshPrices}
                disabled={fetchState === 'loading'}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 cursor-pointer border-0 disabled:opacity-60"
              >
                <RefreshCw size={13} className={fetchState === 'loading' ? 'animate-spin' : ''} />
                {fetchState === 'loading' ? t.portfolioExtra.fetchingPrices : t.portfolioExtra.refreshPrices}
              </button>
              {lastFetchTime && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={11} />{t.portfolioExtra.updatedAt} {lastFetchTime}
                </span>
              )}
            </div>
          </div>
          {/* FX rates strip */}
          {Object.keys(fxRates).length > 1 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-purple-200 dark:border-purple-800">
              {Object.entries(fxRates)
                .filter(([cur]) => cur !== 'EUR')
                .map(([cur, rate]) => (
                  <span key={cur} className="text-xs text-slate-500">
                    1 {cur === 'GBP' ? 'GBP' : cur} = <span className="font-medium text-slate-700">{nl.format(rate)}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Fetch status message — shown above tabs so it's visible from any tab */}
      {fetchMsg && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${
          fetchState === 'ok'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {fetchState === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {fetchMsg}
        </div>
      )}

      {/* Inner tabs */}
      <div className="flex gap-0 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-5">
        {INNER_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer border-0 ${
              tab === t.id ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Holdings ── */}
      {tab === 'holdings' && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p className="text-xs text-slate-500">
              {t.portfolioExtra.holdingsDescFull}
              <br />
              <span className="text-slate-400">{t.portfolioExtra.holdingsDescTax}</span>
            </p>
          </div>

          {data.holdings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mb-3">
              {t.portfolio.noHoldings}
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {data.holdings.map(h => (
                <div key={h.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{t.portfolioExtra.colName}</label>
                      <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="VWCE" value={h.name}
                        onChange={e => updateHolding(h.id, { name: e.target.value })} />
                    </div>
                    <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">
                        {t.portfolioExtra.colTicker}
                        {h.isin && !h.ticker && (
                          <span className="ml-1 text-indigo-400">{t.portfolioExtra.colAutoViaIsin}</span>
                        )}
                      </label>
                      <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                        placeholder={h.isin ? h.isin : 'VWCE.AS'} value={h.ticker}
                        onChange={e => updateHolding(h.id, { ticker: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{t.portfolioExtra.colType}</label>
                      <select className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        value={h.type} onChange={e => updateHolding(h.id, { type: e.target.value as AssetType })}>
                        {(Object.keys(assetLabels) as AssetType[]).map(k => (
                          <option key={k} value={k}>{assetLabels[k]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{t.portfolioExtra.colBroker}</label>
                      <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="DEGIRO" value={h.broker}
                        onChange={e => updateHolding(h.id, { broker: e.target.value })} />
                    </div>
                    <div className="col-span-4 sm:col-span-1 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{t.portfolioExtra.colQty}</label>
                      <input type="number" min={0}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="0" value={h.quantity || ''}
                        onChange={e => updateHolding(h.id, { quantity: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-7 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{t.portfolioExtra.colBuyPrice}</label>
                      <input type="number" min={0}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="0" value={h.pricePerUnit || ''}
                        onChange={e => updateHolding(h.id, { pricePerUnit: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Div/aandeel/jr (€)</label>
                      <input type="number" min={0} step="0.01"
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="auto"
                        value={h.dividendPerShareEur != null && h.dividendPerShareEur > 0 ? h.dividendPerShareEur : ''}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          updateHolding(h.id, { dividendPerShareEur: isNaN(v) ? undefined : v });
                        }} />
                    </div>
                    <div className="col-span-1 flex items-end justify-center pb-0.5">
                      <button onClick={() => removeHolding(h.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1 bg-transparent border-0 cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {(h.ticker || h.isin) && (
                    <div className="mt-2 space-y-1">
                      {/* Price row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {h.currentPrice > 0 ? (
                          <>
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle2 size={12} />
                              <strong>{nl.format(h.currentPrice)}</strong>
                            </span>
                            {h.currentCurrency && h.currentCurrency !== 'EUR' && h.currentPriceLocal !== undefined && (
                              <span className="text-slate-400">
                                ({fmtLocal(h.currentPriceLocal, h.currentCurrency)}
                                {h.currentRate !== undefined && ` · 1 ${h.currentCurrency === 'GBp' ? 'GBp' : h.currentCurrency} = ${h.currentRate.toFixed(4)} €`})
                              </span>
                            )}
                            {h.quantity > 0 && (
                              <span className="text-slate-500">→ {nl0.format(h.quantity * h.currentPrice)}</span>
                            )}
                            {h.pricePerUnit > 0 && (
                              <span className={`font-semibold ${h.currentPrice >= h.pricePerUnit ? 'text-green-600' : 'text-red-500'}`}>
                                {h.currentPrice >= h.pricePerUnit ? '▲' : '▼'}{' '}
                                {(Math.abs((h.currentPrice - h.pricePerUnit) / h.pricePerUnit) * 100).toFixed(1)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">
                            {fetchState === 'loading'
                              ? (h.isin && !h.ticker ? t.portfolioExtra.isinConverting : t.portfolioExtra.fetchingPrices)
                              : (h.isin && !h.ticker ? t.portfolioExtra.isinAutoMsg.replace('{isin}', h.isin) : t.portfolioExtra.priceNotFetched)}
                          </span>
                        )}
                      </div>
                      {/* Dividend row */}
                      {(h.dividendPerShareEur ?? 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-amber-700">
                          <span className="font-medium">
                            Div: {nl.format(h.dividendPerShareEur!)}/jr
                            {h.quantity > 0 && ` (${nl0.format(h.quantity * h.dividendPerShareEur!)} totaal)`}
                          </span>
                          {(h.dividendYield ?? 0) > 0 && (
                            <span>{(h.dividendYield! * 100).toFixed(2)}% yield</span>
                          )}
                          {h.exDivDate && (
                            <span>
                              {isPast(h.exDivDate) ? 'Vorige ex-div:' : 'Ex-div:'} {fmtDate(h.exDivDate)}
                            </span>
                          )}
                          {h.divPayDate && (
                            <span>
                              {isPast(h.divPayDate) ? 'Vorige betaling:' : 'Betaling:'} {fmtDate(h.divPayDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={addHolding}
            className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 cursor-pointer border-0">
            <Plus size={13} /> {t.portfolioExtra.addPosition}
          </button>

        </div>
      )}

      {/* ── Transactions ── */}
      {tab === 'transactions' && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex gap-1">
              {(['buy', 'sell'] as TransactionType[]).map(type => (
                <button key={type} onClick={() => setTxType(type)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    txType === type
                      ? type === 'buy' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {type === 'buy' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                  {type === 'buy' ? t.portfolioExtra.buysLabel : t.portfolioExtra.sellsLabel}
                </button>
              ))}
            </div>
            <button onClick={addTx}
              className={`flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-lg cursor-pointer border-0 ${
                txType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <Plus size={13} /> {t.portfolioExtra.addTx}
            </button>
          </div>

          {filteredTxs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              {txType === 'buy' ? t.portfolioExtra.noBuys : t.portfolioExtra.noSells}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map(tx => (
                <div key={tx.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{t.portfolioExtra.colFund}</label>
                    <FondsSearch
                      value={tx.holdingName}
                      holdings={data.holdings}
                      onChange={(name, ticker) => {
                        // Single onChange call to avoid stale-closure race where two separate
                        // calls both spread `data` and the second overwrites the first's changes.
                        const updatedTxs = data.transactions.map(t =>
                          t.id === tx.id ? { ...t, holdingName: name } : t
                        );
                        const needsNewHolding = !!ticker && !data.holdings.some(
                          h => h.ticker === ticker || h.name === name
                        );
                        onChange({
                          ...data,
                          transactions: updatedTxs,
                          holdings: needsNewHolding
                            ? [...data.holdings, {
                                id: uid(), name, type: 'stocks' as AssetType,
                                quantity: 0, pricePerUnit: 0, broker: tx.broker || '',
                                ticker: ticker!, currentPrice: 0,
                              }]
                            : data.holdings,
                        });
                      }}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{t.portfolioExtra.colBroker}</label>
                    <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="DEGIRO" value={tx.broker}
                      onChange={e => updateTx(tx.id, { broker: e.target.value })} />
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{t.portfolioExtra.colDate}</label>
                    <input type="date"
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      value={tx.date} onChange={e => updateTx(tx.id, { date: e.target.value })} />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{t.portfolioExtra.colQty}</label>
                    <input type="number" min={0}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0" value={tx.quantity || ''}
                      onChange={e => updateTx(tx.id, { quantity: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{t.portfolioExtra.colPrice}</label>
                    <input type="number" min={0}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0" value={tx.pricePerUnit || ''}
                      onChange={e => updateTx(tx.id, { pricePerUnit: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-1 flex items-end justify-center">
                    <button onClick={() => removeTx(tx.id)}
                      className="text-red-400 hover:text-red-600 p-1 bg-transparent border-0 cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="col-span-12 text-right text-xs text-slate-500">
                    {t.portfolioExtra.txTotal} {nl0.format(tx.quantity * tx.pricePerUnit)}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── Import ── */}
      {tab === 'import' && (
        <Suspense fallback={<div className="text-center py-6 text-slate-400 text-sm">…</div>}>
          <CsvImportPanel
            existingTransactions={data.transactions}
            existingHoldings={data.holdings}
            onImport={(newTxs, newHoldings) => {
              onChange({
                ...data,
                transactions: [...data.transactions, ...newTxs],
                holdings:     [...data.holdings, ...newHoldings],
              });
            }}
          />
        </Suspense>
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              {t.portfolioExtra.noPositions}
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.portfolioExtra.portfolioValue}</p>
                  <p className="text-base font-bold text-purple-700 dark:text-purple-300">{nl0.format(totalCurrentValue)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.portfolioExtra.annualDiv}</p>
                  <p className="text-base font-bold text-amber-700 dark:text-amber-300">
                    {totalAnnualDiv > 0 ? nl0.format(totalAnnualDiv) : '—'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.portfolioExtra.positions}</p>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-200">{positions.length}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.portfolioExtra.transactions}</p>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-200">{data.transactions.length}</p>
                </div>
              </div>

              {/* Pie chart */}
              {pieSlices.length > 1 && (
                <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 mb-3">{t.portfolioExtra.allocChart}</p>
                  <PieChart slices={pieSlices} size={160} />
                </div>
              )}

              {/* Positions table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                      {/* Naam — sortable */}
                      <th className="text-left py-2 pr-3 font-medium">
                        <SortHeader label={t.portfolioExtra.colName} col="name" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="left" />
                      </th>
                      <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">{t.portfolioExtra.colBroker}</th>
                      {/* Aantal — sortable */}
                      <th className="text-right py-2 pr-3 font-medium">
                        <SortHeader label={t.portfolioExtra.colQty} col="qty" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                      </th>
                      <th className="text-right py-2 pr-3 font-medium hidden sm:table-cell">{t.portfolioExtra.colAvgPrice}</th>
                      <th className="text-right py-2 pr-3 font-medium">
                        <span className="flex items-center justify-end gap-1">
                          {t.portfolioExtra.colCurrentPrice}
                          {fetchState === 'loading' && (
                            <RefreshCw size={10} className="animate-spin text-indigo-500" />
                          )}
                        </span>
                      </th>
                      <th className="text-right py-2 pr-3 font-medium hidden md:table-cell">
                        <SortHeader label={t.portfolioExtra.colDivYr} col="dividend" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                      </th>
                      {/* Rendement % — sortable */}
                      <th className="text-right py-2 pr-3 font-medium hidden sm:table-cell">
                        <SortHeader label={t.portfolioExtra.colReturn} col="gainPct" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                      </th>
                      {/* Winst/verlies € — sortable */}
                      <th className="text-right py-2 pr-3 font-medium">
                        <SortHeader label="Winst/verlies" col="gainAbs" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                      </th>
                      {/* Marktwaarde — sortable */}
                      <th className="text-right py-2 font-medium">
                        <SortHeader label="Marktwaarde" col="marketValue" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                      </th>
                      <th className="py-2 font-medium w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((p, i) => {
                      const holding = holdingByKey(p.name, p.ticker);
                      const hasFetched = p.currentPrice > 0;
                      const gainPct = p.avgCost > 0 && hasFetched
                        ? ((p.currentPrice - p.avgCost) / p.avgCost) * 100
                        : null;
                      const gainAbs = gainPct !== null ? p.quantity * (p.currentPrice - p.avgCost) : null;

                      return (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          {/* Naam + ticker */}
                          <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-100">
                            <div>{p.name || '—'}</div>
                            {p.ticker && <div className="text-xs text-slate-400 font-mono">{p.ticker}</div>}
                          </td>

                          {/* Broker */}
                          <td className="py-2.5 pr-3 text-slate-500 text-xs hidden sm:table-cell">
                            {p.broker || '—'}
                          </td>

                          {/* Aantal */}
                          <td className="py-2.5 pr-3 text-right text-slate-700">
                            {p.quantity.toLocaleString('nl-NL', { maximumFractionDigits: 4 })}
                          </td>

                          {/* Gem. aankoopkoers */}
                          <td className="py-2.5 pr-3 text-right text-slate-500 text-xs hidden sm:table-cell">
                            {nl.format(p.avgCost)}
                          </td>

                          {/* Huidige koers — always present, shows spinner/dash when not yet loaded */}
                          <td className="py-2.5 pr-3 text-right">
                            {fetchState === 'loading' && !hasFetched ? (
                              <span className="text-slate-300 text-xs flex items-center justify-end gap-1">
                                <RefreshCw size={10} className="animate-spin" />
                              </span>
                            ) : hasFetched ? (
                              <span className="text-xs leading-tight">
                                <span className="font-semibold text-green-700">{nl.format(p.currentPrice)}</span>
                                {/* Local currency below EUR price */}
                                {holding?.currentCurrency && holding.currentCurrency !== 'EUR' &&
                                  holding.currentPriceLocal !== undefined && (
                                  <span className="block text-slate-400 font-normal">
                                    {fmtLocal(holding.currentPriceLocal, holding.currentCurrency)}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Dividend/jr */}
                          <td className="py-2.5 pr-3 text-right text-xs hidden md:table-cell">
                            {(() => {
                              const h = holdingByKey(p.name, p.ticker);
                              const div = h?.dividendPerShareEur;
                              if (!div || div <= 0) return <span className="text-slate-300">—</span>;
                              const annual = p.quantity * div;
                              const yld = h.dividendYield ?? 0;
                              return (
                                <span className="text-amber-700">
                                  <span className="font-semibold">{nl0.format(annual)}</span>
                                  {yld > 0 && (
                                    <span className="block font-normal text-amber-500">{(yld * 100).toFixed(2)}%</span>
                                  )}
                                  {h.exDivDate && (
                                    <span className="block font-normal text-slate-400" title={isPast(h.exDivDate) ? 'Vorige ex-dividenddatum' : 'Volgende ex-dividenddatum'}>
                                      {isPast(h.exDivDate) ? '◷' : '◷'} {fmtDate(h.exDivDate)}
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Rendement % */}
                          <td className="py-2.5 pr-3 text-right text-xs hidden sm:table-cell">
                            {gainPct !== null ? (
                              <span className={gainPct >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                                {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Winst/verlies € */}
                          <td className="py-2.5 pr-3 text-right text-xs">
                            {gainAbs !== null ? (
                              <span className={gainAbs >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                                {nl0.format(gainAbs)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Marktwaarde */}
                          <td className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">
                            {nl0.format(p.currentValue)}
                          </td>

                          {/* Verwijderen */}
                          <td className="py-2.5 pl-1">
                            <button
                              onClick={() => {
                                // find all holdings that make up this merged position
                                const matchIds = data.holdings
                                  .filter(h => (p.ticker && h.ticker === p.ticker) || h.name === p.name)
                                  .map(h => h.id);
                                const matchNames = data.holdings
                                  .filter(h => matchIds.includes(h.id))
                                  .map(h => h.name);
                                onChange({
                                  ...data,
                                  holdings:     data.holdings.filter(h => !matchIds.includes(h.id)),
                                  transactions: data.transactions.filter(t => !matchNames.includes(t.holdingName)),
                                });
                              }}
                              className="text-red-300 hover:text-red-500 transition-colors p-1 bg-transparent border-0 cursor-pointer"
                              title={t.portfolioExtra.removeTitle}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <td colSpan={4} className="py-2.5 font-semibold text-slate-700 dark:text-slate-200 hidden sm:table-cell">{t.portfolioExtra.totalLabel}</td>
                      <td colSpan={2} className="py-2.5 font-semibold text-slate-700 dark:text-slate-200 sm:hidden">{t.portfolioExtra.totalLabel}</td>
                      <td colSpan={5} className="py-2.5 text-right">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{nl0.format(totalCurrentValue)}</span>
                        {lastFetchTime && (
                          <span className="block text-xs text-slate-400 font-normal flex items-center justify-end gap-1">
                            <Clock size={10} />{lastFetchTime}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'analyse' && (
        <AnalyseTab
          positions={positions}
          holdings={data.holdings}
          etfHoldingsMap={etfHoldings}
          onFetchEtfHoldings={handleFetchEtfHoldings}
          etfFetchState={etfFetchState}
          etfProgress={etfProgress}
        />
      )}
    </SectionCard>
  );
}

// ── Country flag helper ────────────────────────────────────────────────────
const COUNTRY_CODE: Record<string, string> = {
  'United States': 'US', 'Netherlands': 'NL', 'United Kingdom': 'GB',
  'Germany': 'DE', 'France': 'FR', 'Ireland': 'IE', 'Luxembourg': 'LU',
  'Japan': 'JP', 'China': 'CN', 'Taiwan': 'TW', 'South Korea': 'KR',
  'Canada': 'CA', 'Australia': 'AU', 'Switzerland': 'CH', 'Sweden': 'SE',
  'Denmark': 'DK', 'Belgium': 'BE', 'Spain': 'ES', 'Italy': 'IT',
  'Norway': 'NO', 'Finland': 'FI', 'Portugal': 'PT', 'Austria': 'AT',
  'Singapore': 'SG', 'Hong Kong': 'HK', 'India': 'IN', 'Brazil': 'BR',
};

function countryFlag(country: string): string {
  const code = COUNTRY_CODE[country] ?? '';
  if (!code) return '🌐';
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

const PIE_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#16a34a', '#ea580c', '#0284c7',
  '#c026d3', '#65a30d',
];

// Map Yahoo Finance sector keys to Dutch display names
const SECTOR_DISPLAY: Record<string, string> = {
  technology:             'Technologie',
  consumer_cyclical:      'Consument (cyclisch)',
  financial_services:     'Financiën',
  healthcare:             'Gezondheidszorg',
  industrials:            'Industrie',
  consumer_defensive:     'Consument (def.)',
  energy:                 'Energie',
  basic_materials:        'Grondstoffen',
  communication_services: 'Communicatie',
  utilities:              'Nutsbedrijven',
  real_estate:            'Vastgoed',
  realestate:             'Vastgoed',
};


const nl0geo = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BreakdownRow {
  label: string;
  prefix?: string;
  value: number;
  color: string;
  positions: { name: string; ticker: string; value: number }[];
}

function BreakdownChart({ rows, total, hasPrefix = false, unknownNote }: {
  rows: BreakdownRow[];
  total: number;
  hasPrefix?: boolean;
  unknownNote?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const slices = rows.map(r => ({ pct: r.value / total, color: r.color, highlight: hovered === r.label || hovered === null ? 1 : 0.35 }));
  const colSpanBase = hasPrefix ? 3 : 2;

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* Donut — shrinks slightly when a row is hovered */}
        <div className="w-36 h-36 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {(() => {
              let angle = -Math.PI / 2;
              return slices.map((s, _i) => {
                const sweep = s.pct * 2 * Math.PI;
                if (sweep <= 0) return null;
                const cx = 50, cy = 50, R = 42, r = 26;
                const sa = angle, ea = angle + sweep;
                const large = sweep > Math.PI ? 1 : 0;
                const cos0 = Math.cos(sa), sin0 = Math.sin(sa);
                const cos1 = Math.cos(ea), sin1 = Math.sin(ea);
                const path = [
                  `M ${cx + r * cos0} ${cy + r * sin0}`,
                  `L ${cx + R * cos0} ${cy + R * sin0}`,
                  `A ${R} ${R} 0 ${large} 1 ${cx + R * cos1} ${cy + R * sin1}`,
                  `L ${cx + r * cos1} ${cy + r * sin1}`,
                  `A ${r} ${r} 0 ${large} 0 ${cx + r * cos0} ${cy + r * sin0}`,
                  'Z',
                ].join(' ');
                angle = ea;
                return (
                  <path
                    key={_i}
                    d={path}
                    fill={s.color}
                    stroke="white"
                    strokeWidth={1.5}
                    opacity={s.highlight}
                    style={{ transition: 'opacity 0.15s' }}
                  />
                );
              });
            })()}
          </svg>
        </div>

        {/* Table with hover-expand */}
        <div className="min-w-0 flex-1">
          <table className="text-sm border-separate border-spacing-y-0 w-full max-w-md">
            <tbody>
              {rows.map((r) => (
                <>
                  <tr
                    key={r.label}
                    className="cursor-default"
                    onMouseEnter={() => setHovered(r.label)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <td className="pr-2 align-middle py-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: r.color, opacity: hovered === null || hovered === r.label ? 1 : 0.4, transition: 'opacity 0.15s' }}
                      />
                    </td>
                    {hasPrefix && (
                      <td className="pr-1.5 align-middle py-1.5 text-base leading-none">{r.prefix ?? ''}</td>
                    )}
                    <td className={`pr-5 align-middle py-1.5 whitespace-nowrap transition-colors ${hovered === r.label ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                      {r.label}
                    </td>
                    <td className="pr-3 align-middle py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                      {nl0geo.format(r.value)}
                    </td>
                    <td className="align-middle py-1.5 text-right tabular-nums text-slate-400 dark:text-slate-500 text-xs w-12">
                      {(r.value / total * 100).toFixed(1)}%
                    </td>
                  </tr>
                  {hovered === r.label && r.positions.length > 0 && (
                    <tr key={`${r.label}-detail`}>
                      <td colSpan={colSpanBase + 2} className="pb-2 pt-0">
                        <div className="ml-5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
                          <table className="text-xs w-full">
                            <tbody>
                              {r.positions.sort((a, b) => b.value - a.value).map((p, pi) => (
                                <tr key={pi} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                  <td className="py-1 pr-3 text-slate-700 dark:text-slate-300 font-medium">{p.name}</td>
                                  {p.ticker && p.ticker !== p.name && (
                                    <td className="py-1 pr-3 text-slate-400 dark:text-slate-500 font-mono">{p.ticker}</td>
                                  )}
                                  <td className="py-1 text-right tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">{nl0geo.format(p.value)}</td>
                                  <td className="py-1 pl-2 text-right tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap w-10">
                                    {(p.value / r.value * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              <tr>
                <td className="pt-2 border-t border-slate-200 dark:border-slate-700" colSpan={colSpanBase} />
                <td className="pt-2 border-t border-slate-200 dark:border-slate-700 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {nl0geo.format(total)}
                </td>
                <td className="pt-2 border-t border-slate-200 dark:border-slate-700" />
              </tr>
            </tbody>
          </table>
          {unknownNote && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{unknownNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Build a breakdown map + per-group position list from positions + a key-lookup function
function buildBreakdown(
  positions: import('../types').Position[],
  getKey: (p: import('../types').Position) => string | undefined,
): Map<string, { total: number; items: { name: string; ticker: string; value: number }[] }> {
  const map = new Map<string, { total: number; items: { name: string; ticker: string; value: number }[] }>();
  for (const p of positions) {
    if (p.currentValue <= 0) continue;
    const key = getKey(p) ?? 'Onbekend';
    const entry = map.get(key) ?? { total: 0, items: [] };
    entry.total += p.currentValue;
    entry.items.push({ name: p.name, ticker: p.ticker, value: p.currentValue });
    map.set(key, entry);
  }
  return map;
}

interface StockExposure {
  symbol: string;
  name: string;
  totalEur: number;
  totalPct: number;
  isDirect: boolean;
  sources: { label: string; etfPct: number; eur: number }[];
}

function AnalyseTab({
  positions, holdings, etfHoldingsMap, onFetchEtfHoldings, etfFetchState, etfProgress,
}: {
  positions: import('../types').Position[];
  holdings: import('../types').Holding[];
  etfHoldingsMap: Record<string, EtfHoldingsResult>;
  onFetchEtfHoldings: () => void;
  etfFetchState: FetchState;
  etfProgress: { done: number; total: number } | null;
}) {
  const [query, setQuery] = useState('');

  const { countryMap, sectorMap } = useMemo(() => {
    // Build lookup maps once
    const countryByTicker: Record<string, string | undefined> = {};
    const countryByName:   Record<string, string | undefined> = {};
    const sectorByTicker:  Record<string, string | undefined> = {};
    const sectorByName:    Record<string, string | undefined> = {};
    for (const h of holdings) {
      if (h.ticker) { countryByTicker[h.ticker] = h.country; sectorByTicker[h.ticker] = h.sector; }
      if (h.name)   { countryByName[h.name]     = h.country; sectorByName[h.name]     = h.sector; }
    }

    // Helper: add value into a breakdown map
    const addToMap = (
      map: Map<string, { total: number; items: { name: string; ticker: string; value: number }[] }>,
      key: string, name: string, ticker: string, val: number,
    ) => {
      const entry = map.get(key) ?? { total: 0, items: [] };
      entry.total += val;
      const ex = entry.items.find(it => it.ticker === ticker && it.name === name);
      if (ex) ex.value += val;
      else entry.items.push({ name, ticker, value: val });
      map.set(key, entry);
    };

    // Geography: distribute ETF value across underlying stock countries (via exchange suffix)
    const cMap = new Map<string, { total: number; items: { name: string; ticker: string; value: number }[] }>();
    for (const pos of positions) {
      if (pos.currentValue <= 0) continue;
      const etfData = pos.ticker ? etfHoldingsMap[pos.ticker] : undefined;
      if (etfData && etfData.holdings.length > 0) {
        let covered = 0;
        for (const h of etfData.holdings) {
          const val = pos.currentValue * h.holdingPercent;
          covered += val;
          addToMap(cMap, countryFromSuffix(h.symbol) ?? 'Onbekend', pos.name, pos.ticker || pos.name, val);
        }
        const rem = pos.currentValue - covered;
        if (rem > 0.5) addToMap(cMap, 'Onbekend', pos.name, pos.ticker || pos.name, rem);
      } else {
        const c = (pos.ticker && countryByTicker[pos.ticker]) || countryByName[pos.name] || 'Onbekend';
        addToMap(cMap, c, pos.name, pos.ticker || pos.name, pos.currentValue);
      }
    }

    // Sector: use ETF sectorWeightings if available, else fall back to position sector
    const sMap = new Map<string, { total: number; items: { name: string; ticker: string; value: number }[] }>();
    for (const pos of positions) {
      if (pos.currentValue <= 0) continue;
      const etfData = pos.ticker ? etfHoldingsMap[pos.ticker] : undefined;
      if (etfData?.sectorWeightings && Object.keys(etfData.sectorWeightings).length > 0) {
        let covered = 0;
        for (const [key, pct] of Object.entries(etfData.sectorWeightings)) {
          const val = pos.currentValue * pct;
          covered += val;
          addToMap(sMap, SECTOR_DISPLAY[key] ?? key, pos.name, pos.ticker || pos.name, val);
        }
        const rem = pos.currentValue - covered;
        if (rem > 0.5) addToMap(sMap, 'Onbekend', pos.name, pos.ticker || pos.name, rem);
      } else {
        const s = (pos.ticker && sectorByTicker[pos.ticker]) || sectorByName[pos.name];
        addToMap(sMap, s ?? 'Onbekend', pos.name, pos.ticker || pos.name, pos.currentValue);
      }
    }

    return { countryMap: cMap, sectorMap: sMap };
  }, [holdings, positions, etfHoldingsMap]);

  // Show badges for ETF-type holdings + any ticker that already has loaded holdings data
  const etfPositionTickers = useMemo(() => {
    const etfTagged = holdings.filter(h => h.type === 'etf' && h.ticker).map(h => h.ticker!);
    const loaded    = Object.keys(etfHoldingsMap);
    return [...new Set([...etfTagged, ...loaded])];
  }, [holdings, etfHoldingsMap]);

  // Build stock exposure map: symbol → StockExposure
  const exposureMap = useMemo(() => {
    const totalPortfolio = positions.reduce((s, p) => s + p.currentValue, 0);
    if (totalPortfolio === 0) return new Map<string, StockExposure>();

    const map = new Map<string, StockExposure>();

    const upsert = (symbol: string, name: string, addEur: number, source: StockExposure['sources'][0], isDirect: boolean) => {
      const key = symbol.toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.totalEur += addEur;
        existing.totalPct = existing.totalEur / totalPortfolio * 100;
        existing.isDirect = existing.isDirect || isDirect;
        existing.sources.push(source);
      } else {
        map.set(key, {
          symbol,
          name,
          totalEur: addEur,
          totalPct: addEur / totalPortfolio * 100,
          isDirect,
          sources: [source],
        });
      }
    };

    for (const pos of positions) {
      if (pos.currentValue <= 0) continue;
      const etfData = pos.ticker ? etfHoldingsMap[pos.ticker] : undefined;

      if (etfData && etfData.holdings.length > 0) {
        // ETF position: expand into underlying stocks
        for (const h of etfData.holdings) {
          const contrib = pos.currentValue * h.holdingPercent;
          upsert(h.symbol, h.holdingName, contrib,
            { label: pos.ticker || pos.name, etfPct: h.holdingPercent * 100, eur: contrib },
            false);
        }
      } else {
        // Direct stock/other position
        const sym = pos.ticker || pos.name;
        upsert(sym, pos.name, pos.currentValue,
          { label: 'Direct', etfPct: 0, eur: pos.currentValue },
          true);
      }
    }

    return map;
  }, [positions, etfHoldingsMap]);

  // Sorted list + search filter
  const displayRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...exposureMap.values()].sort((a, b) => b.totalEur - a.totalEur);
    if (!q) return all.slice(0, 30);
    return all.filter(e =>
      e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [exposureMap, query]);

  const totalPortfolio = useMemo(
    () => positions.reduce((s, p) => s + p.currentValue, 0),
    [positions],
  );

  const THRESHOLD = 0.02;

  function toRows(
    map: ReturnType<typeof buildBreakdown>,
    labelKey: 'country' | 'sector',
  ): { rows: BreakdownRow[]; total: number; hasUnknown: boolean } {
    const total = [...map.values()].reduce((s, v) => s + v.total, 0);
    if (total === 0) return { rows: [], total: 0, hasUnknown: false };

    const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
    const main: BreakdownRow[] = [];
    let otherVal = 0;
    const otherItems: { name: string; ticker: string; value: number }[] = [];

    sorted.forEach(([key, data], i) => {
      if (key === 'Onbekend') return;
      if (data.total / total >= THRESHOLD || i < 3) {
        main.push({
          label: key,
          prefix: labelKey === 'country' ? (countryFlag(key) || undefined) : undefined,
          value: data.total,
          color: PIE_COLORS[main.length % PIE_COLORS.length],
          positions: data.items,
        });
      } else {
        otherVal += data.total;
        otherItems.push(...data.items);
      }
    });
    if (otherVal > 0) main.push({ label: 'Overig', prefix: labelKey === 'country' ? '📦' : undefined, value: otherVal, color: '#94a3b8', positions: otherItems });

    const hasUnknown = map.has('Onbekend');
    if (hasUnknown) {
      const unk = map.get('Onbekend')!;
      main.push({ label: 'Onbekend', prefix: labelKey === 'country' ? '❓' : undefined, value: unk.total, color: '#64748b', positions: unk.items });
    }

    return { rows: main, total, hasUnknown };
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo    = useMemo(() => toRows(countryMap, 'country'), [countryMap]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sector = useMemo(() => toRows(sectorMap,  'sector'),  [sectorMap]);

  const loadedEtfs  = etfPositionTickers.filter(t => etfHoldingsMap[t]);
  const missingEtfs = etfPositionTickers.filter(t => !etfHoldingsMap[t]);

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700">

      {/* ── Stock exposure search ── */}
      <div className="pb-4">
        <p className="pt-4 pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Building2 size={12} /> Aandelenblootstelling
        </p>

        {/* ETF status + load button — always show button when any holding has a ticker */}
        {holdings.some(h => h.ticker) ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {etfPositionTickers.map(t => {
              const loaded = !!etfHoldingsMap[t];
              return (
                <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                  loaded
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {t} {loaded ? `✓ ${etfHoldingsMap[t].holdings.length}` : '—'}
                </span>
              );
            })}
            <button
              onClick={onFetchEtfHoldings}
              disabled={etfFetchState === 'loading'}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 cursor-pointer border-0 disabled:opacity-60"
            >
              <RefreshCw size={11} className={etfFetchState === 'loading' ? 'animate-spin' : ''} />
              {etfFetchState === 'loading'
                ? etfProgress ? `${etfProgress.done}/${etfProgress.total}` : 'Laden…'
                : loadedEtfs.length === 0 ? 'Laad ETF-posities' : 'Ververs'}
            </button>
            {etfFetchState === 'error' && (
              <span className="text-xs text-red-500">Ophalen mislukt</span>
            )}
            {etfProgress && (
              <div className="w-full mt-1">
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${(etfProgress.done / etfProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {etfProgress.done} van {etfProgress.total} tickers gecontroleerd — ETF's die topholdings teruggeven verschijnen als badges
                </p>
              </div>
            )}
            {etfFetchState === 'idle' && loadedEtfs.length === 0 && (
              <p className="w-full text-xs text-slate-400 dark:text-slate-500 mt-1">
                Klik op de knop om te zoeken welke posities ETF's zijn en hun onderliggende aandelen te laden.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            Geen posities met ticker gevonden. Voeg een ticker toe op het Posities-tabblad.
          </p>
        )}

        {/* Search input */}
        {(loadedEtfs.length > 0 || exposureMap.size > 0) && (
          <>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Zoek aandeel (naam of ticker)…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {displayRows.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                {query ? 'Geen resultaten gevonden.' : 'Geen data — ververs prijzen en laad ETF-posities.'}
              </p>
            ) : (
              <>
                {!query && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                    Top {displayRows.length} posities op basis van blootstelling
                    {missingEtfs.length > 0 && ` · ${missingEtfs.length} ETF${missingEtfs.length > 1 ? "'s" : ''} nog niet geladen`}
                  </p>
                )}
                <div className="space-y-1">
                  {displayRows.map(row => {
                    const barW = totalPortfolio > 0 ? Math.min(100, (row.totalEur / totalPortfolio) * 100) : 0;
                    return (
                      <div key={row.symbol} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {/* Name + symbol */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{row.name}</span>
                              {row.symbol !== row.name && (
                                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">{row.symbol}</span>
                              )}
                            </div>
                            {/* Exposure bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${barW}%` }} />
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-indigo-600 dark:text-indigo-400 w-10 text-right">{row.totalPct.toFixed(2)}%</span>
                              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 w-20 text-right">{nl0geo.format(row.totalEur)}</span>
                            </div>
                          </div>
                          {/* Source badges */}
                          <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
                            {row.sources.slice(0, 4).map((s, i) => (
                              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                                s.label === 'Direct'
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                  : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                              }`}>
                                {s.label}{s.etfPct > 0 ? ` ${s.etfPct.toFixed(1)}%` : ''}
                              </span>
                            ))}
                            {row.sources.length > 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500">
                                +{row.sources.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!query && exposureMap.size > 30 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
                    {exposureMap.size - 30} meer — gebruik de zoekbalk om te filteren
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Geography breakdown ── */}
      {geo.total > 0 && (
        <div>
          <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <Globe size={12} /> Geografie
          </p>
          <BreakdownChart
            rows={geo.rows}
            total={geo.total}
            hasPrefix
            unknownNote="ETF-posities zijn uitgesplitst op basis van onderliggende top holdings. Beurssuffix bepaalt land (geen suffix = VS). Niet-geladen ETFs tonen hun eigen landdata."
          />
        </div>
      )}

      {/* ── Sector breakdown ── */}
      {sector.total > 0 && (
        <div>
          <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={12} /> Sectoren
          </p>
          <BreakdownChart
            rows={sector.rows}
            total={sector.total}
            unknownNote="ETF-posities zijn uitgesplitst op basis van sectorgewichten (Yahoo Finance). Niet-geladen ETFs tonen hun eigen sectordata."
          />
        </div>
      )}

      {geo.total === 0 && sector.total === 0 && loadedEtfs.length === 0 && exposureMap.size === 0 && (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          Geen koersdata beschikbaar — ververs prijzen en laad ETF-posities.
        </div>
      )}
    </div>
  );
}
