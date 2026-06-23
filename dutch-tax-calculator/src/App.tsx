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
import SchenkingenSection from './components/SchenkingenSection';
import BankRekeningenSection from './components/BankRekeningenSection';
import MarginaleDrukChart from './components/MarginaleDrukChart';
import JaarruimteSection from './components/JaarruimteSection';
import BugReportWidget from './components/BugReportWidget';
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

const APP_VERSION          = 'v1.31.2';
const STORAGE_KEY          = 'nl-belasting-data-v1';
const PROGNOSE_STORAGE_KEY = 'nl-belasting-prognose-v1';
const TABS_STORAGE_KEY     = 'nl-belasting-tabs-v1';
const THEME_STORAGE_KEY    = 'nl-belasting-theme';

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
  inflatie:             2.0,
};

function loadSavedData(): TaxFormData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const saved = JSON.parse(raw) as Partial<TaxFormData>;
    return {
      ...DEFAULT_DATA,
      ...saved,
      personal:  { ...DEFAULT_DATA.personal,  ...saved.personal  },
      woon:      { ...DEFAULT_DATA.woon,       ...saved.woon,
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

interface TabMeta { id: Tab; description: string }

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
  const [data, setData]               = useState<TaxFormData>(loadSavedData);
  const [prognose, setPrognose]       = useState<PrognoseConfig>(loadSavedPrognose);
  const [enabledTabs, setEnabledTabs] = useState<Set<Tab>>(loadEnabledTabs);
  const [tab, setTab]                 = useState<AnyTab>('income');
  const [isDark, setIsDark]           = useState<boolean>(loadInitialDark);
  const [panelWidth, setPanelWidth]   = useState(() => Math.round(window.innerWidth * 0.35));
  const [panelVisible, setPanelVisible] = useState(true);
  const importRef                     = useRef<HTMLInputElement>(null);
  const resizeDragRef                 = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startX: e.clientX, startWidth: panelWidth };
    const onMove = (me: MouseEvent) => {
      if (!resizeDragRef.current) return;
      const dx = resizeDragRef.current.startX - me.clientX;
      setPanelWidth(Math.max(280, Math.min(Math.round(window.innerWidth * 0.92), resizeDragRef.current.startWidth + dx)));
    };
    const onUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
        if (tab === id) setTab('income');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const ALL_TABS = useMemo<TabMeta[]>(() => [
    { id: 'income',         description: t.tabDescriptions.income },
    { id: 'woon',           description: t.tabDescriptions.woon },
    { id: 'waardes',        description: t.tabDescriptions.waardes },
    { id: 'expenses',       description: t.tabDescriptions.expenses },
    { id: 'schulden',       description: t.tabDescriptions.schulden },
    { id: 'bank',           description: t.tabDescriptions.bank },
    { id: 'portfolio',      description: t.tabDescriptions.portfolio },
    { id: 'afschrijvingen', description: t.tabDescriptions.afschrijvingen },
    { id: 'schenkingen',    description: t.tabDescriptions.schenkingen },
    { id: 'jaarruimte',     description: t.tabDescriptions.jaarruimte },
    { id: 'prognose',       description: t.tabDescriptions.prognose },
    { id: 'results',        description: t.tabDescriptions.results },
    { id: 'marginale',      description: t.tabDescriptions.marginale },
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
    schenkingen:    t.tabs.gifts,
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
      } catch { /* invalid file */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(PROGNOSE_STORAGE_KEY, JSON.stringify(prognose)); } catch { /* quota */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [prognose]);

  const result = useMemo(() => calculateTaxes(data), [data]);

  const setPersonal = (patch: Partial<TaxFormData['personal']>) =>
    setData(d => ({ ...d, personal: { ...d.personal, ...patch } }));

  const showSidePanel = tab !== 'home' && tab !== 'results' && tab !== 'prognose' && tab !== 'marginale';

  const hBg     = isDark ? '#0f172a' : '#ffffff';
  const hBorder = isDark ? '#1e293b' : '#e5e7eb';
  const rootBg  = isDark ? '#0f172a' : '#f9fafb';
  const rootFg  = isDark ? '#e2e8f0' : '#111827';

  return (
    <div style={{ minHeight: '100vh', background: rootBg, color: rootFg }}>

      {/* ── Header ── */}
      <header style={{ background: hBg, borderBottom: `1px solid ${hBorder}` }} className="sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-4">

          {/* Wordmark */}
          <div className="flex items-center gap-2">
            <Flag size={13} className="text-amber-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-500 tracking-tight">NL Belasting</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">{APP_VERSION}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Filing status */}
            <div className="flex items-center" style={{ border: `1px solid ${isDark ? '#2a2a2a' : '#d4d4d8'}`, borderRadius: 2 }}>
              {(['single', 'partner'] as FilingStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setPersonal({ filingStatus: s })}
                  style={{
                    background: data.personal.filingStatus === s
                      ? (isDark ? '#1e293b' : '#f3f4f6')
                      : 'transparent',
                    color: data.personal.filingStatus === s
                      ? (isDark ? '#f59e0b' : '#92400e')
                      : (isDark ? '#64748b' : '#6b7280'),
                  }}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 transition-colors cursor-pointer border-0"
                >
                  <Users size={10} />
                  {s === 'single' ? t.personal.single : t.personal.partner}
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              style={{ color: isDark ? '#555' : '#999' }}
              className="flex items-center gap-1 text-[11px] px-2 py-1 bg-transparent border-0 cursor-pointer hover:text-amber-500 transition-colors"
              title={t.export}
            >
              <Download size={12} />
              <span className="hidden sm:inline">{t.export}</span>
            </button>

            <label
              style={{ color: isDark ? '#555' : '#999' }}
              className="flex items-center gap-1 text-[11px] px-2 py-1 cursor-pointer hover:text-amber-500 transition-colors"
              title={t.import}
            >
              <Upload size={12} />
              <span className="hidden sm:inline">{t.import}</span>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>

            <button
              onClick={() => setData(DEFAULT_DATA)}
              style={{ color: isDark ? '#555' : '#999' }}
              className="flex items-center gap-1 text-[11px] px-2 py-1 bg-transparent border-0 cursor-pointer hover:text-amber-500 transition-colors"
              title={t.reset}
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">{t.reset}</span>
            </button>

            <button
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              style={{
                border: `1px solid ${isDark ? '#2a2a2a' : '#d4d4d8'}`,
                color: isDark ? '#666' : '#888',
                borderRadius: 2,
              }}
              className="text-[11px] px-2 py-0.5 bg-transparent cursor-pointer hover:text-amber-500 hover:border-amber-700 transition-colors"
            >
              {lang === 'nl' ? 'EN' : 'NL'}
            </button>

            <button
              onClick={() => setIsDark(d => !d)}
              style={{ color: isDark ? '#555' : '#999' }}
              className="flex items-center justify-center w-7 h-7 bg-transparent border-0 cursor-pointer hover:text-amber-500 transition-colors"
              aria-label={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div
          className="px-4 sm:px-6 flex overflow-x-auto"
          style={{ borderTop: `1px solid ${isDark ? '#191919' : '#e4e4e7'}` }}
        >
          <button
            onClick={() => setTab('home')}
            style={{
              borderBottom: `2px solid ${tab === 'home' ? '#f59e0b' : 'transparent'}`,
              color: tab === 'home' ? '#d97706' : (isDark ? '#94a3b8' : '#6b7280'),
            }}
            className="flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap border-x-0 border-t-0 bg-transparent cursor-pointer hover:text-amber-600 transition-colors"
          >
            <Home size={11} />
            Config
          </button>

          {visibleTabs.map(tabMeta => (
            <button
              key={tabMeta.id}
              onClick={() => setTab(tabMeta.id)}
              style={{
                borderBottom: `2px solid ${tab === tabMeta.id ? '#f59e0b' : 'transparent'}`,
                color: tab === tabMeta.id ? '#d97706' : (isDark ? '#94a3b8' : '#6b7280'),
              }}
              className="flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap border-x-0 border-t-0 bg-transparent cursor-pointer hover:text-amber-600 transition-colors"
            >
              {TAB_LABELS[tabMeta.id]}
              {tabMeta.id === 'results' && (
                <span className="text-amber-500 text-[8px] ml-0.5">●</span>
              )}
            </button>
          ))}

          {showSidePanel && (
            <button
              onClick={() => setPanelVisible(v => !v)}
              style={{ color: isDark ? '#444' : '#bbb' }}
              className="ml-auto shrink-0 flex items-center gap-1 px-3 py-2 text-[11px] whitespace-nowrap border-b-2 border-transparent border-x-0 border-t-0 bg-transparent cursor-pointer hover:text-amber-500 transition-colors"
              title={panelVisible ? 'Verberg berekening' : 'Toon berekening'}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="12" height="12" rx="1"/>
                <line x1="9" y1="1" x2="9" y2="13"/>
              </svg>
              <span className="hidden sm:inline">{panelVisible ? 'Verberg' : 'Toon'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="px-4 sm:px-6 py-5">

        {/* Config / tab management */}
        {tab === 'home' && (
          <div className="max-w-lg">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Belastingjaar 2026 — zet aan wat je nodig hebt. Gegevens blijven bewaard als je een sectie uitzet.
            </p>
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
              {ALL_TABS.map(tabMeta => {
                const enabled = enabledTabs.has(tabMeta.id);
                return (
                  <div key={tabMeta.id} className="flex items-start gap-4 px-4 py-3.5">
                    <button
                      onClick={() => toggleTab(tabMeta.id)}
                      role="switch"
                      aria-checked={enabled}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-0 transition-colors mt-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 ${
                        enabled ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-tight ${enabled ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {TAB_LABELS[tabMeta.id]}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {tabMeta.description}
                      </p>
                    </div>
                    {enabled && (
                      <button
                        onClick={() => setTab(tabMeta.id)}
                        className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 cursor-pointer bg-transparent border-0 mt-0.5 shrink-0 transition-colors font-medium"
                      >
                        Open →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Two-column layout for input tabs */}
        {showSidePanel && (
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-y-5">
            <div className="min-w-0 flex-1">
              {tab === 'income' && (
                <div className="space-y-4">
                  <IncomeSection
                    data={data.income}
                    onChange={income => setData(d => ({ ...d, income }))}
                  />
                  <InfoBox isDark={isDark}>{t.income.box1Info}</InfoBox>
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
                  <InfoBox isDark={isDark}>{t.income.box3Info}</InfoBox>
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

            {panelVisible && (
              <>
                <div
                  onMouseDown={onResizeStart}
                  className="hidden xl:flex flex-col items-center w-3 flex-none cursor-col-resize group select-none"
                >
                  <div
                    style={{ background: isDark ? '#222' : '#e4e4e7' }}
                    className="w-px flex-1 group-hover:bg-amber-700 transition-colors rounded-full"
                  />
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
      </main>

      <footer
        style={{ borderTop: `1px solid ${isDark ? '#191919' : '#e4e4e7'}`, color: isDark ? '#383838' : '#bbb' }}
        className="px-4 sm:px-6 py-4 text-[10px] mt-4"
      >
        Indicatieve berekening o.b.v. belastingregels 2026. Raadpleeg een belastingadviseur voor persoonlijk advies.
      </footer>

      <BugReportWidget appVersion={APP_VERSION} />
    </div>
  );
}

function InfoBox({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${isDark ? '#2d3748' : '#e5e7eb'}`,
        background: isDark ? '#1e293b' : '#f9fafb',
        color: isDark ? '#94a3b8' : '#6b7280',
        borderRadius: 6,
      }}
      className="px-3 py-2.5 text-xs leading-relaxed"
    >
      {children}
    </div>
  );
}
