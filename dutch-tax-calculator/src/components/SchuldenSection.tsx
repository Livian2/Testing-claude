import { useState } from 'react';
import { CreditCard, Plus, Trash2, ChevronDown, ChevronRight, GraduationCap, TrendingDown } from 'lucide-react';
import type { SchuldenData, SchuldItem } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: SchuldenData;
  taxYear: number;
  onChange: (d: SchuldenData) => void;
}

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function uid() { return Math.random().toString(36).slice(2); }

const DEFAULT_SCHULD: Omit<SchuldItem, 'id' | 'label'> = {
  bedrag: 0, rentePercentage: 0, looptijd: 15, rentevastePeriode: 5, startJaar: 2020,
};

interface SchuldCardProps {
  item: SchuldItem;
  taxYear: number;
  onUpdate: (p: Partial<SchuldItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
  accent: string;
  isDuo?: boolean;
}

function SchuldCard({ item, taxYear, onUpdate, onRemove, canRemove, accent, isDuo }: SchuldCardProps) {
  const [open, setOpen] = useState(true);

  const jaarRente      = item.bedrag * (item.rentePercentage / 100);
  const maandRente     = jaarRente / 12;
  const eindeVast      = item.startJaar + item.rentevastePeriode;
  const eindeLooptijd  = item.startJaar + item.looptijd;
  const jarenResterend = Math.max(0, eindeLooptijd - taxYear);

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${accent}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white bg-opacity-60">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800 bg-transparent border-0 cursor-pointer p-0"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {item.label || 'Schuld'}
          {item.bedrag > 0 && (
            <span className="text-xs font-normal text-slate-500 ml-1">{nl.format(item.bedrag)}</span>
          )}
        </button>
        {canRemove && (
          <button onClick={onRemove}
            className="text-red-400 hover:text-red-600 bg-transparent border-0 cursor-pointer p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Naam / omschrijving</label>
              <input
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="bijv. DUO studieschuld"
                value={item.label}
                onChange={e => onUpdate({ label: e.target.value })}
              />
            </div>
            <CurrencyInput
              label="Restschuld (Box 3 waarde)"
              hint="Uitstaand saldo op 1 januari"
              value={item.bedrag}
              onChange={v => onUpdate({ bedrag: v })}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isDuo && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-slate-500">Aflossing start (jr) <span className="text-slate-400 font-normal">— optioneel (DUO grace period)</span></label>
                <input
                  type="number" min={1990} max={2100}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={String(item.startJaar)}
                  value={item.aflossingsStartJaar || ''}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    onUpdate({ aflossingsStartJaar: isNaN(v) ? undefined : v });
                  }}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Rente (%)</label>
              <input
                type="number" min={0} max={20} step={0.01}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="2.5"
                value={item.rentePercentage || ''}
                onChange={e => onUpdate({ rentePercentage: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Looptijd (jr)</label>
              <input
                type="number" min={1} max={50}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="15"
                value={item.looptijd || ''}
                onChange={e => onUpdate({ looptijd: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Rentevaste periode (jr)</label>
              <input
                type="number" min={1} max={30}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="5"
                value={item.rentevastePeriode || ''}
                onChange={e => onUpdate({ rentevastePeriode: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Startjaar</label>
              <input
                type="number" min={1990} max={2050}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="2020"
                value={item.startJaar || ''}
                onChange={e => onUpdate({ startJaar: parseInt(e.target.value) || 2020 })}
              />
            </div>
          </div>

          {/* Summary */}
          {item.bedrag > 0 && item.rentePercentage > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Jaarlijkse rente</p>
                <p className="font-bold text-red-800">{nl2.format(jaarRente)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Maandelijkse rente</p>
                <p className="font-bold text-red-700">{nl2.format(maandRente)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Rente vast t/m</p>
                <p className="font-bold text-slate-700">{eindeVast}</p>
                <p className="text-xs text-slate-400">{Math.max(0, eindeVast - taxYear)} jaar resterend</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Aflossing voltooid</p>
                <p className="font-bold text-slate-700">{eindeLooptijd}</p>
                <p className="text-xs text-slate-400">{jarenResterend} jaar resterend</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DebtGroupProps {
  title: string;
  icon: React.ReactNode;
  items: SchuldItem[];
  taxYear: number;
  accent: string;
  buttonColor: string;
  isDuo?: boolean;
  onAdd: () => void;
  onUpdate: (id: string, p: Partial<SchuldItem>) => void;
  onRemove: (id: string) => void;
}

function DebtGroup({ title, icon, items, taxYear, accent, buttonColor, isDuo, onAdd, onUpdate, onRemove }: DebtGroupProps) {
  const totaal = items.reduce((s, d) => s + d.bedrag, 0);
  const totaalRente = items.reduce((s, d) => s + d.bedrag * (d.rentePercentage / 100), 0);

  return (
    <SectionCard title={title} icon={icon} accent={accent}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-5 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
            Geen schulden toegevoegd
          </div>
        ) : (
          items.map(item => (
            <SchuldCard
              key={item.id}
              item={item}
              taxYear={taxYear}
              accent="border-red-100"
              isDuo={isDuo}
              onUpdate={p => onUpdate(item.id, p)}
              onRemove={() => onRemove(item.id)}
              canRemove={true}
            />
          ))
        )}

        <button
          onClick={onAdd}
          className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
        >
          <Plus size={13} /> Schuld toevoegen
        </button>

        {items.length > 0 && totaal > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <p className="text-xs text-slate-500">Totale restschuld (Box 3)</p>
              <p className="text-base font-bold text-red-800">{nl.format(totaal)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <p className="text-xs text-slate-500">Totale jaarlijkse rente</p>
              <p className="text-base font-bold text-red-700">{nl2.format(totaalRente)}</p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default function SchuldenSection({ data, taxYear, onChange }: Props) {
  const totalDebts = [...data.duo, ...data.beleggingen].reduce((s, d) => s + d.bedrag, 0);
  const totalRente = [...data.duo, ...data.beleggingen].reduce((s, d) => s + d.bedrag * (d.rentePercentage / 100), 0);
  const box3Debts  = Math.max(0, totalDebts - 3700);

  return (
    <div className="space-y-4">
      <DebtGroup
        title="DUO studieschuld"
        icon={<GraduationCap size={20} />}
        items={data.duo}
        taxYear={taxYear}
        accent="border-blue-400"
        buttonColor="bg-blue-600 hover:bg-blue-700"
        isDuo={true}
        onAdd={() => onChange({
          ...data,
          duo: [...data.duo, { ...DEFAULT_SCHULD, id: uid(), label: `DUO schuld ${data.duo.length + 1}`, rentePercentage: 2.56, looptijd: 35 }],
        })}
        onUpdate={(id, p) => onChange({ ...data, duo: data.duo.map(d => d.id === id ? { ...d, ...p } : d) })}
        onRemove={id => onChange({ ...data, duo: data.duo.filter(d => d.id !== id) })}
      />

      <DebtGroup
        title="Beleggingsschulden"
        icon={<TrendingDown size={20} />}
        items={data.beleggingen}
        taxYear={taxYear}
        accent="border-orange-400"
        buttonColor="bg-orange-600 hover:bg-orange-700"
        onAdd={() => onChange({
          ...data,
          beleggingen: [...data.beleggingen, { ...DEFAULT_SCHULD, id: uid(), label: `Beleggingsschuld ${data.beleggingen.length + 1}` }],
        })}
        onUpdate={(id, p) => onChange({ ...data, beleggingen: data.beleggingen.map(d => d.id === id ? { ...d, ...p } : d) })}
        onRemove={id => onChange({ ...data, beleggingen: data.beleggingen.filter(d => d.id !== id) })}
      />

      {/* Box 3 summary */}
      {totalDebts > 0 && (
        <SectionCard title="Schulden samenvatting — Box 3" icon={<CreditCard size={20} />} accent="border-red-400">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Totale schulden</p>
              <p className="text-base font-bold text-slate-800">{nl.format(totalDebts)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Drempel Box 3</p>
              <p className="text-base font-bold text-slate-500">– {nl.format(3700)}</p>
            </div>
            <div className="bg-red-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Aftrekbaar Box 3</p>
              <p className="text-base font-bold text-red-700">{nl.format(box3Debts)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Totale jaarrente</p>
              <p className="text-base font-bold text-orange-700">{nl2.format(totalRente)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Schulden verlagen uw Box 3 vermogen. De eerste €3.700 per persoon is niet aftrekbaar (drempel).
            Fictief rendement op schulden: <strong>2,62%</strong> (2026).
          </p>
        </SectionCard>
      )}
    </div>
  );
}
