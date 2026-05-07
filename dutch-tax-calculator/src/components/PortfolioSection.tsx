import { useState } from 'react';
import {
  TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle,
  LayoutList, RefreshCw, AlertCircle, CheckCircle2, FileUp,
} from 'lucide-react';
import type { PortfolioData, Holding, Transaction, AssetType, TransactionType } from '../types';
import { computePositions } from '../utils/taxCalculations';
import { fetchYahooPrices } from '../utils/priceFetcher';
import CurrencyInput from './CurrencyInput';
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

export default function PortfolioSection({ data, onChange }: Props) {
  const [tab, setTab]               = useState<InnerTab>('holdings');
  const [txType, setTxType]         = useState<TransactionType>('buy');
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchMsg, setFetchMsg]     = useState('');

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

  const handleRefreshPrices = async () => {
    const tickers = data.holdings.map(h => h.ticker).filter(Boolean);
    if (tickers.length === 0) {
      setFetchMsg('Voeg eerst een ticker-symbool toe bij uw posities (bijv. VWCE.AS).');
      setFetchState('error');
      return;
    }
    setFetchState('loading');
    setFetchMsg('');
    try {
      const prices = await fetchYahooPrices(tickers);
      const updated = data.holdings.map(h => {
        const price = h.ticker ? prices[h.ticker] : undefined;
        return price !== undefined ? { ...h, currentPrice: price } : h;
      });
      onChange({ ...data, holdings: updated });
      const found = Object.keys(prices).length;
      setFetchMsg(`${found} van ${tickers.length} koers${tickers.length !== 1 ? 'en' : ''} bijgewerkt.`);
      setFetchState('ok');
    } catch {
      setFetchMsg('Kon koersen niet ophalen. Controleer uw internetverbinding of de ticker-symbolen.');
      setFetchState('error');
    }
  };

  const positions         = computePositions(data.holdings, data.transactions);
  const hasCurrentPrices  = data.holdings.some(h => h.currentPrice > 0);
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

  return (
    <SectionCard title="Beleggingsportefeuille — Live tracking" icon={<TrendingUp size={20} />} accent="border-purple-400">
      {/* Live total banner */}
      {totalCurrentValue > 0 && (
        <div className="mb-4 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Actuele portefeuillewaarde</p>
            <p className="text-xl font-bold text-purple-700">{nl0.format(totalCurrentValue)}</p>
          </div>
          <button
            onClick={handleRefreshPrices}
            disabled={fetchState === 'loading'}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 cursor-pointer border-0 disabled:opacity-60"
          >
            <RefreshCw size={13} className={fetchState === 'loading' ? 'animate-spin' : ''} />
            {fetchState === 'loading' ? 'Ophalen…' : 'Koersen'}
          </button>
        </div>
      )}

      {/* Inner tabs */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden mb-5">
        {INNER_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer border-0 ${
              tab === t.id ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
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
            {totalCurrentValue === 0 && (
              <button onClick={handleRefreshPrices} disabled={fetchState === 'loading'}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 cursor-pointer border-0 shrink-0 disabled:opacity-60"
              >
                <RefreshCw size={13} className={fetchState === 'loading' ? 'animate-spin' : ''} />
                {fetchState === 'loading' ? 'Ophalen…' : 'Koersen bijwerken'}
              </button>
            )}
          </div>

          {fetchMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${
              fetchState === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {fetchState === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {fetchMsg}
            </div>
          )}

          {data.holdings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl mb-3">
              Nog geen posities toegevoegd
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {data.holdings.map(h => (
                <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Naam</label>
                      <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="VWCE" value={h.name}
                        onChange={e => updateHolding(h.id, { name: e.target.value })} />
                    </div>
                    <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Ticker</label>
                      <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                        placeholder="VWCE.AS" value={h.ticker}
                        onChange={e => updateHolding(h.id, { ticker: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Type</label>
                      <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                        value={h.type} onChange={e => updateHolding(h.id, { type: e.target.value as AssetType })}>
                        {(Object.keys(ASSET_LABELS) as AssetType[]).map(k => (
                          <option key={k} value={k}>{ASSET_LABELS[k]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Broker</label>
                      <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="DEGIRO" value={h.broker}
                        onChange={e => updateHolding(h.id, { broker: e.target.value })} />
                    </div>
                    <div className="col-span-4 sm:col-span-1 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Aantal</label>
                      <input type="number" min={0}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="0" value={h.quantity || ''}
                        onChange={e => updateHolding(h.id, { quantity: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-7 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Aankoopkoers (€)</label>
                      <input type="number" min={0}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
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

                  {h.ticker && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      {h.currentPrice > 0 ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle2 size={12} />
                          Huidige koers: <strong>{nl.format(h.currentPrice)}</strong>
                          {h.quantity > 0 && <span className="ml-1 text-slate-500">→ {nl0.format(h.quantity * h.currentPrice)}</span>}
                          {h.pricePerUnit > 0 && h.currentPrice > 0 && (
                            <span className={`ml-2 font-semibold ${h.currentPrice >= h.pricePerUnit ? 'text-green-600' : 'text-red-500'}`}>
                              {h.currentPrice >= h.pricePerUnit ? '▲' : '▼'}{' '}
                              {(((h.currentPrice - h.pricePerUnit) / h.pricePerUnit) * 100).toFixed(1)}%
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">Koers nog niet opgehaald</span>
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

          {/* Debts */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <CurrencyInput label="Beleggingsschulden (Box 3)" hint="Leningen gekoppeld aan beleggingen (drempel €3.700)"
              value={data.investmentDebts} onChange={v => onChange({ ...data, investmentDebts: v })} />
            <CurrencyInput label="DUO studieschuld (Box 3)" hint="Resterende studieschuld DUO"
              value={data.duoDebt} onChange={v => onChange({ ...data, duoDebt: v })} />
          </div>
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
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {type === 'buy' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                {type === 'buy' ? 'Aankopen' : 'Verkopen'}
              </button>
            ))}
          </div>

          {data.transactions.filter(t => t.type === txType).length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl mb-3">
              Geen {txType === 'buy' ? 'aankopen' : 'verkopen'} ingevoerd
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {data.transactions.filter(t => t.type === txType).map(tx => (
                <div key={tx.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Fonds</label>
                    <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="VWCE" value={tx.holdingName}
                      onChange={e => updateTx(tx.id, { holdingName: e.target.value })} />
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Broker</label>
                    <input className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="DEGIRO" value={tx.broker}
                      onChange={e => updateTx(tx.id, { broker: e.target.value })} />
                  </div>
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Datum</label>
                    <input type="date"
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      value={tx.date} onChange={e => updateTx(tx.id, { date: e.target.value })} />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Aantal</label>
                    <input type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0" value={tx.quantity || ''}
                      onChange={e => updateTx(tx.id, { quantity: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Koers (€)</label>
                    <input type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
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
          onImport={newTxs => setTxs([...data.transactions, ...newTxs])}
        />
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              Voeg posities of transacties toe om het overzicht te zien
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Portefeuillewaarde</p>
                  <p className="text-base font-bold text-purple-700">{nl0.format(totalCurrentValue)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Posities</p>
                  <p className="text-base font-bold text-slate-700">{positions.length}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Transacties</p>
                  <p className="text-base font-bold text-slate-700">{data.transactions.length}</p>
                </div>
              </div>

              {/* Pie chart */}
              {pieSlices.length > 1 && (
                <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-3">Allocatie per categorie</p>
                  <PieChart slices={pieSlices} size={160} />
                </div>
              )}

              {/* Positions table with gain/loss */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="text-left py-2 pr-2 font-medium">Naam</th>
                      <th className="text-left py-2 pr-2 font-medium hidden sm:table-cell">Broker</th>
                      <th className="text-right py-2 pr-2 font-medium">Aantal</th>
                      <th className="text-right py-2 pr-2 font-medium hidden sm:table-cell">Gem. koers</th>
                      {hasCurrentPrices && <th className="text-right py-2 pr-2 font-medium">Koers</th>}
                      {hasCurrentPrices && <th className="text-right py-2 pr-2 font-medium">Rendement</th>}
                      <th className="text-right py-2 font-medium">Waarde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => {
                      const gainPct = p.avgCost > 0 && p.currentPrice > 0
                        ? ((p.currentPrice - p.avgCost) / p.avgCost) * 100
                        : null;
                      const gainAbs = gainPct !== null ? p.quantity * (p.currentPrice - p.avgCost) : null;
                      return (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-2 font-medium text-slate-800">
                            <div>{p.name || '—'}</div>
                            {p.ticker && <div className="text-xs text-slate-400 font-mono">{p.ticker}</div>}
                          </td>
                          <td className="py-2.5 pr-2 text-slate-500 text-xs hidden sm:table-cell">{p.broker || '—'}</td>
                          <td className="py-2.5 pr-2 text-right text-slate-700">
                            {p.quantity.toLocaleString('nl-NL', { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-2.5 pr-2 text-right text-slate-500 text-xs hidden sm:table-cell">
                            {nl.format(p.avgCost)}
                          </td>
                          {hasCurrentPrices && (
                            <td className="py-2.5 pr-2 text-right">
                              {p.currentPrice > 0
                                ? <span className="text-green-600 font-medium text-xs">{nl.format(p.currentPrice)}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          )}
                          {hasCurrentPrices && (
                            <td className="py-2.5 pr-2 text-right text-xs">
                              {gainPct !== null ? (
                                <span className={gainPct >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                  {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                                  <br />
                                  <span className="text-slate-400">{nl0.format(gainAbs!)}</span>
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          <td className="py-2.5 text-right font-semibold text-slate-800">{nl0.format(p.currentValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={hasCurrentPrices ? 6 : 4} className="py-2.5 font-semibold text-slate-700 hidden sm:table-cell">Totaal</td>
                      <td colSpan={hasCurrentPrices ? 4 : 2} className="py-2.5 font-semibold text-slate-700 sm:hidden">Totaal</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{nl0.format(totalCurrentValue)}</td>
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
