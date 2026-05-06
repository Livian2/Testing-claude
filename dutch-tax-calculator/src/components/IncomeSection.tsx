import { useState } from 'react';
import { Briefcase, ChevronDown, ChevronRight, Home } from 'lucide-react';
import type { IncomeData, PersonalData, LivingType } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: IncomeData;
  personal: PersonalData;
  onChange: (d: IncomeData) => void;
  onPersonalChange: (d: PersonalData) => void;
}

interface ToggleField {
  key: keyof IncomeData;
  label: string;
  hint: string;
}

const OPTIONAL_FIELDS: ToggleField[] = [
  { key: 'freelanceIncome',           label: 'Freelance / ZZP inkomen',       hint: 'Netto winst uit onderneming' },
  { key: 'rentalIncome',              label: 'Huurinkomsten (Box 1)',          hint: 'Bijv. kamer verhuur eigen woning' },
  { key: 'otherBox1Income',           label: 'Overig Box 1 inkomen',           hint: 'AOW, pensioen, uitkering, etc.' },
  { key: 'mortgageInterestDeduction', label: 'Hypotheekrente aftrek',          hint: 'Betaalde rente eigen woning hypotheek' },
  { key: 'pensionContributions',      label: 'Lijfrentepremies (aftrekbaar)',  hint: 'Storting op lijfrentepolis of banksparen' },
];

const LIVING_OPTIONS: { value: LivingType; label: string; desc: string }[] = [
  { value: 'huur',   label: 'Huurwoning',   desc: 'U huurt uw woning' },
  { value: 'koop',   label: 'Koopwoning',   desc: 'U heeft een eigen woning' },
  { value: 'anders', label: 'Anders',        desc: 'Bijv. inwonend of anders' },
];

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function IncomeSection({ data, personal, onChange, onPersonalChange }: Props) {
  const [open, setOpen] = useState<Set<keyof IncomeData>>(new Set());

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
    <div className="space-y-4">
      {/* Living situation card */}
      <SectionCard title="Woonsituatie" icon={<Home size={20} />} accent="border-teal-400">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {LIVING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onPersonalChange({ ...personal, livingType: opt.value })}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-colors cursor-pointer ${
                  personal.livingType === opt.value
                    ? 'border-teal-500 bg-teal-50 text-teal-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs opacity-75">{opt.desc}</span>
              </button>
            ))}
          </div>

          {personal.livingType === 'huur' && (
            <CurrencyInput
              label="Maandhuur"
              hint="Uw maandelijkse kale huur (voor huurtoeslag-berekening)"
              value={personal.monthlyRent}
              onChange={v => onPersonalChange({ ...personal, monthlyRent: v })}
            />
          )}

          {personal.livingType === 'huur' && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-teal-800">
              Huurtoeslag wordt automatisch berekend bij lage inkomens (max. huurgrens ≈ €900/maand).
            </div>
          )}
          {personal.livingType === 'koop' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
              Gebruik <em>Hypotheekrente aftrek</em> hieronder om uw aftrek toe te voegen.
            </div>
          )}
        </div>
      </SectionCard>

      {/* Income card */}
      <SectionCard title="Inkomen — Box 1" icon={<Briefcase size={20} />} accent="border-blue-400">
        <div className="space-y-4">
          <CurrencyInput
            label="Bruto jaarsalaris"
            hint="Jaarlijks brutoloon van uw werkgever"
            value={data.grossSalary}
            onChange={set('grossSalary')}
          />

          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Aanvullende inkomsten &amp; aftrekposten
            </p>
            {OPTIONAL_FIELDS.map(f => (
              <div key={f.key} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggle(f.key)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors bg-white border-0 cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    {open.has(f.key)
                      ? <ChevronDown size={15} className="text-orange-500" />
                      : <ChevronRight size={15} className="text-slate-400" />}
                    <span className={open.has(f.key) ? 'font-medium text-slate-800' : ''}>{f.label}</span>
                  </span>
                  {(data[f.key] as number) > 0 && (
                    <span className="text-xs font-semibold text-blue-600">
                      {nl.format(data[f.key] as number)}
                    </span>
                  )}
                </button>
                {open.has(f.key) && (
                  <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-100">
                    <CurrencyInput
                      label={f.label}
                      hint={f.hint}
                      value={data[f.key] as number}
                      onChange={set(f.key)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
