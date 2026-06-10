import { useState } from 'react';
import { Briefcase, Plus, X } from 'lucide-react';
import type { IncomeData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: IncomeData;
  onChange: (d: IncomeData) => void;
}

interface ToggleField {
  key: keyof IncomeData;
  label: string;
  hint: string;
  tip: string;
  deduction?: boolean;
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function IncomeSection({ data, onChange }: Props) {
  const { t } = useLanguage();
  const OPTIONAL_FIELDS: ToggleField[] = [
    { key: 'freelanceIncome',      label: t.income.freelance,       hint: t.income.freelanceHint,       tip: t.income.freelanceTip },
    { key: 'rentalIncome',         label: t.income.rental,          hint: t.income.rentalHint,          tip: t.income.rentalTip },
    { key: 'otherBox1Income',      label: t.income.otherBox1,       hint: t.income.otherBox1Hint,       tip: t.income.otherBox1Tip },
    { key: 'pensionContributions', label: t.income.pensionContrib,  hint: t.income.pensionContribHint,  tip: t.income.pensionContribTip, deduction: true },
    { key: 'duoLening',            label: t.income.duoLening,       hint: t.income.duoLeningHint,       tip: t.income.duoLeningTip },
  ];

  // Fields with a saved value start active so stored data stays visible
  const [active, setActive] = useState<Set<keyof IncomeData>>(
    () => new Set(OPTIONAL_FIELDS.filter(f => (data[f.key] as number) > 0).map(f => f.key))
  );

  const set = (key: keyof IncomeData) => (v: number) => onChange({ ...data, [key]: v });

  const add = (key: keyof IncomeData) =>
    setActive(prev => new Set(prev).add(key));

  const remove = (key: keyof IncomeData) => {
    setActive(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    onChange({ ...data, [key]: 0 });
  };

  const activeFields   = OPTIONAL_FIELDS.filter(f => active.has(f.key));
  const inactiveFields = OPTIONAL_FIELDS.filter(f => !active.has(f.key));

  // duoLening is a loan (not income) and pension contributions are a deduction
  const totalGross = data.grossSalary + data.freelanceIncome + data.rentalIncome
                   + data.otherBox1Income - data.pensionContributions;

  return (
    <SectionCard title={t.income.sectionTitle} icon={<Briefcase size={20} />}>
      <div className="space-y-5">
        <CurrencyInput
          label={t.income.grossSalary}
          hint={t.income.grossSalaryHint}
          value={data.grossSalary}
          onChange={set('grossSalary')}
          tooltip={<InfoTooltip tip={t.income.grossSalaryTip} />}
        />

        {/* Active optional fields */}
        {activeFields.length > 0 && (
          <div className="space-y-4">
            {activeFields.map(f => (
              <div key={f.key} className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <CurrencyInput
                    label={f.deduction ? `${f.label} (− ${t.income.deductions})` : f.label}
                    hint={f.hint}
                    value={data[f.key] as number}
                    onChange={set(f.key)}
                    tooltip={<InfoTooltip tip={f.tip} />}
                  />
                </div>
                <button
                  onClick={() => remove(f.key)}
                  title={t.income.removeField}
                  className="shrink-0 mb-1 p-1 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 bg-transparent border-0 cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Inactive fields as add-chips */}
        {inactiveFields.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              {t.income.additionalIncome}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inactiveFields.map(f => (
                <button
                  key={f.key}
                  onClick={() => add(f.key)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-full bg-transparent cursor-pointer hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  <Plus size={11} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live ledger footer */}
        <div className="flex items-baseline justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.income.totalGross}</span>
          <span className="font-mono tabular-nums text-sm font-semibold text-slate-800 dark:text-slate-100">
            {nl.format(totalGross)}<span className="text-slate-400 font-normal text-xs">{t.income.perYearShort}</span>
            <span className="text-slate-400 font-normal text-xs mx-1.5">·</span>
            {nl.format(totalGross / 12)}<span className="text-slate-400 font-normal text-xs">{t.income.perMonthShort}</span>
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
