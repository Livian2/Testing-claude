import { useState } from 'react';
import { PiggyBank, ShoppingCart, BarChart2 } from 'lucide-react';
import type { ExpensesData, SavingsData, WoonData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';
import BankImportTab from './BankImportTab';

interface Props {
  data: ExpensesData;
  onChange: (d: ExpensesData) => void;
  savings: SavingsData;
  onSavingsChange: (s: SavingsData) => void;
  woon: WoonData;
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Tab = 'budget' | 'werkelijk';

export default function ExpensesSection({ data, onChange, savings, onSavingsChange, woon }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('budget');
  const [hovered, setHovered] = useState<keyof ExpensesData | null>(null);
  const set = (key: keyof ExpensesData) => (v: number) => onChange({ ...data, [key]: v });

  const FIELDS: { key: keyof ExpensesData; label: string; tip?: string }[] = [
    { key: 'groceries',  label: t.expenses.groceries,  tip: t.expenses.groceriesTooltip },
    { key: 'transport',  label: t.expenses.transport,  tip: t.expenses.transportTooltip },
    { key: 'insurance',  label: t.expenses.insurance,  tip: t.expenses.insuranceTooltip },
    { key: 'healthcare', label: t.expenses.healthcare, tip: t.expenses.healthcareTooltip },
    { key: 'education',  label: t.expenses.education,  tip: t.expenses.educationTooltip },
    { key: 'leisure',    label: t.expenses.leisure,    tip: t.expenses.leisureTooltip },
    { key: 'phone',      label: t.expenses.phone },
    { key: 'other',      label: t.expenses.other },
  ];

  const monthlyExpenses = Object.values(data).reduce((a, b) => a + b, 0);
  const monthlyTotal    = monthlyExpenses + savings.monthlySavingsContribution + savings.maandelijksBeleggen;
  const yearlyTotal     = monthlyTotal * 12;

  const segments = FIELDS
    .map(f => ({ ...f, value: data[f.key] }))
    .filter(s => s.value > 0);
  const hoveredSeg = segments.find(s => s.key === hovered) ?? null;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'budget',    label: t.expenses.budgetTab,    icon: <ShoppingCart size={14} /> },
    { key: 'werkelijk', label: t.expenses.werkelijkTab, icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab switcher — underline style, consistent with the app header */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-3 py-2 -mb-px text-sm bg-transparent border-x-0 border-t-0 border-b-2 cursor-pointer transition-colors
              ${tab === tb.key
                ? 'border-amber-500 text-amber-700 dark:text-amber-400 font-medium'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'budget' && (
        <>
          <SectionCard title={t.expenses.sectionTitle} icon={<ShoppingCart size={20} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {FIELDS.map(f => (
                <div
                  key={f.key}
                  onMouseEnter={() => setHovered(f.key)}
                  onMouseLeave={() => setHovered(null)}
                  className={`transition-opacity ${hovered !== null && hovered !== f.key ? 'opacity-40' : ''}`}
                >
                  <CurrencyInput label={f.label} value={data[f.key]} onChange={set(f.key)}
                    suffix="/mnd"
                    tooltip={f.tip ? <InfoTooltip tip={f.tip} /> : undefined}
                  />
                </div>
              ))}
            </div>

            {/* Allocation bar — hover a segment (or an input above) to inspect */}
            {monthlyExpenses > 0 && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t.expenses.allocation}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                    {hoveredSeg
                      ? `${hoveredSeg.label} · ${nl.format(hoveredSeg.value)} · ${Math.round(hoveredSeg.value / monthlyExpenses * 100)}%`
                      : t.expenses.hoverHint}
                  </span>
                </div>
                <div className="flex h-3 rounded-sm overflow-hidden">
                  {segments.map((s, i) => (
                    <div
                      key={s.key}
                      onMouseEnter={() => setHovered(s.key)}
                      onMouseLeave={() => setHovered(null)}
                      className="h-full transition-colors cursor-default"
                      style={{
                        width: `${(s.value / monthlyExpenses) * 100}%`,
                        background: hovered === s.key
                          ? '#f59e0b'
                          : i % 2 === 0 ? 'rgba(100,116,139,0.55)' : 'rgba(100,116,139,0.3)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ledger totals */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">{t.expenses.monthlyTotal}</span>
                <span className="font-mono tabular-nums text-sm font-semibold text-slate-800 dark:text-slate-100">{nl.format(monthlyExpenses)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">{t.expenses.yearlyTotal}</span>
                <span className="font-mono tabular-nums text-sm text-slate-500 dark:text-slate-400">{nl.format(monthlyExpenses * 12)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t.expenses.savingsTitle} icon={<PiggyBank size={20} />}>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              {t.expenses.savingsContribDesc}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
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
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-baseline justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.expenses.totalOutPerYear}</span>
              <span className="font-mono tabular-nums text-sm font-semibold text-slate-800 dark:text-slate-100">{nl.format(yearlyTotal)}</span>
            </div>
          </SectionCard>
        </>
      )}

      {tab === 'werkelijk' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={16} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.expenses.werkelijkTab}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">— {t.expenses.importSubtitle}</span>
          </div>
          <BankImportTab expenses={data} savings={savings} woon={woon} />
        </div>
      )}
    </div>
  );
}
