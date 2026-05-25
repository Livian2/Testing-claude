import { useState, useMemo, useEffect, useRef } from 'react';
import { Flag, RefreshCw, Users, Download, Upload, Home, Moon, Sun, HelpCircle, Sparkles, BookOpen } from 'lucide-react';
import WelcomeModal from './components/WelcomeModal';
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
import SchenkingenSection from './components/SchenkingenSection';
import BankRekeningenSection from './components/BankRekeningenSection';
import MarginaleDrukChart from './components/MarginaleDrukChart';
import JaarruimteSection from './components/JaarruimteSection';
import LandingPage from './components/LandingPage';
import './index.css';

const DEFAULT_DATA: TaxFormData = {
  personal: { filingStatus: 'single', taxYear: 2026, age: 35 },
  woon: {
    woningType: 'huur',
    maandhuur: 0,
    hypotheken: [],
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
    otherBox1Income: 0, pensionContributions: 0, duoLening: 0,
  },
  expenses: {
    groceries: 0, transport: 0, insurance: 0,
    healthcare: 0, education: 0, leisure: 0, phone: 0, other: 0,
  },
  savings: { monthlySavingsContribution: 0, maandelijksBeleggen: 0 },
  bankData: { spaarrekeningen: [], betaalrekeningen: [] },
  schulden: { duo: [], beleggingen: [] },
  portfolio: { holdings: [], transactions: [] },
  afschrijvingen: {
    rentePercentage: 4.0,
    categorieen: [],
  },
  schenkingen: { schenkingen: [] },
};

const APP_VERSION         = 'v1.22.0';

const STORAGE_KEY         = 'nl-belasting-data-v1';
const PROGNOSE_STORAGE_KEY = 'nl-belasting-prognose-v1';
const TABS_STORAGE_KEY    = 'nl-belasting-tabs-v1';
const THEME_STORAGE_KEY   = 'nl-belasting-theme';
const LANDING_SEEN_KEY    = 'nl-belasting-landing-seen';

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
                   // Migrate hypotheek.looptijd from years (legacy, ≤40) to months
                   hypotheken: (saved.woon?.hypotheken ?? DEFAULT_DATA.woon.hypotheken).map(h =>
                     h.looptijd > 0 && h.looptijd <= 40 ? { ...h, looptijd: h.looptijd * 12 } : h
                   ) },
      waardes:   { ...DEFAULT_DATA.waardes,    ...saved.waardes   },
      income:    { ...DEFAULT_DATA.income,     ...saved.income    },
      expenses:  { ...DEFAULT_DATA.expenses,   ...saved.expenses  },
      savings:   { ...DEFAULT_DATA.savings,    ...saved.savings   },
      bankData:  { ...DEFAULT_DATA.bankData,   ...saved.bankData  },
      schulden:       { ...DEFAULT_DATA.schulden,       ...saved.schulden       },
      portfolio:      { ...DEFAULT_DATA.portfolio,      ...saved.portfolio      },
      afschrijvingen: { ...DEFAULT_DATA.afschrijvingen, ...saved.afschrijvingen },
      schenkingen:    { ...DEFAULT_DATA.schenkingen,    ...saved.schenkingen    },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

type Tab = 'income' | 'woon' | 'waardes' | 'expenses' | 'schulden' | 'bank' | 'portfolio' | 'afschrijvingen' | 'schenkingen' | 'jaarruimte' | 'prognose' | 'results' | 'marginale';
type AnyTab = Tab | 'home';

interface TabMeta { id: Tab; emoji: string; description: string }

const ALL_TAB_IDS: Tab[] = [
  'income', 'woon', 'waardes', 'expenses', 'schulden', 'bank',
  'portfolio', 'afschrijvingen', 'schenkingen', 'jaarruimte', 'prognose', 'results', 'marginale',
];

const DEFAULT_ENABLED_TABS = new Set<Tab>(ALL_TAB_IDS);

