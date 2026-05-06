import { useState } from 'react';
import { TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { PortfolioData, Holding, Transaction, AssetType, TransactionType } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: PortfolioData;
  onChange: (d: PortfolioData) => void;
}

const ASSET_LABELS: Record<AssetType, string> = {
  savings:    'Spaarrekening',
  stocks:     'Aandelen',
  etf:        'ETF / Indexfonds',
  bonds:      'Obligaties',
  realEstate: 'Vastgoed',
  crypto:     'Crypto',
  other:      'Overig',
};

function uid() { return Math.random().toString(36).slice(2); }

const emptyHolding = (): Holding => ({
  id: uid(), name: '', type: 'etf', valueJan1: 0, quantity: 0, pricePerUnit: 0,
});

const emptyTx = (): Transaction => ({
  id: uid(), holdingName: '', type: 'buy', date: new Date().toISOString().split('T')[0],
  quantity: 0, pricePerUnit: 0,
});

export default function PortfolioSection({ data, onChange }: Props) {
  const [txTab, setTxTab] = useState<TransactionType>('buy');

  const setHoldings = (holdings: Holding[]) => onChange({ ...data, holdings });
  const setTxs      = (transactions: Transaction[]) => onChange({ ...data, transactions });

  const addHolding = () => setHoldings([...data.holdings, emptyHolding()]);
  const removeHolding = (id: string) => setHoldings(data.holdings.filter(h => h.id !== id));
  const updateHolding = (id: string, patch: Partial<Holding>) =>
    setHoldings(data.holdings.map(h => h.id === id ? { ...h, ...patch } : h));

  const addTx = () => setTxs([...data.transactions, { ...emptyTx(), type: txTab }]);
  const removeTx = (id: string) => setTxs(data.transactions.filter(t => t.id !== id));
  const updateTx = (id: string, patch: Partial<Transaction>) =>
    setTxs(data.transactions.map(t => t.id === id ? { ...t, ...patch } : t));

  const buys  = data.transactions.filter(t => t.type === 'buy');
  const sells = data.transactions.filter(t => t.type === 'sell');

  return (
    <SectionCard title="Beleggingsportefeuille — Box 3" icon={<TrendingUp size={20} />} accent="border-purple-400">
      {/* Holdings */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Huidige posities (waarde op 1 januari)</h3>
          <button
            onClick={addHolding}
            className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={13} /> Positie toevoegen
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Voor Box 3 telt de waarde op <strong>1 januari</strong>. Fictief rendement overige bezittingen: <strong>5,88%</strong> (2025).
        </p>

        {data.holdings.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
            Nog geen posities toegevoegd
          </div>
        ) : (
          <div className="space-y-3">
            {data.holdings.map(h => (
              <div key={h.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
                {/* Name */}
                <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Naam</label>
                  <input
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="bijv. VWCE"
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
                {/* Qty */}
                <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
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
                <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Koers (€)</label>
                  <input
                    type="number" min={0}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="0"
                    value={h.pricePerUnit || ''}
                    onChange={e => updateHolding(h.id, { pricePerUnit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {/* Value Jan 1 */}
                <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Waarde 1 jan (€)</label>
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
                  <button onClick={() => removeHolding(h.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debts */}
      <div className="mb-6">
        <CurrencyInput
          label="Beleggingsschulden (Box 3)"
          hint="Leningen die direct verband houden met uw beleggingen (drempel €3.400)"
          value={data.investmentDebts}
          onChange={v => onChange({ ...data, investmentDebts: v })}
        />
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Transacties dit jaar</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setTxTab('buy')}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-l-lg border transition-colors ${txTab === 'buy' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-green-50'}`}
            >
              <ArrowUpCircle size={13} /> Aankopen
            </button>
            <button
              onClick={() => setTxTab('sell')}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-r-lg border transition-colors ${txTab === 'sell' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-red-50'}`}
            >
              <ArrowDownCircle size={13} /> Verkopen
            </button>
          </div>
        </div>

        {txTab === 'buy' && (
          <TransactionList
            transactions={buys}
            onAdd={addTx}
            onRemove={removeTx}
            onUpdate={updateTx}
            type="buy"
          />
        )}
        {txTab === 'sell' && (
          <TransactionList
            transactions={sells}
            onAdd={addTx}
            onRemove={removeTx}
            onUpdate={updateTx}
            type="sell"
          />
        )}
      </div>
    </SectionCard>
  );
}

function TransactionList({
  transactions, onAdd, onRemove, onUpdate, type,
}: {
  transactions: Transaction[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Transaction>) => void;
  type: TransactionType;
}) {
  const color = type === 'buy' ? 'green' : 'red';
  return (
    <div>
      <button
        onClick={onAdd}
        className={`flex items-center gap-1 text-xs bg-${color}-600 text-white px-3 py-1.5 rounded-lg hover:bg-${color}-700 transition-colors mb-3`}
      >
        <Plus size={13} /> Transactie toevoegen
      </button>
      {transactions.length === 0 ? (
        <div className="text-center py-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          Geen {type === 'buy' ? 'aankopen' : 'verkopen'} ingevoerd
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Fonds / aandeel</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="bijv. VWCE"
                  value={tx.holdingName}
                  onChange={e => onUpdate(tx.id, { holdingName: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Datum</label>
                <input
                  type="date"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                  value={tx.date}
                  onChange={e => onUpdate(tx.id, { date: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Aantal</label>
                <input
                  type="number" min={0}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="0"
                  value={tx.quantity || ''}
                  onChange={e => onUpdate(tx.id, { quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-5 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Koers (€)</label>
                <input
                  type="number" min={0}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="0"
                  value={tx.pricePerUnit || ''}
                  onChange={e => onUpdate(tx.id, { pricePerUnit: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-1 flex items-end justify-center">
                <button onClick={() => onRemove(tx.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="col-span-12 text-right text-xs text-slate-500">
                Totaal: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(tx.quantity * tx.pricePerUnit)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
