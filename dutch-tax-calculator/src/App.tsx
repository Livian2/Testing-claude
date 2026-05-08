import { useState, useMemo, useEffect, useRef } from 'react';
import { Flag, RefreshCw, Users, Download, Upload } from 'lucide-react';
import type { TaxFormData, FilingStatus, PrognoseConfig } from './types';
import { calculateTaxes } from './utils/taxCalculations';
import IncomeSection from './components/IncomeSection';
import ExpensesSection from './components/ExpensesSection';
import SchuldenSection from './components/SchuldenSection';
import PortfolioSection from './components/PortfolioSection';
import WoonSection from './components/WoonSection';
import WaardesSection from './components/WaardesSection';
import TaxResults from './components/TaxResults';
import NetWorthProjection from './components/NetWorthProjection';
import AfschrijvingenSection from './components/AfschrijvingenSection';
import './index.css';

const DEFAULT_DATA: TaxFormData = {
  personal: { filingStatus: 'single', taxYear: 2026, age: 35 },
  woon: {
    woningType: 'hypotheek',
    maandhuur: 0,
    hypotheken: [
      {
        id: 'hyp-1', label: 'Hypotheek 1',
        type: 'annuiteit', leningBedrag: 0, rentePercentage: 0,
        rentevastePeriode: 10, looptijd: 30, startJaar: 2026,
      },
    ],
    gwe: 0, vve: 0, overig: 0,
  },
  waardes: {
    beleggingen: [],
    spaarrekeningen: [],
    betaalrekeningen: [],
  },
  income: {
    grossSalary: 0, freelanceIncome: 0, rentalIncome: 0,
    otherBox1Income: 0, pensionContributions: 0,
  },
  expenses: {
    groceries: 0, transport: 0, insurance: 0,
    healthcare: 0, education: 0, leisure: 0, other: 0,
  },
  savings: { monthlySavingsContribution: 0, maandelijksBeleggen: 0 },
  schulden: { duo: [], beleggingen: [] },
  portfolio: { holdings: [], transactions: [] },
  afschrijvingen: {
    rentePercentage: 4.0,
    categorieen: [
      { id: 'cat-mobile',      naam: 'Mobile',       items: [] },
      { id: 'cat-pc',          naam: 'PC',            items: [] },
      { id: 'cat-peripherals', naam: 'Peripherals',   items: [] },
      { id: 'cat-camera',      naam: 'Camera',        items: [] },
      { id: 'cat-overig',      naam: 'Overig',        items: [] },
    ],
  },
};

const STORAGE_KEY         = 'nl-belasting-data-v1';
const PROGNOSE_STORAGE_KEY = 'nl-belasting-prognose-v1';

const DEFAULT_PROGNOSE: PrognoseConfig = {
  rendementBeleggingen: 7.0,
  spaarrente:           2.0,
  jaren:                20,
  inkomensstijging:     2.0,
};

function loadSavedData(): TaxFormData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const saved = JSON.parse(raw) as Partial<TaxFormData>;
    // Deep-merge with defaults so newly added top-level fields are always present
    return {
      ...DEFAULT_DATA,
      ...saved,
      personal:  { ...DEFAULT_DATA.personal,  ...saved.personal  },
      woon:      { ...DEFAULT_DATA.woon,       ...saved.woon,
                   hypotheken: saved.woon?.hypotheken ?? DEFAULT_DATA.woon.hypotheken },
      waardes:   { ...DEFAULT_DATA.waardes,    ...saved.waardes   },
      income:    { ...DEFAULT_DATA.income,     ...saved.income    },
      expenses:  { ...DEFAULT_DATA.expenses,   ...saved.expenses  },
      savings:   { ...DEFAULT_DATA.savings,    ...saved.savings   },
      schulden:       { ...DEFAULT_DATA.schulden,       ...saved.schulden       },
      portfolio:      { ...DEFAULT_DATA.portfolio,      ...saved.portfolio      },
      afschrijvingen: { ...DEFAULT_DATA.afschrijvingen, ...saved.afschrijvingen },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

type Tab = 'income' | 'woon' | 'waardes' | 'expenses' | 'schulden' | 'portfolio' | 'afschrijvingen' | 'prognose' | 'results';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'income',         label: 'Inkomen',         emoji: '💼' },
  { id: 'woon',           label: 'Wonen',           emoji: '🏠' },
  { id: 'waardes',        label: 'Waardes 1 jan',   emoji: '📋' },
  { id: 'expenses',       label: 'Kosten',          emoji: '🛒' },
  { id: 'schulden',       label: 'Schulden',        emoji: '💳' },
  { id: 'portfolio',      label: 'Beleggen',        emoji: '📈' },
  { id: 'afschrijvingen', label: 'Afschrijvingen',  emoji: '🔄' },
  { id: 'prognose',       label: 'Prognose',        emoji: '🔮' },
  { id: 'results',        label: 'Berekening',      emoji: '🧮' },
];

