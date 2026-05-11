import { PiggyBank, Wallet, Plus, Trash2 } from 'lucide-react';
import type { BankData, BankSpaarRekening, BankBetaalRekening } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: BankData;
  onChange: (d: BankData) => void;
}

function uid() { return Math.random().toString(36).slice(2); }

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ── Savings accounts sub-section ─────────────────────────────────────────────

function SpaarSection({ data, onChange }: Props) {
  const { t } = useLanguage();

  const add = () => onChange({
    ...data,
    spaarrekeningen: [...data.spaarrekeningen, { id: uid(), naam: '', instelling: '', saldoHuidig: 0, rentePercentage: 0 }],
  });
  const remove = (id: string) => onChange({ ...data, spaarrekeningen: data.spaarrekeningen.filter(r => r.id !== id) });
  const update = (id: string, p: Partial<BankSpaarRekening>) =>
    onChange({ ...data, spaarrekeningen: data.spaarrekeningen.map(r => r.id === id ? { ...r, ...p } : r) });

  const total = data.spaarrekeningen.reduce((s, r) => s + r.saldoHuidig, 0);

  return (
    <SectionCard
      title={<span className="flex items-center gap-1.5">{t.bank.savings} <InfoTooltip tip={t.bank.savingsHint} /></span>}
      icon={<PiggyBank size={20} />}
      accent="border-green-400"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {t.bank.savingsDesc}
      </p>

      {data.spaarrekeningen.length === 0 ? (
        <div className="text-center py-5 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mb-3">
          {t.bank.noSavings}
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {data.spaarrekeningen.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="col-span-12 sm:col-span-4 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.accountName}</label>
                <input
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="bijv. ING Spaarrekening"
                  value={r.naam}
                  onChange={e => update(r.id, { naam: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.institution}</label>
                <input
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="ING"
                  value={r.instelling}
                  onChange={e => update(r.id, { instelling: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.interestRate}</label>
                <div className="relative">
                  <input
                    type="number" min="0" max="20" step="0.01"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 pr-6 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-green-400"
                    value={r.rentePercentage || ''}
                    onChange={e => update(r.id, { rentePercentage: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                </div>
              </div>
              <div className="col-span-10 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.currentBalance}</label>
                <CurrencyInput
                  label=""
                  value={r.saldoHuidig}
                  onChange={v => update(r.id, { saldoHuidig: v })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-end justify-end pb-0.5">
                <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 hover:text-green-700 bg-transparent border-0 cursor-pointer px-0 font-medium"
        >
          <Plus size={16} /> {t.bank.addSavings}
        </button>
        {total > 0 && (
          <span className="text-sm font-semibold text-green-700 dark:text-green-400">{nl.format(total)}</span>
        )}
      </div>
    </SectionCard>
  );
}

// ── Checking/running accounts sub-section ────────────────────────────────────

function BetaalSection({ data, onChange }: Props) {
  const { t } = useLanguage();

  const add = () => onChange({
    ...data,
    betaalrekeningen: [...data.betaalrekeningen, { id: uid(), naam: '', instelling: '', saldoHuidig: 0 }],
  });
  const remove = (id: string) => onChange({ ...data, betaalrekeningen: data.betaalrekeningen.filter(r => r.id !== id) });
  const update = (id: string, p: Partial<BankBetaalRekening>) =>
    onChange({ ...data, betaalrekeningen: data.betaalrekeningen.map(r => r.id === id ? { ...r, ...p } : r) });

  const total = data.betaalrekeningen.reduce((s, r) => s + r.saldoHuidig, 0);

  return (
    <SectionCard
      title={<span className="flex items-center gap-1.5">{t.bank.checking} <InfoTooltip tip={t.bank.checkingHint} /></span>}
      icon={<Wallet size={20} />}
      accent="border-blue-400"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {t.bank.checkingDesc}
      </p>

      {data.betaalrekeningen.length === 0 ? (
        <div className="text-center py-5 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl mb-3">
          {t.bank.noChecking}
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {data.betaalrekeningen.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="col-span-12 sm:col-span-4 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.accountName}</label>
                <input
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="bijv. ING Betaalrekening"
                  value={r.naam}
                  onChange={e => update(r.id, { naam: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-4 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.institution}</label>
                <input
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="ING"
                  value={r.instelling}
                  onChange={e => update(r.id, { instelling: e.target.value })}
                />
              </div>
              <div className="col-span-4 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.bank.currentBalance}</label>
                <CurrencyInput
                  label=""
                  value={r.saldoHuidig}
                  onChange={v => update(r.id, { saldoHuidig: v })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-end justify-end pb-0.5">
                <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-transparent border-0 cursor-pointer px-0 font-medium"
        >
          <Plus size={16} /> {t.bank.addChecking}
        </button>
        {total > 0 && (
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{nl.format(total)}</span>
        )}
      </div>
    </SectionCard>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function BankRekeningenSection({ data, onChange }: Props) {
  const { t } = useLanguage();

  const totalSavings  = data.spaarrekeningen.reduce((s, r) => s + r.saldoHuidig, 0);
  const totalChecking = data.betaalrekeningen.reduce((s, r) => s + r.saldoHuidig, 0);
  const totalAll      = totalSavings + totalChecking;

  return (
    <div className="space-y-4">
      <SpaarSection data={data} onChange={onChange} />
      <BetaalSection data={data} onChange={onChange} />

      {totalAll > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.bank.totalSavings}</p>
            <p className="text-base font-bold text-green-700 dark:text-green-400">{nl.format(totalSavings)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.bank.totalChecking}</p>
            <p className="text-base font-bold text-blue-700 dark:text-blue-400">{nl.format(totalChecking)}</p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.bank.totalAll}</p>
            <p className="text-base font-bold text-indigo-700 dark:text-indigo-400">{nl.format(totalAll)}</p>
          </div>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
        <strong>{t.bank.noteTitle}:</strong> {t.bank.noteText}
      </div>
    </div>
  );
}
