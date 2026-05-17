import { PiggyBank, ShoppingCart } from 'lucide-react';
import type { ExpensesData, SavingsData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: ExpensesData;
  onChange: (d: ExpensesData) => void;
  savings: SavingsData;
  onSavingsChange: (s: SavingsData) => void;
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function ExpensesSection({ data, onChange, savings, onSavingsChange }: Props) {
  const { t } = useLanguage();
  const set = (key: keyof ExpensesData) => (v: number) => onChange({ ...data, [key]: v });

  const FIELDS: { key: keyof ExpensesData; label: string; tip?: string }[] = [
    { key: 'groceries',  label: t.expenses.groceries,  tip: t.expenses.groceriesTooltip },
    { key: 'transport',  label: t.expenses.transport,  tip: t.expenses.transportTooltip },
    { key: 'insurance',  label: t.expenses.insurance,  tip: t.expenses.insuranceTooltip },
    { key: 'healthcare', label: t.expenses.healthcare, tip: t.expenses.healthcareTooltip },
    { key: 'education',  label: t.expenses.education,  tip: t.expenses.educationTooltip },
    { key: 'leisure',    label: t.expenses.leisure,    tip: t.expenses.leisureTooltip },
    { key: 'other',      label: t.expenses.other },
  ];

  const monthlyExpenses = Object.values(data).reduce((a, b) => a + b, 0);
  const monthlyTotal    = monthlyExpenses + savings.monthlySavingsContribution + savings.maandelijksBeleggen;
  const yearlyTotal     = monthlyTotal * 12;

  return (
    <div className="space-y-4">
      <SectionCard title={t.expenses.sectionTitle} icon={<ShoppingCart size={20} />} accent="border-rose-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <CurrencyInput key={f.key} label={f.label} value={data[f.key]} onChange={set(f.key)}
              tooltip={f.tip ? <InfoTooltip tip={f.tip} /> : undefined}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3 border border-rose-100 dark:border-rose-800">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.expenses.monthlyTotal}</span>
            <span className="text-base font-bold text-rose-600">{nl.format(monthlyExpenses)}</span>
          </div>
          <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3 border border-rose-100 dark:border-rose-800">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.expenses.yearlyTotal}</span>
            <span className="text-base font-bold text-rose-700">{nl.format(monthlyExpenses * 12)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t.expenses.savingsTitle} icon={<PiggyBank size={20} />} accent="border-emerald-400">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {t.expenses.savingsContribDesc}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label={t.expenses.monthlySavings}
            hint={t.expenses.monthlySavingsHint}
            value={savings.monthlySavingsContribution}
            onChange={v => onSavingsChange({ ...savings, monthlySavingsContribution: v })}
            suffix="/mnd"
            tooltip={<InfoTooltip tip={t.expenses.monthlySavingsTip} />}
          />
          <CurrencyInput
            label={t.expenses.monthlyInvest}
            hint={t.expenses.monthlyInvestHint}
            value={savings.maandelijksBeleggen}
            onChange={v => onSavingsChange({ ...savings, maandelijksBeleggen: v })}
            suffix="/mnd"
            tooltip={<InfoTooltip tip={t.expenses.monthlyInvestTip} />}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.expenses.savingsPerMonth}</p>
            <p className="text-base font-bold text-emerald-700">{nl.format(savings.monthlySavingsContribution)}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.expenses.investPerMonth}</p>
            <p className="text-base font-bold text-purple-700">{nl.format(savings.maandelijksBeleggen)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.expenses.totalOutPerYear}</p>
            <p className="text-base font-bold text-slate-700 dark:text-slate-200">{nl.format(yearlyTotal)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
