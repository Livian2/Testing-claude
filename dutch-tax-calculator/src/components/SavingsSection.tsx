import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import type { SavingsData, SavingsAccount } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: SavingsData;
  onChange: (d: SavingsData) => void;
}

function uid() { return Math.random().toString(36).slice(2); }

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function SavingsSection({ data, onChange }: Props) {
  const setAccounts = (accounts: SavingsAccount[]) => onChange({ ...data, accounts });

  const addAccount = () =>
    setAccounts([...data.accounts, { id: uid(), name: '', balanceJan1: 0, interestRate: 0 }]);

  const removeAccount = (id: string) =>
    setAccounts(data.accounts.filter(a => a.id !== id));

  const updateAccount = (id: string, patch: Partial<SavingsAccount>) =>
    setAccounts(data.accounts.map(a => a.id === id ? { ...a, ...patch } : a));

  const totalBalance       = data.accounts.reduce((s, a) => s + a.balanceJan1, 0);
  const totalInterest      = data.accounts.reduce((s, a) => s + a.balanceJan1 * (a.interestRate / 100), 0);

  return (
    <SectionCard title="Spaarrekeningen — Box 3" icon={<PiggyBank size={20} />} accent="border-green-400">
      <p className="text-xs text-slate-500 mb-4">
        Spaarsaldo telt mee in Box 3. Peildatum: <strong>1 januari</strong>.
        Fiscaal fictief rendement: <strong>1,44%</strong> (2025), ongeacht uw werkelijke rente.
      </p>

      {/* Savings accounts list */}
      <div className="space-y-3 mb-4">
        {data.accounts.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
            Nog geen spaarrekeningen toegevoegd
          </div>
        ) : (
          data.accounts.map(acc => (
            <div key={acc.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
              {/* Name */}
              <div className="col-span-12 sm:col-span-4 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Naam rekening</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="bijv. ING Spaarrekening"
                  value={acc.name}
                  onChange={e => updateAccount(acc.id, { name: e.target.value })}
                />
              </div>

              {/* Balance Jan 1 */}
              <div className="col-span-6 sm:col-span-4">
                <CurrencyInput
                  label="Saldo 1 januari"
                  value={acc.balanceJan1}
                  onChange={v => updateAccount(acc.id, { balanceJan1: v })}
                />
              </div>

              {/* Interest rate */}
              <div className="col-span-5 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Rente %</label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-400 bg-white">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.01}
                    placeholder="0,00"
                    value={acc.interestRate || ''}
                    onChange={e => updateAccount(acc.id, { interestRate: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-3 py-2 text-sm outline-none bg-white min-w-0"
                  />
                  <span className="px-2 py-2 bg-slate-100 text-slate-500 text-sm border-l border-slate-300 select-none">%</span>
                </div>
                {acc.balanceJan1 > 0 && acc.interestRate > 0 && (
                  <p className="text-xs text-green-600 font-medium">
                    ≈ {nl.format(acc.balanceJan1 * acc.interestRate / 100)} / jaar
                  </p>
                )}
              </div>

              {/* Remove */}
              <div className="col-span-1 flex items-end justify-center pb-0.5">
                <button
                  onClick={() => removeAccount(acc.id)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1 bg-transparent border-0 cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={addAccount}
        className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors cursor-pointer border-0 mb-5"
      >
        <Plus size={13} /> Rekening toevoegen
      </button>

      {/* Totals */}
      {data.accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-100">
            <p className="text-xs text-slate-500 mb-1">Totaal saldo (Box 3)</p>
            <p className="text-base font-bold text-green-700">{nl.format(totalBalance)}</p>
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-100">
            <p className="text-xs text-slate-500 mb-1">Werkelijke rente-opbrengst</p>
            <p className="text-base font-bold text-green-700">{nl.format(totalInterest)}</p>
          </div>
        </div>
      )}

      {/* Monthly savings contribution */}
      <div className="border-t border-slate-100 pt-4">
        <CurrencyInput
          label="Maandelijkse spaarbijdrage"
          hint="Hoeveel spaart u per maand?"
          value={data.monthlySavingsContribution}
          onChange={v => onChange({ ...data, monthlySavingsContribution: v })}
        />
      </div>
    </SectionCard>
  );
}
