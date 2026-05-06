import { useState } from 'react';
import { TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, LayoutList } from 'lucide-react';
import type { PortfolioData, Holding, Transaction, AssetType, TransactionType } from '../types';
import { computePositions } from '../utils/taxCalculations';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import PieChart from './PieChart';

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

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Tab = 'holdings' | 'transactions' | 'overview';

export default function PortfolioSection({ data, onChange }: Props) {
  const [tab, setTab]     = useState<Tab>('holdings');
  const [txType, setTxType] = useState<TransactionType>('buy');

  const setHoldings = (holdings: Holding[])     => onChange({ ...data, holdings });
  const setTxs      = (transactions: Transaction[]) => onChange({ ...data, transactions });

  const addHolding = () =>
    setHoldings([...data.holdings, { id: uid(), name: '', type: 'etf', valueJan1: 0, quantity: 0, pricePerUnit: 0, broker: '' }]);
  const removeHolding = (id: string) => setHoldings(data.holdings.filter(h => h.id !== id));
  const updateHolding = (id: string, p: Partial<Holding>) =>
    setHoldings(data.holdings.map(h => h.id === id ? { ...h, ...p } : h));

  const addTx = () =>
    setTxs([...data.transactions, { id: uid(), holdingName: '', type: txType, date: new Date().toISOString().split('T')[0], quantity: 0, pricePerUnit: 0, broker: '' }]);
  const removeTx = (id: string) => setTxs(data.transactions.filter(t => t.id !== id));
  const updateTx = (id: string, p: Partial<Transaction>) =>
    setTxs(data.transactions.map(t => t.id === id ? { ...t, ...p } : t));

  const positions = computePositions(data.holdings, data.transactions);

  // Pie chart slices grouped by asset type
  const pieSlices = Object.entries(
    positions.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] ?? 0) + p.currentValue;
      return acc;
    }, {} as Record<AssetType, number>)
  ).map(([type, value]) => ({
    label: ASSET_LABELS[type as AssetType],
    value,
    color: ASSET_COLORS[type as AssetType],
  }));

  const hasMultiple = pieSlices.length > 1;

  const TABS = [
    { id: 'holdings' as Tab,     label: 'Posities 1 jan', icon: <TrendingUp size={13} /> },
    { id: 'transactions' as Tab, label: 'Transacties',    icon: <ArrowUpCircle size={13} /> },
    { id: 'overview' as Tab,     label: 'Overzicht',      icon: <LayoutList size={13} /> },
  ];

  return (
    <SectionCard title="Beleggingsportefeuille — Box 3" icon={<TrendingUp size={20} />} accent="border-purple-400">
      {/* Inner tab bar */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer border-0 ${
              tab === t.id ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Holdings tab */}
      {tab === 'holdings' && (
        <div>
          <p className="text-xs text-slate-500 mb-3">
            Waarde op <strong>1 januari</strong> — dit is de peildatum voor Box 3.
            Fictief rendement overige bezittingen: <strong>5,88%</strong> (2025).
          </p>
          {data.holdings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl mb-3">
              Nog geen posities toegevoegd
            </div>
          ) : (
            <div className="space-y-3 mb-3">
              {data.holdings.map(h => (
                <div key={h.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {/* Name */}
                  <div className="col-span-12 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Naam</label>
                    <input
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="VWCE"
                      value={h.name}
                      onChange={e => updateHolding(h.id, { name: e.target.value })}
                    />
                  </div>
                  {/* Type */}
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Type</label>
                    <select
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      value={h.type}
                      onChange={e => updateHolding(h.id, { type: e.target.value as AssetType })}
                    >
                      {(Object.keys(ASSET_LABELS) as AssetType[]).map(k => (
                        <option key={k} value={k}>{ASSET_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  {/* Broker */}
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Broker</label>
                    <input
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="DEGIRO"
                      value={h.broker}
                      onChange={e => updateHolding(h.id, { broker: e.target.value })}
                    />
                  </div>
                  {/* Qty */}
                  <div className="col-span-4 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Aantal</label>
                    <input
                      type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="0"
                      value={h.quantity || ''}
                      onChange={e => updateHolding(h.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {/* Price */}
                  <div className="col-span-4 sm:col-span-1 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Koers €</label>
                    <input
                      type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="0"
                      value={h.pricePerUnit || ''}
                      onChange={e => updateHolding(h.id, { pricePerUnit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {/* Value Jan 1 */}
                  <div className="col-span-3 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Waarde 1 jan €</label>
                    <input
                      type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="0"
                      value={h.valueJan1 || ''}
                      onChange={e => updateHolding(h.id, { valueJan1: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 flex items-end justify-center">
                    <button onClick={() => removeHolding(h.id)} className="text-red-400 hover:text-red-600 transition-colors p-1 bg-transparent border-0 cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={addHolding}
            className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors cursor-pointer border-0"
          >
            <Plus size={13} /> Positie toevoegen
          </button>

          {/* Debts */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <CurrencyInput
              label="Beleggingsschulden (Box 3)"
              hint="Leningen gekoppeld aan beleggingen (drempel €3.400)"
              value={data.investmentDebts}
              onChange={v => onChange({ ...data, investmentDebts: v })}
            />
            <CurrencyInput
              label="DUO studieschuld (Box 3)"
              hint="Resterende studieschuld DUO (telt mee als Box 3 schuld)"
              value={data.duoDebt}
              onChange={v => onChange({ ...data, duoDebt: v })}
            />
          </div>
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <div>
          <div className="flex gap-1 mb-4">
            {(['buy', 'sell'] as TransactionType[]).map(type => (
              <button
                key={type}
                onClick={() => setTxType(type)}
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
                  {/* Holding name */}
                  <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Fonds</label>
                    <input
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="VWCE"
                      value={tx.holdingName}
                      onChange={e => updateTx(tx.id, { holdingName: e.target.value })}
                    />
                  </div>
                  {/* Broker */}
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Broker</label>
                    <input
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="DEGIRO"
                      value={tx.broker}
                      onChange={e => updateTx(tx.id, { broker: e.target.value })}
                    />
                  </div>
                  {/* Date */}
                  <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Datum</label>
                    <input
                      type="date"
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      value={tx.date}
                      onChange={e => updateTx(tx.id, { date: e.target.value })}
                    />
                  </div>
                  {/* Quantity */}
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Aantal</label>
                    <input
                      type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0"
                      value={tx.quantity || ''}
                      onChange={e => updateTx(tx.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {/* Price */}
                  <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Koers €</label>
                    <input
                      type="number" min={0}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0"
                      value={tx.pricePerUnit || ''}
                      onChange={e => updateTx(tx.id, { pricePerUnit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 flex items-end justify-center">
                    <button onClick={() => removeTx(tx.id)} className="text-red-400 hover:text-red-600 transition-colors p-1 bg-transparent border-0 cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="col-span-12 text-right text-xs text-slate-500">
                    Totaal: {nl.format(tx.quantity * tx.pricePerUnit)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={addTx}
            className={`flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${
              txType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Plus size={13} /> Transactie toevoegen
          </button>
        </div>
      )}

      {/* Overview tab — built from transactions */}
      {tab === 'overview' && (
        <div>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              Voeg posities of transacties toe om het overzicht te zien
            </div>
          ) : (
            <>
              {hasMultiple && (
                <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-3">Allocatie per categorie</p>
                  <PieChart slices={pieSlices} size={160} />
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="text-left py-2 pr-3 font-medium">Naam</th>
                      <th className="text-left py-2 pr-3 font-medium">Type</th>
                      <th className="text-left py-2 pr-3 font-medium">Broker</th>
                      <th className="text-right py-2 pr-3 font-medium">Aantal</th>
                      <th className="text-right py-2 pr-3 font-medium">Gem. koers</th>
                      <th className="text-right py-2 font-medium">Waarde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-slate-800">{p.name || '—'}</td>
                        <td className="py-2.5 pr-3">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: ASSET_COLORS[p.type] }} />
                            <span className="text-slate-600">{ASSET_LABELS[p.type]}</span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500">{p.broker || '—'}</td>
                        <td className="py-2.5 pr-3 text-right text-slate-700">
                          {p.quantity.toLocaleString('nl-NL', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-slate-700">{nl.format(p.avgCost)}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-800">{nl.format(p.currentValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={5} className="py-2.5 font-semibold text-slate-700">Totaal</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {nl.format(positions.reduce((s, p) => s + p.currentValue, 0))}
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
