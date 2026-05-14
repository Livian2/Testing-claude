import { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle,
  LayoutList, RefreshCw, AlertCircle, CheckCircle2, FileUp, Clock,
} from 'lucide-react';
import type { PortfolioData, Holding, Transaction, AssetType, TransactionType } from '../types';
import { computePositions } from '../utils/taxCalculations';
import { fetchPricesWithFX, resolveIsins, resolveBareTickers, looksLikeIsin } from '../utils/priceFetcher';
import SectionCard from './SectionCard';
import PieChart from './PieChart';
import CsvImportPanel from './CsvImportPanel';

interface Props {
  data: PortfolioData;
  onChange: (d: PortfolioData) => void;
}

export const ASSET_LABELS: Record<AssetType, string> = {
  savings:    'Spaarrekening',
  stocks:     'Aandelen',
  etf:        'ETF / Indexfonds',
  bonds:      'Obligaties',
  realEstate: 'Vastgoed',
  crypto:     'Crypto',
  other:      'Overig',
};

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

type InnerTab = 'holdings' | 'transactions' | 'import' | 'overview';
type FetchState = 'idle' | 'loading' | 'ok' | 'error';

const fmtDate = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

const isPast = (iso: string): boolean => new Date(iso + 'T00:00:00') < new Date();

