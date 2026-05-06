import { PiggyBank } from 'lucide-react';
import type { SavingsData } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: SavingsData;
  onChange: (d: SavingsData) => void;
}

export default function SavingsSection({ data, onChange }: Props) {
  const set = (key: keyof SavingsData) => (v: number) => onChange({ ...data, [key]: v });

  return (
    <SectionCard title="Spaarrekeningen — Box 3" icon={<PiggyBank size={20} />} accent="border-green-400">
      <p className="text-xs text-slate-500 mb-4">
        Spaarsaldo valt in Box 3. De peildatum is <strong>1 januari</strong> van het belastingjaar.
        Het fictief rendement op spaargeld is <strong>1,44%</strong> (2025).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Spaarsaldo op 1 januari"
          hint="Totaal saldo alle spaarrekeningen"
          value={data.bankSavingsJan1}
          onChange={set('bankSavingsJan1')}
        />
        <CurrencyInput
          label="Spaarsaldo op 31 december"
          hint="Voor schatting gemiddeld saldo"
          value={data.bankSavingsDec31}
          onChange={set('bankSavingsDec31')}
        />
        <CurrencyInput
          label="Maandelijkse spaarbijdrage"
          hint="Hoeveel spaart u per maand?"
          value={data.monthlySavingsContribution}
          onChange={set('monthlySavingsContribution')}
        />
      </div>
    </SectionCard>
  );
}
