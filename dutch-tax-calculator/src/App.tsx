import { useState, useMemo, useEffect, useRef } from 'react';
import { Flag, RefreshCw, Users, Download, Upload, Home, Moon, Sun } from 'lucide-react';
import type { TaxFormData, FilingStatus, PrognoseConfig } from './types';
import { calculateTaxes } from './utils/taxCalculations';
import { useLanguage } from './i18n/LanguageContext';
import IncomeSection from './components/IncomeSection';
import ExpensesSection from './components/ExpensesSection';
import SchuldenSection from './components/SchuldenSection';
import PortfolioSection from './components/PortfolioSection';
import WoonSection from './components/WoonSection';
import WaardesSection from './components/WaardesSection';
import TaxResults from './components/TaxResults';
import NetWorthProjection from './components/NetWorthProjection';
import AfschrijvingenSection from './components/AfschrijvingenSection';
import BankRekeningenSection from './components/BankRekeningenSection';
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
    wozWaarde: 0,
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
  bankData: { spaarrekeningen: [], betaalrekeningen: [] },
  schulden: { duo: [], beleggingen: [] },
  portfolio: { holdings: [], transactions: [] },
  afschrijvingen: {
    rentePercentage: 4.0,
    categorieen: [],
  },
};

const STORAGE_KEY         = 'nl-belasting-data-v1';
const PROGNOSE_STORAGE_KEY = 'nl-belasting-prognose-v1';
const TABS_STORAGE_KEY    = 'nl-belasting-tabs-v1';
const THEME_STORAGE_KEY   = 'nl-belasting-theme';