const fmtLocal = (price: number, currency: string) => {
  if (currency === 'GBp' || currency === 'GBX') {
    return `${(price).toFixed(2)} GBp`;
  }
  try {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(price);
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

interface FondsSearchProps {
  value: string;
  holdings: Holding[];
  onChange: (name: string, ticker?: string) => void;
}

function FondsSearch({ value, holdings, onChange }: FondsSearchProps) {
  const [query, setQuery]     = useState(value);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
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

  // Recalculate fixed position when dropdown opens or window scrolls/resizes
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const update = () => {
      const r = inputRef.current!.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const handleInput = (raw: string) => {
    setQuery(raw);
    onChange(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (raw.length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/finance/v1/finance/search?q=${encodeURIComponent(raw)}&quotesCount=15&newsCount=0&enableFuzzyQuery=false`,
          { headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const json = await res.json() as { quotes?: SearchResultItem[] };
          setResults((json.quotes ?? []).filter(q =>
            q.quoteType === 'ETF' || q.quoteType === 'EQUITY' || q.quoteType === 'MUTUALFUND'
          ));
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
      setOpen(true);
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
        ref={inputRef}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="Zoek fonds…"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">…</span>
      )}
      {hasDropdown && dropPos && (
        <div
          className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl text-xs overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: 260 }}
        >
          {existingMatches.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-200 dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-800">Eigen posities</div>
              {existingMatches.map(h => (
                <button
                  key={h.id}
                  onMouseDown={e => { e.preventDefault(); onChange(h.name, h.ticker); setQuery(h.name); setOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-0 bg-transparent flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{h.name}</span>
                  {h.ticker && <span className="font-mono text-slate-400 dark:text-slate-400">{h.ticker}</span>}
                </button>
              ))}
            </>
          )}
          {results.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-200 dark:border-slate-600 border-t border-slate-200 dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-800">Yahoo Finance</div>
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
          {loading && (
            <div className="px-3 py-3 text-slate-400 text-center">Zoeken…</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortfolioSection({ data, onChange }: Props) {
  const [tab, setTab]               = useState<InnerTab>('holdings');
  const [txType, setTxType]         = useState<TransactionType>('buy');
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchMsg, setFetchMsg]     = useState('');
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [fxRates, setFxRates]            = useState<Record<string, number>>({});
  const autoFetched = useRef(false);

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
    setTxs([...data.transactions, {
      id: uid(), holdingName: '', type: txType,
      date: new Date().toISOString().split('T')[0],
      quantity: 0, pricePerUnit: 0, broker: '',
    }]);
  const removeTx = (id: string) => setTxs(data.transactions.filter(t => t.id !== id));
  const updateTx = (id: string, p: Partial<Transaction>) =>
    setTxs(data.transactions.map(t => t.id === id ? { ...t, ...p } : t));

  const doFetch = async (holdingsSnapshot: Holding[]) => {
    const hasAnyTicker = holdingsSnapshot.some(h => h.ticker || h.isin);
    if (!hasAnyTicker) {
      setFetchMsg('Geen ticker-symbolen of ISIN-codes ingevuld. Voeg tickers toe bij uw posities (bijv. VWCE.AS).');
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
        setFetchMsg('Kon geen geldige ticker-symbolen vinden. Controleer uw ISIN-codes of vul tickers handmatig in.');
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
          dividendPerShareEur: q.dividendPerShareEur,
          dividendYield:       q.dividendYield,
          exDivDate:           q.exDivDate,
          divPayDate:          q.divPayDate,
        };
      });
      onChange({ ...data, holdings: updated });

      const found = Object.keys(result.quotes).length;
      const resolvedTotal = Object.keys(isinMap).length + Object.keys(tickerMap).length;
      const resolvedNote = resolvedTotal > 0 ? ` (${resolvedTotal} symbolen automatisch omgezet)` : '';
      setFetchMsg(`${found} van ${tickers.length} koers${tickers.length !== 1 ? 'en' : ''} bijgewerkt.${resolvedNote}`);
      setFetchState('ok');
    } catch (err) {
      console.error('Price fetch failed:', err);
      setFetchMsg('Kon koersen niet ophalen. Controleer uw internetverbinding of de ticker-symbolen.');
      setFetchState('error');
    }
  };

  const handleRefreshPrices = () => doFetch(data.holdings);

  // Auto-fetch once on mount when tickers are present
  useEffect(() => {
    if (autoFetched.current) return;
    const hasTickers = data.holdings.some(h => h.ticker);
    if (!hasTickers) return;
    autoFetched.current = true;
    doFetch(data.holdings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positions         = computePositions(data.holdings, data.transactions);
  const totalCurrentValue = positions.reduce((s, p) => s + p.currentValue, 0);

  const pieSlices = Object.entries(
    positions.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] ?? 0) + p.currentValue;
      return acc;
    }, {} as Record<AssetType, number>),
  ).map(([type, value]) => ({
    label: ASSET_LABELS[type as AssetType],
    value,
    color: ASSET_COLORS[type as AssetType],
  }));

  const INNER_TABS = [
    { id: 'holdings' as InnerTab,     label: 'Posities',    icon: <TrendingUp size={13} /> },
    { id: 'transactions' as InnerTab, label: 'Transacties', icon: <ArrowUpCircle size={13} /> },
    { id: 'import' as InnerTab,       label: 'Importeer',   icon: <FileUp size={13} /> },
    { id: 'overview' as InnerTab,     label: 'Overzicht',   icon: <LayoutList size={13} /> },
  ];

  const hasTickers = data.holdings.some(h => h.ticker);

  return (
    <SectionCard title="Beleggingsportefeuille — Live tracking" icon={<TrendingUp size={20} />} accent="border-purple-400">
      {/* Live total banner — always show when there are holdings with tickers */}
      {(hasTickers || totalCurrentValue > 0 || fetchState === 'loading') && (
        <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Actuele portefeuillewaarde</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{nl0.format(totalCurrentValue)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={handleRefreshPrices}
                disabled={fetchState === 'loading'}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 cursor-pointer border-0 disabled:opacity-60"
              >
                <RefreshCw size={13} className={fetchState === 'loading' ? 'animate-spin' : ''} />
                {fetchState === 'loading' ? 'Ophalen…' : 'Koersen bijwerken'}
              </button>
              {lastFetchTime && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={11} />Bijgewerkt om {lastFetchTime}
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
              Voeg posities toe voor live koersopvolging. Vul de <strong>ticker</strong> in (bijv.{' '}
              <code className="bg-slate-100 px-1 rounded">VWCE.AS</code>) voor automatisch ophalen.
              <br />
              <span className="text-slate-400">Belastingwaardes (1 jan) invullen op het tabblad <strong>Waardes 1 jan</strong>.</span>
            </p>
          </div>

          {data.holdings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mb-3">
              Nog geen posities toegevoegd
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {data.holdings.map(h => (
                <div key={h.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Naam</label>
                      <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="VWCE" value={h.name}
                        onChange={e => updateHolding(h.id, { name: e.target.value })} />
                    </div>
                    <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">
                        Ticker
                        {h.isin && !h.ticker && (
                          <span className="ml-1 text-indigo-400">(auto via ISIN)</span>
                        )}
                      </label>
                      <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                        placeholder={h.isin ? h.isin : 'VWCE.AS'} value={h.ticker}
                        onChange={e => updateHolding(h.id, { ticker: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Type</label>
                      <select className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        value={h.type} onChange={e => updateHolding(h.id, { type: e.target.value as AssetType })}>
                        {(Object.keys(ASSET_LABELS) as AssetType[]).map(k => (
                          <option key={k} value={k}>{ASSET_LABELS[k]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Broker</label>
                      <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="DEGIRO" value={h.broker}
                        onChange={e => updateHolding(h.id, { broker: e.target.value })} />
                    </div>
                    <div className="col-span-4 sm:col-span-1 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Aantal</label>
                      <input type="number" min={0}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="0" value={h.quantity || ''}
                        onChange={e => updateHolding(h.id, { quantity: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-7 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Aankoopkoers (€)</label>
                      <input type="number" min={0}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="0" value={h.pricePerUnit || ''}
                        onChange={e => updateHolding(h.id, { pricePerUnit: parseFloat(e.target.value) || 0 })} />
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
                              ? (h.isin && !h.ticker ? 'ISIN omzetten…' : 'Ophalen…')
                              : (h.isin && !h.ticker ? `ISIN: ${h.isin} — wordt automatisch omgezet bij ophalen` : 'Koers nog niet opgehaald')}
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
            <Plus size={13} /> Positie toevoegen
          </button>

        </div>
      )}

      {/* ── Transactions ── */}
      {tab === 'transactions' && (
        <div>
          <div className="flex gap-1 mb-4">
            {(['buy', 'sell'] as TransactionType[]).map(type => (
              <button key={type} onClick={() => setTxType(type)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  txType === type
                    ? type === 'buy' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {type === 'buy' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                {type === 'buy' ? 'Aankopen' : 'Verkopen'}
              </button>
            ))}
          </div>

          {data.transactions.filter(t => t.type === txType).length === 0 ? (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mb-3">
              Geen {txType === 'buy' ? 'aankopen' : 'verkopen'} ingevoerd
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {data.transactions.filter(t => t.type === txType).map(tx => (
                <div key={tx.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Fonds</label>
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
                    <label className="text-xs text-slate-500">Broker</label>
                    <input className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="DEGIRO" value={tx.broker}
                      onChange={e => updateTx(tx.id, { broker: e.target.value })} />
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Datum</label>
                    <input type="date"
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      value={tx.date} onChange={e => updateTx(tx.id, { date: e.target.value })} />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Aantal</label>
                    <input type="number" min={0}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0" value={tx.quantity || ''}
                      onChange={e => updateTx(tx.id, { quantity: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Koers (€)</label>
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
                    Totaal: {nl0.format(tx.quantity * tx.pricePerUnit)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={addTx}
            className={`flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-lg cursor-pointer border-0 ${
              txType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Plus size={13} /> Transactie toevoegen
          </button>
        </div>
      )}

      {/* ── Import ── */}
      {tab === 'import' && (
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
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Voeg posities of transacties toe om het overzicht te zien
            </div>
          ) : (
            <>
              {/* Summary row */}
              {(() => {
                const totalAnnualDiv = data.holdings.reduce((s, h) => {
                  if (!h.dividendPerShareEur || h.quantity <= 0) return s;
                  return s + h.quantity * h.dividendPerShareEur;
                }, 0);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Portefeuillewaarde</p>
                      <p className="text-base font-bold text-purple-700 dark:text-purple-300">{nl0.format(totalCurrentValue)}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Jaarlijks dividend</p>
                      <p className="text-base font-bold text-amber-700 dark:text-amber-300">
                        {totalAnnualDiv > 0 ? nl0.format(totalAnnualDiv) : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Posities</p>
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200">{positions.length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Transacties</p>
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200">{data.transactions.length}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Pie chart */}
              {pieSlices.length > 1 && (
                <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 mb-3">Allocatie per categorie</p>
                  <PieChart slices={pieSlices} size={160} />
                </div>
              )}

              {/* Positions table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                      <th className="text-left py-2 pr-3 font-medium">Naam</th>
                      <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">Broker</th>
                      <th className="text-right py-2 pr-3 font-medium">Aantal</th>
                      <th className="text-right py-2 pr-3 font-medium hidden sm:table-cell">Gem. koers</th>
                      <th className="text-right py-2 pr-3 font-medium">
                        <span className="flex items-center justify-end gap-1">
                          Huidige koers
                          {fetchState === 'loading' && (
                            <RefreshCw size={10} className="animate-spin text-indigo-500" />
                          )}
                        </span>
                      </th>
                      <th className="text-right py-2 pr-3 font-medium hidden md:table-cell">Dividend/jr</th>
                      <th className="text-right py-2 pr-3 font-medium">Rendement</th>
                      <th className="text-right py-2 font-medium">Waarde</th>
                      <th className="py-2 font-medium w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => {
                      const holding = data.holdings.find(hh => hh.name === p.name || hh.ticker === p.ticker);
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
                              const h = data.holdings.find(hh => hh.name === p.name || hh.ticker === p.ticker);
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

                          {/* Rendement */}
                          <td className="py-2.5 pr-3 text-right text-xs">
                            {gainPct !== null ? (
                              <span className={gainPct >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                                {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                                <span className="block font-normal text-slate-400">{nl0.format(gainAbs!)}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Waarde */}
                          <td className="py-2.5 text-right font-semibold text-slate-800">
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
                              title="Positie en alle transacties verwijderen"
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
                      <td colSpan={4} className="py-2.5 font-semibold text-slate-700 dark:text-slate-200 hidden sm:table-cell">Totaal</td>
                      <td colSpan={3} className="py-2.5 font-semibold text-slate-700 dark:text-slate-200 sm:hidden">Totaal</td>
                      <td colSpan={4} className="py-2.5 text-right">
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
    </SectionCard>
  );
}
