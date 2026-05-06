import { Briefcase } from 'lucide-react';
import type { IncomeData } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: IncomeData;
  onChange: (d: IncomeData) => void;
}

export default function IncomeSection({ data, onChange }: Props) {
  const set = (key: keyof IncomeData) => (v: number) => onChange({ ...data, [key]: v });

  return (
    <SectionCard title="Inkomen — Box 1" icon={<Briefcase size={20} />} accent="border-blue-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Bruto salaris (per jaar)"
          hint="Jaarlijks brutoloon van uw werkgever"
          value={data.grossSalary}
          onChange={set('grossSalary')}
        />
        <CurrencyInput
          label="Freelance / ZZP inkomen"
          hint="Netto winst uit onderneming"
          value={data.freelanceIncome}
          onChange={set('freelanceIncome')}
        />
        <CurrencyInput
          label="Huurinkomsten (Box 1)"
          hint="Bijv. van kamer verhuur eigen woning"
          value={data.rentalIncome}
          onChange={set('rentalIncome')}
        />
        <CurrencyInput
          label="Overig Box 1 inkomen"
          hint="AOW, pensioen, uitkering, etc."
          value={data.otherBox1Income}
          onChange={set('otherBox1Income')}
        />
        <CurrencyInput
          label="Hypotheekrente aftrek"
          hint="Betaalde rente op eigen woning hypotheek"
          value={data.mortgageInterestDeduction}
          onChange={set('mortgageInterestDeduction')}
        />
        <CurrencyInput
          label="Lijfrentepremies (aftrekbaar)"
          hint="Storting op lijfrentepolis of banksparen"
          value={data.pensionContributions}
          onChange={set('pensionContributions')}
        />
      </div>
    </SectionCard>
  );
}
