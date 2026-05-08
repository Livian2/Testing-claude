import { PiggyBank, ShoppingCart } from 'lucide-react';
import type { ExpensesData, SavingsData } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: ExpensesData;
  onChange: (d: ExpensesData) => void;
  savings: SavingsData;
  onSavingsChange: (s: SavingsData) => void;
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

export default function ExpensesSection({ data, onChange, savings, onSavingsChange }: Props) {
  const set = (key: keyof ExpensesData) => (v: number) => onChange({ ...data, [key]: v });

  const monthlyExpenses = Object.values(data).reduce((a, b) => a + b, 0);
  const monthlyTotal    = monthlyExpenses + savings.monthlySavingsContribution + savings.maandelijksBeleggen;
  const yearlyTotal     = monthlyTotal * 12;

  return (
    <div className="space-y-4">
      <SectionCard title="Vaste & variabele kosten — per maand" icon={<ShoppingCart size={20} />} accent="border-rose-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <CurrencyInput key={f.key} label={f.label} value={data[f.key]} onChange={set(f.key)} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex justify-between items-center bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
            <span className="text-sm font-medium text-slate-700">Kosten per maand</span>
            <span className="text-base font-bold text-rose-600">{nl.format(monthlyExpenses)}</span>
          </div>
          <div className="flex justify-between items-center bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
            <span className="text-sm font-medium text-slate-700">Kosten per jaar</span>
            <span className="text-base font-bold text-rose-700">{nl.format(monthlyExpenses * 12)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Maandelijkse bijdragen — Sparen & Beleggen" icon={<PiggyBank size={20} />} accent="border-emerald-400">
        <p className="text-xs text-slate-500 mb-4">
          Deze bijdragen worden ook gebruikt in de <strong>Prognose</strong> om uw toekomstig vermogen te berekenen.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Maandelijkse spaarbijdrage"
            hint="Overschrijving naar spaarrekening"
            value={savings.monthlySavingsContribution}
            onChange={v => onSavingsChange({ ...savings, monthlySavingsContribution: v })}
            suffix="/mnd"
          />
          <CurrencyInput
            label="Maandelijkse beleggingsbijdrage"
            hint="Inleg in beleggingsportefeuille"
            value={savings.maandelijksBeleggen}
            onChange={v => onSavingsChange({ ...savings, maandelijksBeleggen: v })}
            suffix="/mnd"
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500">Sparen/mnd</p>
            <p className="text-base font-bold text-emerald-700">{nl.format(savings.monthlySavingsContribution)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500">Beleggen/mnd</p>
            <p className="text-base font-bold text-purple-700">{nl.format(savings.maandelijksBeleggen)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500">Totaal uitgaand/jr</p>
            <p className="text-base font-bold text-slate-700">{nl.format(yearlyTotal)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
