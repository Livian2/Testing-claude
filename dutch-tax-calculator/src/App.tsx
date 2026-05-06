import { useState, useMemo } from 'react';
import { Flag, RefreshCw, Users } from 'lucide-react';
import type { TaxFormData, FilingStatus } from './types';
import { calculateTaxes } from './utils/taxCalculations';
import IncomeSection from './components/IncomeSection';
import ExpensesSection from './components/ExpensesSection';
import SavingsSection from './components/SavingsSection';
import PortfolioSection from './components/PortfolioSection';
import TaxResults from './components/TaxResults';
import './index.css';

const DEFAULT_DATA: TaxFormData = {
  personal: { filingStatus: 'single', taxYear: 2025, age: 35 },
  income: {
    grossSalary: 0, freelanceIncome: 0, rentalIncome: 0,
    otherBox1Income: 0, mortgageInterestDeduction: 0, pensionContributions: 0,
  },
  expenses: {
    housing: 0, groceries: 0, utilities: 0, transport: 0,
    insurance: 0, healthcare: 0, education: 0, leisure: 0, other: 0,
  },
  savings: { bankSavingsJan1: 0, bankSavingsDec31: 0, monthlySavingsContribution: 0 },
  portfolio: { holdings: [], transactions: [], investmentDebts: 0 },
};

type Tab = 'income' | 'expenses' | 'savings' | 'portfolio' | 'results';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'income',    label: 'Inkomen',    emoji: '💼' },
  { id: 'expenses',  label: 'Kosten',     emoji: '🛒' },
  { id: 'savings',   label: 'Sparen',     emoji: '🐷' },
  { id: 'portfolio', label: 'Beleggen',   emoji: '📈' },
  { id: 'results',   label: 'Berekening', emoji: '🧮' },
];

export default function App() {
  const [data, setData] = useState<TaxFormData>(DEFAULT_DATA);
  const [tab, setTab] = useState<Tab>('income');

  const result = useMemo(() => calculateTaxes(data), [data]);

  const setPersonal = (patch: Partial<TaxFormData['personal']>) =>
    setData(d => ({ ...d, personal: { ...d.personal, ...patch } }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-orange-500 text-white rounded-xl px-3 py-1.5">
              <Flag size={16} />
              <span className="text-sm font-bold">NL Belasting</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-slate-800 m-0">Belastingcalculator voor Beleggers</h1>
              <p className="text-xs text-slate-500 m-0">Box 1 &amp; Box 3 — Belastingjaar 2025</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
              {(['single', 'partner'] as FilingStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setPersonal({ filingStatus: s })}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${
                    data.personal.filingStatus === s
                      ? 'bg-white text-slate-800 font-medium shadow-sm'
                      : 'bg-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users size={12} />
                  {s === 'single' ? 'Alleenstaand' : 'Fiscaal partner'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setData(DEFAULT_DATA)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1.5 bg-transparent border-0 cursor-pointer"
              title="Reset alle gegevens"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0 ${
                tab === t.id
                  ? 'border-orange-500 text-orange-600 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
              {t.id === 'results' && (
                <span className="ml-1 bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  Live
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'income' && (
          <div className="space-y-4">
            <IncomeSection data={data.income} onChange={income => setData(d => ({ ...d, income }))} />
            <InfoBox>
              <strong>Box 1</strong> omvat inkomen uit werk, eigen woning en periodieke uitkeringen.
              Progressief tarief: 35,82% (t/m €38.441) · 37,48% (€38.441–€76.817) · 49,50% (boven €76.817).
            </InfoBox>
          </div>
        )}
        {tab === 'expenses' && (
          <ExpensesSection data={data.expenses} onChange={expenses => setData(d => ({ ...d, expenses }))} />
        )}
        {tab === 'savings' && (
          <SavingsSection data={data.savings} onChange={savings => setData(d => ({ ...d, savings }))} />
        )}
        {tab === 'portfolio' && (
          <div className="space-y-4">
            <PortfolioSection data={data.portfolio} onChange={portfolio => setData(d => ({ ...d, portfolio }))} />
            <InfoBox>
              <strong>Box 3</strong> belast vermogen boven het heffingvrij vermogen (€57.000 alleenstaand / €114.000 partners).
              Peildatum: <strong>1 januari</strong>. Transacties dit jaar beïnvloeden volgend jaar uw Box 3 positie.
            </InfoBox>
          </div>
        )}
        {tab === 'results' && (
          <TaxResults result={result} />
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-400 border-t border-slate-200 mt-4">
        Indicatieve berekening o.b.v. belastingregels 2025. Raadpleeg altijd een belastingadviseur voor persoonlijk advies.
      </footer>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
      {children}
    </div>
  );
}
