import { ShoppingCart } from 'lucide-react';
import type { ExpensesData } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: ExpensesData;
  onChange: (d: ExpensesData) => void;
}

export default function ExpensesSection({ data, onChange }: Props) {
  const set = (key: keyof ExpensesData) => (v: number) => onChange({ ...data, [key]: v });

  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <SectionCard title="Vaste & variabele kosten (per jaar)" icon={<ShoppingCart size={20} />} accent="border-rose-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput label="Woonlasten (huur/hypotheek)" value={data.housing} onChange={set('housing')} />
        <CurrencyInput label="Boodschappen & eten" value={data.groceries} onChange={set('groceries')} />
        <CurrencyInput label="Energie & water" value={data.utilities} onChange={set('utilities')} />
        <CurrencyInput label="Transport (auto, OV, brandstof)" value={data.transport} onChange={set('transport')} />
        <CurrencyInput label="Verzekeringen" value={data.insurance} onChange={set('insurance')} />
        <CurrencyInput label="Zorgkosten / eigen risico" value={data.healthcare} onChange={set('healthcare')} />
        <CurrencyInput label="Opleiding & abonnementen" value={data.education} onChange={set('education')} />
        <CurrencyInput label="Vrije tijd & entertainment" value={data.leisure} onChange={set('leisure')} />
        <CurrencyInput label="Overige kosten" value={data.other} onChange={set('other')} />
      </div>
      <div className="mt-4 flex justify-between items-center bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
        <span className="text-sm font-medium text-slate-700">Totale jaarkosten</span>
        <span className="text-base font-bold text-rose-600">
          {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(total)}
        </span>
      </div>
    </SectionCard>
  );
}
