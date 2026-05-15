import { useState } from 'react';
import { Briefcase, ChevronDown, ChevronRight } from 'lucide-react';
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
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function IncomeSection({ data, onChange }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<Set<keyof IncomeData>>(new Set());

  const OPTIONAL_FIELDS: ToggleField[] = [
    { key: 'freelanceIncome',      label: t.income.freelance,       hint: t.income.freelanceHint,       tip: 'Netto winst uit uw onderneming (omzet minus zakelijke kosten). Vul de winst vóór inkomstenbelasting in.' },
    { key: 'rentalIncome',         label: t.income.rental,          hint: t.income.rentalHint,          tip: 'Inkomsten uit verhuur van een deel van uw eigen woning (bijv. een kamer). Verhuur van een tweede woning valt in Box 3.' },
    { key: 'otherBox1Income',      label: t.income.otherBox1,       hint: t.income.otherBox1Hint,       tip: 'Andere inkomsten die in Box 1 vallen: AOW, pensioen, WW-uitkering, ziektewet, etc.' },
    { key: 'pensionContributions', label: t.income.pensionContrib,  hint: t.income.pensionContribHint,  tip: 'Betalingen op een lijfrentepolis of bankspaarrekening die u mag aftrekken van uw Box 1 inkomen. Raadpleeg uw jaaropgave.' },
  ];

  const set = (key: keyof IncomeData) => (v: number) => onChange({ ...data, [key]: v });

  const toggle = (key: keyof IncomeData) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        onChange({ ...data, [key]: 0 });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <SectionCard title={t.income.sectionTitle} icon={<Briefcase size={20} />} accent="border-blue-400">
      <div className="space-y-4">
        <CurrencyInput
          label={t.income.grossSalary}
          hint={t.income.grossSalaryHint}
          value={data.grossSalary}
          onChange={set('grossSalary')}
          tooltip={<InfoTooltip tip="Uw totale brutoloon van uw werkgever vóór belastingaftrek en premies. Dit staat op uw loonstrook als 'Bruto loon'." />}
        />

        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {t.income.additionalIncome}
          </p>
          {OPTIONAL_FIELDS.map(f => (
            <div key={f.key} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => toggle(f.key)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800 border-0 cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  {open.has(f.key)
                    ? <ChevronDown size={15} className="text-orange-500" />
                    : <ChevronRight size={15} className="text-slate-400 dark:text-slate-500" />}
                  <span className={open.has(f.key) ? 'font-medium text-slate-800 dark:text-slate-100' : ''}>{f.label}</span>
                </span>
                {(data[f.key] as number) > 0 && (
                  <span className="text-xs font-semibold text-blue-600">
                    {nl.format(data[f.key] as number)}
                  </span>
                )}
              </button>
              {open.has(f.key) && (
                <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
                  <CurrencyInput
                    label={f.label}
                    hint={f.hint}
                    value={data[f.key] as number}
                    onChange={set(f.key)}
                    tooltip={<InfoTooltip tip={f.tip} />}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