function loadInitialDark(): boolean {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

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
      bankData:  { ...DEFAULT_DATA.bankData,   ...saved.bankData  },
      schulden:       { ...DEFAULT_DATA.schulden,       ...saved.schulden       },
      portfolio:      { ...DEFAULT_DATA.portfolio,      ...saved.portfolio      },
      afschrijvingen: { ...DEFAULT_DATA.afschrijvingen, ...saved.afschrijvingen },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

type Tab = 'income' | 'woon' | 'waardes' | 'expenses' | 'schulden' | 'bank' | 'portfolio' | 'afschrijvingen' | 'prognose' | 'results';
type AnyTab = Tab | 'home';

interface TabMeta { id: Tab; label: string; emoji: string; description: string }

const ALL_TABS: TabMeta[] = [
  { id: 'income',         label: 'Inkomen',         emoji: '💼', description: 'Salaris, freelance, huurinkomsten en andere Box 1 inkomsten.' },
  { id: 'woon',           label: 'Wonen',           emoji: '🏠', description: 'Hypotheek(en), huur, VvE, GWE en extra aflossingen.' },
  { id: 'waardes',        label: 'Waardes 1 jan',   emoji: '📋', description: 'Box 3 vermogen op 1 januari: beleggingen, spaar- en betaalrekeningen.' },
  { id: 'expenses',       label: 'Kosten',          emoji: '🛒', description: 'Maandelijkse uitgaven, spaar- en beleggingsbijdragen.' },
  { id: 'schulden',       label: 'Schulden',        emoji: '💳', description: 'DUO studieschuld (SF15/SF35) met aflossing simulatie, en beleggingsschulden.' },
  { id: 'bank',           label: 'Bankrekeningen',  emoji: '🏦', description: 'Actuele saldi van spaar- en betaalrekeningen — tellen mee voor netto vermogen.' },
  { id: 'portfolio',      label: 'Beleggen',        emoji: '📈', description: 'Portefeuille beheer: aankopen, verkopen, live koersen en dividenden.' },
  { id: 'afschrijvingen', label: 'Afschrijvingen',  emoji: '🔄', description: 'Sinking fund calculator: hoeveel spaar je per jaar voor vervangingen?' },
  { id: 'prognose',       label: 'Prognose',        emoji: '🔮', description: 'Vermogensprognose over 10/20/30 jaar: sparen, beleggen, schulden, netto vermogen.' },
  { id: 'results',        label: 'Berekening',      emoji: '🧮', description: 'Live belastingberekening: Box 1, Box 3, toeslagen en beschikbaar inkomen.' },
];

const DEFAULT_ENABLED_TABS = new Set<Tab>(ALL_TABS.map(t => t.id));

function loadEnabledTabs(): Set<Tab> {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return DEFAULT_ENABLED_TABS;
    const arr = JSON.parse(raw) as Tab[];
    return new Set(arr.filter(id => ALL_TABS.some(t => t.id === id)));
  } catch {
    return DEFAULT_ENABLED_TABS;
  }
}

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
  const { lang, setLang, t } = useLanguage();
  const [data, setData]           = useState<TaxFormData>(loadSavedData);
  const [prognose, setPrognose]   = useState<PrognoseConfig>(loadSavedPrognose);
  const [enabledTabs, setEnabledTabs] = useState<Set<Tab>>(loadEnabledTabs);
  const [tab, setTab]             = useState<AnyTab>('home');
  const [isDark, setIsDark]       = useState<boolean>(loadInitialDark);
  const importRef                 = useRef<HTMLInputElement>(null);

  // Apply / remove .dark class on <html> and persist preference
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify([...enabledTabs]));
  }, [enabledTabs]);

  const toggleTab = (id: Tab) => {
    setEnabledTabs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // If currently viewing this tab, go home
        if (tab === id) setTab('home');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleTabs = ALL_TABS.filter(tab => enabledTabs.has(tab.id));

  const TAB_LABELS: Record<Tab, string> = {
    income:         t.tabs.income,
    woon:           t.tabs.housing,
    waardes:        t.tabs.values,
    expenses:       t.tabs.expenses,
    schulden:       t.tabs.debts,
    bank:           t.tabs.bank,
    portfolio:      t.tabs.portfolio,
    afschrijvingen: t.tabs.depreciation,
    prognose:       t.tabs.forecast,
    results:        t.tabs.results,
  };

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
            bankData:  { ...DEFAULT_DATA.bankData,   ...parsed.data.bankData  },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-orange-500 text-white rounded-xl px-3 py-1.5">
              <Flag size={16} />
              <span className="text-sm font-bold">NL Belasting</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 m-0">{t.appTitle}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              {(['single', 'partner'] as FilingStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setPersonal({ filingStatus: s })}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${
                    data.personal.filingStatus === s
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium shadow-sm'
                      : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Users size={12} />
                  {s === 'single' ? t.personal.single : t.personal.partner}
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1.5 bg-transparent border-0 cursor-pointer"
              title={t.export}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{t.export}</span>
            </button>

            <label
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1.5 cursor-pointer"
              title={t.import}
            >
              <Upload size={14} />
              <span className="hidden sm:inline">{t.import}</span>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>

            <button
              onClick={() => setData(DEFAULT_DATA)}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1.5 bg-transparent border-0 cursor-pointer"
              title={t.reset}
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">{t.reset}</span>
            </button>

            <button
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              {lang === 'nl' ? '🇬🇧 EN' : '🇳🇱 NL'}
            </button>

            <button
              onClick={() => setIsDark(d => !d)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-transparent border-0 cursor-pointer"
              title={isDark ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
              aria-label={isDark ? 'Lichte modus' : 'Donkere modus'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto">
          {/* Home tab — always visible */}
          <button
            onClick={() => setTab('home')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0 ${
              tab === 'home'
                ? 'border-orange-500 text-orange-600 font-medium'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <Home size={14} />
            Start
          </button>

          {/* User-selected tabs */}
          {visibleTabs.map(tabMeta => (
            <button
              key={tabMeta.id}
              onClick={() => setTab(tabMeta.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0 ${
                tab === tabMeta.id
                  ? 'border-orange-500 text-orange-600 font-medium'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span>{tabMeta.emoji}</span>
              {TAB_LABELS[tabMeta.id]}
              {tabMeta.id === 'results' && (
                <span className="ml-1 bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  Live
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'home' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Welkom bij NL Belastingcalculator</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Kies hieronder welke tabbladen je wilt gebruiken. Klik op een tabblad om er naartoe te gaan.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALL_TABS.map(tabMeta => {
                const enabled = enabledTabs.has(tabMeta.id);
                return (
                  <div
                    key={tabMeta.id}
                    className={`bg-white dark:bg-slate-800 border-2 rounded-2xl p-4 flex flex-col gap-3 transition-all ${
                      enabled ? 'border-orange-200 dark:border-orange-800 shadow-sm' : 'border-slate-200 dark:border-slate-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{tabMeta.emoji}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{TAB_LABELS[tabMeta.id]}</span>
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => toggleTab(tabMeta.id)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                          enabled ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        role="switch"
                        aria-checked={enabled}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tabMeta.description}</p>
                    {enabled && (
                      <button
                        onClick={() => setTab(tabMeta.id)}
                        className="mt-auto text-xs text-orange-600 hover:text-orange-700 font-medium text-left bg-transparent border-0 cursor-pointer p-0"
                      >
                        Ga naar {TAB_LABELS[tabMeta.id]} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> Zet tabbladen die je niet gebruikt uit om de navigatie overzichtelijk te houden. Je gegevens blijven bewaard.
            </div>
          </div>
        )}

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
        {tab === 'bank' && (
          <BankRekeningenSection
            data={data.bankData}
            onChange={bankData => setData(d => ({ ...d, bankData }))}
          />
        )}
        {tab === 'portfolio' && (
          <div className="space-y-4">
            <PortfolioSection
              data={data.portfolio}
              onChange={portfolio => setData(d => ({ ...d, portfolio }))}
            />
            <InfoBox>
              Vul tickers in (bijv. <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded">VWCE.AS</code>) voor live koersen.
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

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 mt-4">
        Indicatieve berekening o.b.v. belastingregels 2026. Raadpleeg altijd een belastingadviseur voor persoonlijk advies.
      </footer>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-800 dark:text-blue-300">
      {children}
    </div>
  );
}
