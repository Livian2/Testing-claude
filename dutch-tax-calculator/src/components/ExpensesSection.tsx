import { ShoppingCart } from 'lucide-react';
import type { ExpensesData } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: ExpensesData;
  onChange: (d: ExpensesData) => void;
}

const FIELDS: { key: keyof ExpensesData; label: string }[] = [
  { key: 'groceries',  label: 'Boodschappen & eten' },
  { key: 'transport',  label: 'Transport (auto, OV, brandstof)' },
  { key: 'insurance',  label: 'Verzekeringen' },
  { key: 'healthcare', label: 'Zorgkosten / eigen risico' },
  { key: 'education',  label: 'Opleiding & abonnementen' },
  { key: 'leisure',    label: 'Vrije tijd & entertainment' },
  { key: 'other',      label: 'Overige kosten' },
];

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function ExpensesSection({ data, onChange }: Props) {
  const set = (key: keyof ExpensesData) => (v: number) => onChange({ ...data, [key]: v });

  const monthlyTotal = Object.values(data).reduce((a, b) => a + b, 0);
  const yearlyTotal  = monthlyTotal * 12;

  return (
    <SectionCard title="Vaste & variabele kosten — per maand" icon={<ShoppingCart size={20} />} accent="border-rose-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <CurrencyInput key={f.key} label={f.label} value={data[f.key]} onChange={set(f.key)} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex justify-between items-center bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
          <span className="text-sm font-medium text-slate-700">Per maand</span>
          <span className="text-base font-bold text-rose-600">{nl.format(monthlyTotal)}</span>
        </div>
        <div className="flex justify-between items-center bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
          <span className="text-sm font-medium text-slate-700">Per jaar</span>
          <span className="text-base font-bold text-rose-700">{nl.format(yearlyTotal)}</span>
        </div>
      </div>
    </SectionCard>
  );
}