function loadEnabledTabs(): Set<Tab> {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return DEFAULT_ENABLED_TABS;
    const arr = JSON.parse(raw) as Tab[];
    return new Set(arr.filter(id => ALL_TAB_IDS.includes(id)));
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
  const [showWelcome, setShowWelcome]   = useState<boolean>(false);
  const [showLanding, setShowLanding]   = useState<boolean>(() => {
    try { return !localStorage.getItem(LANDING_SEEN_KEY); } catch { return true; }
  });
  const [panelWidth, setPanelWidth]     = useState(() => Math.round(window.innerWidth * 0.35));
  const [panelVisible, setPanelVisible] = useState(true);
  const importRef                       = useRef<HTMLInputElement>(null);
  const resizeDragRef                   = useRef<{ startX: number; startWidth: number } | null>(null);

  const closeWelcome = () => setShowWelcome(false);
  const closeLanding = () => {
    try { localStorage.setItem(LANDING_SEEN_KEY, '1'); } catch { /* ignore */ }
    setShowLanding(false);
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startX: e.clientX, startWidth: panelWidth };
    const onMove = (me: MouseEvent) => {
      if (!resizeDragRef.current) return;
      const dx = resizeDragRef.current.startX - me.clientX;
      setPanelWidth(Math.max(280, Math.min(Math.round(window.innerWidth * 0.92), resizeDragRef.current.startWidth + dx)));
    };
    const onUp = () => { resizeDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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

  const ALL_TABS = useMemo<TabMeta[]>(() => [
    { id: 'income',         emoji: '💼', description: t.tabDescriptions.income },
    { id: 'woon',           emoji: '🏠', description: t.tabDescriptions.woon },
    { id: 'waardes',        emoji: '📋', description: t.tabDescriptions.waardes },
    { id: 'expenses',       emoji: '🛒', description: t.tabDescriptions.expenses },
    { id: 'schulden',       emoji: '💳', description: t.tabDescriptions.schulden },
    { id: 'bank',           emoji: '🏦', description: t.tabDescriptions.bank },
    { id: 'portfolio',      emoji: '📈', description: t.tabDescriptions.portfolio },
    { id: 'afschrijvingen', emoji: '🔄', description: t.tabDescriptions.afschrijvingen },
    { id: 'schenkingen',   emoji: '🎁', description: t.tabDescriptions.schenkingen },
    { id: 'jaarruimte',     emoji: '🏛️', description: t.tabDescriptions.jaarruimte },
    { id: 'prognose',       emoji: '🔮', description: t.tabDescriptions.prognose },
    { id: 'results',        emoji: '🧮', description: t.tabDescriptions.results },
    { id: 'marginale',      emoji: '📊', description: t.tabDescriptions.marginale },
  ], [t]);

  const visibleTabs = useMemo(
    () => ALL_TABS.filter(tab => enabledTabs.has(tab.id)),
    [ALL_TABS, enabledTabs],
  );

  const TAB_LABELS = useMemo<Record<Tab, string>>(() => ({
    income:         t.tabs.income,
    woon:           t.tabs.housing,
    waardes:        t.tabs.values,
    expenses:       t.tabs.expenses,
    schulden:       t.tabs.debts,
    bank:           t.tabs.bank,
    portfolio:      t.tabs.portfolio,
    afschrijvingen: t.tabs.depreciation,
    schenkingen:   t.tabs.gifts,
    jaarruimte:     t.tabs.jaarruimte,
    prognose:       t.tabs.forecast,
    results:        t.tabs.results,
    marginale:      t.tabs.marginale,
  }), [t]);

  const handleExport = () => {
    let bankTxs: unknown[] = [];
    try { bankTxs = JSON.parse(localStorage.getItem('dutch-tax-bank-txs-v1') || '[]'); } catch { /* ignore */ }
    const payload = JSON.stringify({ data, prognose, bankTxs }, null, 2);
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
        const parsed = JSON.parse(ev.target?.result as string) as { data?: Partial<TaxFormData>; prognose?: Partial<PrognoseConfig>; bankTxs?: unknown[] };
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
        if (Array.isArray(parsed.bankTxs) && parsed.bankTxs.length > 0) {
          try { localStorage.setItem('dutch-tax-bank-txs-v1', JSON.stringify(parsed.bankTxs)); } catch { /* quota */ }
        }
      } catch { /* invalid file — ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Persist to localStorage 1s after every change (was 500ms — typing latency dominated by stringify)
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
    }, 1000);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(PROGNOSE_STORAGE_KEY, JSON.stringify(prognose)); } catch { /* quota */ }
    }, 1000);
    return () => clearTimeout(t);
  }, [prognose]);

  const result = useMemo(() => calculateTaxes(data), [data]);

  const setPersonal = (patch: Partial<TaxFormData['personal']>) =>
    setData(d => ({ ...d, personal: { ...d.personal, ...patch } }));

  const showSidePanel = tab !== 'home' && tab !== 'results' && tab !== 'prognose' && tab !== 'marginale';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {showWelcome && <WelcomeModal onClose={closeWelcome} />}
      {showLanding && (
        <LandingPage
          ALL_TABS={ALL_TABS}
          TAB_LABELS={TAB_LABELS}
          enabledTabs={enabledTabs}
          lang={lang}
          t={t}
          onClose={closeLanding}
          onOpenTab={(id) => { setTab(id as Tab); closeLanding(); }}
          setLang={setLang}
        />
      )}

      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/80 sticky top-0 z-20 shadow-sm">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-xl px-3 py-1.5 shadow-md shadow-orange-500/20">
              <Flag size={16} />
              <span className="text-sm font-bold tracking-tight">NL Belasting</span>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 m-0 tracking-tight">{t.appTitle}</h1>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">{APP_VERSION}</span>
              </div>
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

            <label
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1.5 cursor-pointer"
              title={t.import}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{t.import}</span>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1.5 bg-transparent border-0 cursor-pointer"
              title={t.export}
            >
              <Upload size={14} />
              <span className="hidden sm:inline">{t.export}</span>
            </button>

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
              onClick={() => setShowLanding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white border-0 cursor-pointer transition-colors"
              title="Uitleg"
            >
              <BookOpen size={13} />
              <span className="hidden sm:inline">Uitleg</span>
            </button>

            <button
              onClick={() => setShowWelcome(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors bg-transparent border-0 cursor-pointer"
              title={t.home.viewGuide}
              aria-label={t.home.viewGuide}
            >
              <HelpCircle size={16} />
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
        <div className="px-4 sm:px-6 flex overflow-x-auto">
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
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all duration-150 cursor-pointer bg-transparent border-x-0 border-t-0 ${
                tab === tabMeta.id
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-semibold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span>{tabMeta.emoji}</span>
              {TAB_LABELS[tabMeta.id]}
              {tabMeta.id === 'results' && (
                <span className="ml-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                  Live
                </span>
              )}
            </button>
          ))}

          {/* Panel toggle — only shown when a side panel would appear */}
          {showSidePanel && (
            <button
              onClick={() => setPanelVisible(v => !v)}
              className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs whitespace-nowrap border-b-2 border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer bg-transparent border-x-0 border-t-0"
              title={panelVisible ? 'Verberg berekening' : 'Toon berekening'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="12" height="12" rx="2"/>
                <line x1="9" y1="1" x2="9" y2="13"/>
              </svg>
              {panelVisible ? 'Verberg' : 'Toon berekening'}
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 sm:px-6 py-6">
        <div key={tab} className="animate-slide-up-fade">
        {tab === 'home' && (
          <div className="space-y-6">
            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 rounded-2xl px-6 py-8 sm:px-8 sm:py-10 shadow-xl shadow-orange-500/20">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none animate-float-1" />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl pointer-events-none animate-float-2" />
              <div className="shimmer-sweep" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-white">
                  <div className="flex items-center gap-2 mb-2 animate-hero-item" style={{ '--hero-delay': '0ms' } as React.CSSProperties}>
                    <Sparkles size={18} className="text-white/90" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/90">{t.home.taxYear}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight m-0 animate-hero-item" style={{ '--hero-delay': '80ms' } as React.CSSProperties}>{t.home.welcome}</h2>
                  <p className="text-sm sm:text-base text-white/85 mt-1.5 max-w-2xl animate-hero-item" style={{ '--hero-delay': '160ms' } as React.CSSProperties}>
                    {t.home.subtitle}
                  </p>
                </div>
                <button
                  onClick={() => setShowLanding(true)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors border border-white/20 cursor-pointer whitespace-nowrap animate-hero-item"
                  style={{ '--hero-delay': '260ms' } as React.CSSProperties}
                >
                  <BookOpen size={16} /> Uitleg
                </button>
              </div>
            </div>

            {/* Section header */}
            <div className="flex items-end justify-between gap-2 px-1">
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 m-0">{t.home.yourTabs}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.home.toggleHint}</p>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{visibleTabs.length} / {ALL_TABS.length} {t.home.active}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {ALL_TABS.map((tabMeta, index) => {
                const enabled = enabledTabs.has(tabMeta.id);
                return (
                  <div
                    key={tabMeta.id}
                    className={`group relative bg-white dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-3 border animate-card-entrance home-tab-card ${
                      enabled
                        ? 'card-enabled border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700'
                        : 'border-slate-200/60 dark:border-slate-700/60 opacity-50 hover:opacity-75'
                    }`}
                    style={{ '--card-delay': `${index * 40}ms` } as React.CSSProperties}
                  >
                    {enabled && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-t-2xl" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none">{tabMeta.emoji}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm tracking-tight">{TAB_LABELS[tabMeta.id]}</span>
                      </div>
                      <button
                        onClick={() => toggleTab(tabMeta.id)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-0 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                          enabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        role="switch"
                        aria-checked={enabled}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-1">{tabMeta.description}</p>
                    {enabled && (
                      <button
                        onClick={() => setTab(tabMeta.id)}
                        className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold text-left bg-transparent border-0 cursor-pointer p-0 transition-all duration-200 group-hover:translate-x-1"
                      >
                        {t.home.openTab} {TAB_LABELS[tabMeta.id]} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-start gap-3 animate-info-card-in" style={{ '--info-delay': '420ms' } as React.CSSProperties}>
                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg p-2 flex-shrink-0">🔒</div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 m-0">{t.home.localTitle}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 leading-relaxed">{t.home.localDesc}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-start gap-3 animate-info-card-in" style={{ '--info-delay': '520ms' } as React.CSSProperties}>
                <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg p-2 flex-shrink-0">⚡</div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 m-0">{t.home.liveTitle}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 leading-relaxed">{t.home.liveDesc}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-start gap-3 animate-info-card-in" style={{ '--info-delay': '620ms' } as React.CSSProperties}>
                <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg p-2 flex-shrink-0">💾</div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 m-0">{t.home.autoSaveTitle}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 leading-relaxed">{t.home.autoSaveDesc}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two-column layout for input tabs on wide screens */}
        {showSidePanel && (
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-y-6">
            {/* Left: tab content */}
            <div className="min-w-0 flex-1">
              {tab === 'income' && (
                <div className="space-y-4">
                  <IncomeSection
                    data={data.income}
                    onChange={income => setData(d => ({ ...d, income }))}
                  />
                  <InfoBox>
                    <strong>Box 1</strong> — 35,82% (t/m €38.441) · 37,48% (€38.441–€78.426) · 49,50% (boven €78.426).
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
                    Fictief rendement 2026: spaargeld <strong>1,03%</strong> · beleggingen <strong>5,88%</strong> · schulden <strong>2,62%</strong>.
                    Heffingvrij: <strong>€57.684</strong> / <strong>€115.368</strong> (partners).
                  </InfoBox>
                </div>
              )}
              {tab === 'expenses' && (
                <ExpensesSection
                  data={data.expenses}
                  onChange={expenses => setData(d => ({ ...d, expenses }))}
                  savings={data.savings}
                  onSavingsChange={savings => setData(d => ({ ...d, savings }))}
                  woon={data.woon}
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
                <PortfolioSection
                  data={data.portfolio}
                  onChange={portfolio => setData(d => ({ ...d, portfolio }))}
                />
              )}
              {tab === 'afschrijvingen' && (
                <AfschrijvingenSection
                  data={data.afschrijvingen}
                  taxYear={data.personal.taxYear}
                  onChange={afschrijvingen => setData(d => ({ ...d, afschrijvingen }))}
                />
              )}
              {tab === 'schenkingen' && (
                <SchenkingenSection
                  data={data.schenkingen}
                  taxYear={data.personal.taxYear}
                  onChange={schenkingen => setData(d => ({ ...d, schenkingen }))}
                />
              )}
              {tab === 'jaarruimte' && <JaarruimteSection data={data} />}
            </div>

            {/* Resize handle + right panel — hidden when user collapses them */}
            {panelVisible && (
              <>
                <div
                  onMouseDown={onResizeStart}
                  className="hidden xl:flex flex-col items-center w-3 flex-none cursor-col-resize group select-none"
                >
                  <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-400 transition-colors rounded-full" />
                </div>
                <div
                  className="xl:sticky xl:top-[89px] xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto flex-none min-w-0"
                  style={{ width: panelWidth }}
                >
                  <TaxResults result={result} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'results' && <TaxResults result={result} />}
        {tab === 'prognose' && (
          <NetWorthProjection
            data={data}
            config={prognose}
            onConfigChange={setPrognose}
          />
        )}
        {tab === 'marginale' && <MarginaleDrukChart data={data} />}
        </div>
      </main>

      <footer className="px-4 sm:px-6 py-6 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 mt-4">
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