function loadSavedPrognose(): PrognoseConfig {
  try {
    const raw = localStorage.getItem(PROGNOSE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGNOSE;
    return { ...DEFAULT_PROGNOSE, ...(JSON.parse(raw) as Partial<PrognoseConfig>) };
  } catch {
    return DEFAULT_PROGNOSE;
  }
}

export default function App() {
  const [data, setData]         = useState<TaxFormData>(loadSavedData);
  const [prognose, setPrognose] = useState<PrognoseConfig>(loadSavedPrognose);
  const [tab, setTab]           = useState<Tab>('income');
  const importRef               = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = JSON.stringify({ data, prognose }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `belasting-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as { data?: Partial<TaxFormData>; prognose?: Partial<PrognoseConfig> };
        if (parsed.data) {
          setData({
            ...DEFAULT_DATA,
            ...parsed.data,
            personal:  { ...DEFAULT_DATA.personal,  ...parsed.data.personal  },
            woon:      { ...DEFAULT_DATA.woon,       ...parsed.data.woon,
                         hypotheken: parsed.data.woon?.hypotheken ?? DEFAULT_DATA.woon.hypotheken },
            waardes:   { ...DEFAULT_DATA.waardes,    ...parsed.data.waardes   },
            income:    { ...DEFAULT_DATA.income,     ...parsed.data.income    },
            expenses:  { ...DEFAULT_DATA.expenses,   ...parsed.data.expenses  },
            savings:   { ...DEFAULT_DATA.savings,    ...parsed.data.savings   },
            schulden:       { ...DEFAULT_DATA.schulden,       ...parsed.data.schulden       },
            portfolio:      { ...DEFAULT_DATA.portfolio,      ...parsed.data.portfolio      },
            afschrijvingen: { ...DEFAULT_DATA.afschrijvingen, ...parsed.data.afschrijvingen },
          });
        }
        if (parsed.prognose) setPrognose({ ...DEFAULT_PROGNOSE, ...parsed.prognose });
      } catch { /* invalid file — ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Persist to localStorage 500 ms after every change
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), 500);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(PROGNOSE_STORAGE_KEY, JSON.stringify(prognose)), 500);
    return () => clearTimeout(t);
  }, [prognose]);

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
              <p className="text-xs text-slate-500 m-0">Box 1 &amp; Box 3 — Belastingjaar 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0 bg-slate-100 rounded-xl p-1">
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
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1.5 bg-transparent border-0 cursor-pointer"
              title="Exporteer gegevens als JSON"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Opslaan</span>
            </button>

            <label
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1.5 cursor-pointer"
              title="Importeer gegevens uit JSON"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Laden</span>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0 ${
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
            <IncomeSection
              data={data.income}
              onChange={income => setData(d => ({ ...d, income }))}
            />
            <InfoBox>
              <strong>Box 1</strong> — 35,82% (t/m €40.021) · 37,48% (€40.021–€77.536) · 49,50% (boven €77.536).
              Hypotheekrente wordt automatisch meegenomen als aftrekpost vanuit het <em>Wonen</em>-tabblad.
            </InfoBox>
          </div>
        )}
        {tab === 'woon' && (
          <WoonSection
            data={data.woon}
            taxYear={data.personal.taxYear}
            onChange={woon => setData(d => ({ ...d, woon }))}
          />
        )}
        {tab === 'waardes' && (
          <div className="space-y-4">
            <WaardesSection
              data={data.waardes}
              onChange={waardes => setData(d => ({ ...d, waardes }))}
            />
            <InfoBox>
              <strong>Box 3</strong> — peildatum <strong>1 januari {data.personal.taxYear}</strong>.
              Voer de waarden in zoals ze op 1 januari stonden. Fictief rendement 2026:
              spaargeld <strong>1,03%</strong> · beleggingen <strong>5,88%</strong> · schulden <strong>2,62%</strong>.
              Heffingvrij vermogen: <strong>€57.684</strong> / <strong>€115.368</strong> (partners).
            </InfoBox>
          </div>
        )}
        {tab === 'expenses' && (
          <ExpensesSection
            data={data.expenses}
            onChange={expenses => setData(d => ({ ...d, expenses }))}
            savings={data.savings}
            onSavingsChange={savings => setData(d => ({ ...d, savings }))}
          />
        )}
        {tab === 'schulden' && (
          <SchuldenSection
            data={data.schulden}
            taxYear={data.personal.taxYear}
            grossSalary={data.income.grossSalary + data.income.freelanceIncome}
            isPartner={data.personal.filingStatus === 'partner'}
            onChange={schulden => setData(d => ({ ...d, schulden }))}
          />
        )}
        {tab === 'portfolio' && (
          <div className="space-y-4">
            <PortfolioSection
              data={data.portfolio}
              onChange={portfolio => setData(d => ({ ...d, portfolio }))}
            />
            <InfoBox>
              Vul tickers in (bijv. <code className="bg-blue-100 px-1 rounded">VWCE.AS</code>) voor live koersen.
              Box 3 belastingwaardes (1 jan) invullen op het tabblad <strong>Waardes 1 jan</strong>.
            </InfoBox>
          </div>
        )}
        {tab === 'afschrijvingen' && (
          <AfschrijvingenSection
            data={data.afschrijvingen}
            taxYear={data.personal.taxYear}
            onChange={afschrijvingen => setData(d => ({ ...d, afschrijvingen }))}
          />
        )}
        {tab === 'prognose' && (
          <NetWorthProjection
            data={data}
            config={prognose}
            onConfigChange={setPrognose}
          />
        )}
        {tab === 'results' && (
          <TaxResults result={result} />
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-400 border-t border-slate-200 mt-4">
        Indicatieve berekening o.b.v. belastingregels 2026. Raadpleeg altijd een belastingadviseur voor persoonlijk advies.
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
