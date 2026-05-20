import { useState, useCallback, useRef } from 'react';
import { Upload, Trash2, ChevronDown, ChevronRight, TrendingUp, AlertTriangle, GripVertical } from 'lucide-react';
import type { ExpensesData, SavingsData, WoonData } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TxCategory =
  | 'groceries' | 'transport' | 'insurance' | 'healthcare'
  | 'education' | 'leisure' | 'housing' | 'phone'
  | 'investments' | 'savings' | 'internal' | 'income' | 'other'
  | 'toeslagen' | 'duo_inkomen' | 'schenkingen';

export interface BankTx {
  datum: string;         // YYYYMMDD
  naam: string;
  code: string;
  afBij: 'Af' | 'Bij';
  bedrag: number;
  mutatiesoort: string;
  omschrijving: string;
  category: TxCategory;
  excluded: boolean;
}

const STORAGE_KEY = 'dutch-tax-bank-txs-v1';

// ── CSV parsing ────────────────────────────────────────────────────────────────

function parseEuroAmount(s: string): number {
  // ING uses "1.234,56" format
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

function categorize(naam: string, code: string, afBij: 'Af' | 'Bij', omschrijving: string): { category: TxCategory; excluded: boolean } {
  const n = naam.toUpperCase();
  const d = omschrijving.toUpperCase();

  // Internal: ING-internal rounding transfers
  if (naam === 'NOTPROVIDED') return { category: 'internal', excluded: true };
  // Savings: transfers to own savings account (visible, not hidden)
  if (n.includes('SPAARREKENING') || n.includes('ORANJE SPAAR'))
    return { category: 'savings', excluded: false };

  if (afBij === 'Bij') return { category: 'income', excluded: false };

  // Investments (outgoing to brokers)
  if (['IBKR', 'FLATEX', 'DEGIRO', 'TRADING 212'].some(k => n.includes(k)) ||
      n.includes('BUX VIA') || n.includes('BUX ') && code !== 'BA')
    return { category: 'investments', excluded: false };

  // Housing / rent
  if (n.includes('MAKELAARDIJ') || n.includes('MAKELA') || n.includes('WONINGCORP') ||
      n.includes('VESTIA') || n.includes('YMERE') || n.includes('WOONBEDRIJF') ||
      d.includes('MAANDHUUR') || d.includes(' HUUR ') || d.includes('NIERSSTRAAT') ||
      d.includes('KAMERADRES') || d.includes('KAMERHUUR'))
    return { category: 'housing', excluded: false };

  // Groceries
  if (['ALBERT HEIJN', 'BCK*AH', 'DIRK', 'JUMBO', 'LIDL', 'EKOPLAZA', 'DEKA',
       'PLUS RETAIL', 'COOP', 'HOOGVLIET', 'PARESTO', 'KRUIDVAT', 'ETOS', 'DEKAMARKT',
       'SPAR'].some(k => n.includes(k)) ||
      n.startsWith('AH ') || (code === 'BA' && (n.includes('MARKT') || n.includes('SUPER'))) ||
      (n.includes('ACTION') && code === 'BA'))
    return { category: 'groceries', excluded: false };

  // Transport
  if (['NS REIZIGERS', 'NS GROEP', 'GVB ', 'HTM ', 'RET ', 'CONNEXXION', 'ARRIVA',
       'TRANSDEV', 'Q-PARK', 'APCOA', 'SHELL ', 'BP ', 'ESSO ', 'TEXACO', 'TANGO '].some(k => n.includes(k)) ||
      n.includes('UBER') || n.includes('BOLT ') || n.includes('TAXI') ||
      n.includes('OV-CHIP') || n.includes('PARKEER') || n.includes('NS E-TICKETS') || d.includes('E-TICKETS'))
    return { category: 'transport', excluded: false };

  // Insurance
  if (['VGZ', 'MENZIS', 'ZILVEREN KRUIS', 'DSW', 'OHRA', 'CENTRAAL BEHEER',
       'AEGON', 'ANWB VERZEKER', 'ALLSECUR', 'INTERPOLIS', 'NATIONALE-NEDERLANDEN'].some(k => n.includes(k)) ||
      n.includes('ZORGVERZEKER') || (n.includes('CZ') && n.length <= 4))
    return { category: 'insurance', excluded: false };

  // Healthcare
  if (['APOTHEEK', 'HUISARTS', 'TANDARTS', 'FYSIOTHER', 'ZIEKENHUIS', 'KLINIEK',
       'SPECSAVERS', 'PEARLE', 'LENSPLAZA', 'GGD', 'PSYCHOL', 'OPTICIAN',
       'OPTIEKZAAK'].some(k => n.includes(k)) ||
      n.includes('MEDIC') || n.includes('PHARMACY') || n.includes('MEDICAMENT'))
    return { category: 'healthcare', excluded: false };

  // Phone / telecom
  if (['SIMYO', 'KPN ', 'VODAFONE', 'T-MOBILE', 'TELE2', 'YOUFONE', 'LEBARA',
       'ODIDO', 'HOLLANDS NIEUWE', 'BELLEN.COM'].some(k => n.includes(k)) ||
      n.startsWith('BEN '))
    return { category: 'phone', excluded: false };

  // Education
  if (n.includes('UNIVERSITEIT') || n.includes('HOGESCHOOL') || n.includes('BIBLIOTHEEK') ||
      n.includes('STUDIEBOEK') || n.includes('HBO ') || n.includes('COURSERA') ||
      n.includes('UDEMY') || (n.includes('DUO ') && code !== 'VZ'))
    return { category: 'education', excluded: false };

  // Leisure / entertainment
  if (['SPOTIFY', 'NETFLIX', 'VIDEOLAND', 'DISNEY', 'DAZN', 'GALL&GALL', 'GALL ',
       'FITNESS', 'SPORTSCHOOL', 'TICKETMASTER', 'EVENTIM', 'MCDONALDS', 'MC DONALDS',
       'BURGER KING', 'DOMINOS', 'PIZZA', 'ALIPAY', 'DELIVEROO', 'THUISBEZORGD',
       'UBER EATS', 'STEAM ', 'PLAYSTATION', 'XBOX ', 'NINTENDO', 'BOOKING.COM',
       'AIRBNB', 'HOTELS'].some(k => n.includes(k)) ||
      n.includes('BCK*VUE') || n.includes('BCK*PATH') || n.includes('VUE ') ||
      n.includes('CCV*VUE') || n.includes('CCV*PATH') || n.includes('BIOSCOOP') ||
      n.includes('SLIJTER') || n.includes('CCV*STUDENT') || n.includes('STICHTING SEVENDE'))
    return { category: 'leisure', excluded: false };

  return { category: 'other', excluded: false };
}

function parseING(csv: string): BankTx[] {
  const lines = csv.trim().split('\n').slice(1); // skip header
  return lines.flatMap(line => {
    try {
      const fields = line.split('";"').map(f => f.replace(/^"|"$/g, ''));
      if (fields.length < 9) return [];
      const [datum, naam, , , code, afBij, bedragStr, mutatiesoort, omschrijving] = fields;
      if (!datum || !afBij) return [];
      const bedrag = parseEuroAmount(bedragStr);
      if (bedrag <= 0) return [];
      const { category, excluded } = categorize(naam, code, afBij as 'Af' | 'Bij', omschrijving);
      return [{ datum, naam, code, afBij: afBij as 'Af' | 'Bij', bedrag, mutatiesoort, omschrijving, category, excluded }];
    } catch { return []; }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dateToDMY(d: string): string {
  return `${d.slice(6, 8)}-${d.slice(4, 6)}-${d.slice(0, 4)}`;
}

function detectPeriod(txs: BankTx[]): string {
  if (!txs.length) return '';
  const dates = txs.map(t => t.datum).sort();
  const from = dateToDMY(dates[0]);
  const to   = dateToDMY(dates[dates.length - 1]);
  return from === to ? from : `${from} – ${to}`;
}

function monthsInPeriod(txs: BankTx[]): number {
  if (!txs.length) return 1;
  const dates = txs.map(t => +t.datum).sort();
  const start = dates[0];
  const end   = dates[dates.length - 1];
  const startY = Math.floor(start / 10000), startM = Math.floor((start % 10000) / 100);
  const endY   = Math.floor(end / 10000),   endM   = Math.floor((end % 10000) / 100);
  return Math.max(1, (endY - startY) * 12 + (endM - startM) + 1);
}

function loadStored(): BankTx[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function txKey(tx: BankTx) {
  return `${tx.datum}_${tx.naam}_${tx.bedrag}_${tx.afBij}`;
}

const RECLASSIFIABLE: { key: TxCategory; nlLabel: string }[] = [
  { key: 'groceries',  nlLabel: 'Boodschappen' },
  { key: 'transport',  nlLabel: 'Transport' },
  { key: 'insurance',  nlLabel: 'Verzekeringen' },
  { key: 'healthcare', nlLabel: 'Zorg' },
  { key: 'leisure',    nlLabel: 'Vrije tijd' },
  { key: 'education',  nlLabel: 'Opleiding' },
  { key: 'housing',    nlLabel: 'Huur / hypotheek' },
  { key: 'phone',      nlLabel: 'Telefoon' },
  { key: 'investments',nlLabel: 'Beleggingen' },
  { key: 'savings',    nlLabel: 'Sparen' },
  { key: 'income',      nlLabel: 'Inkomsten (bruto)' },
  { key: 'toeslagen',  nlLabel: 'Toeslagen' },
  { key: 'duo_inkomen',nlLabel: 'DUO lening ontvangen' },
  { key: 'schenkingen',nlLabel: 'Schenkingen ontvangen' },
  { key: 'other',      nlLabel: 'Overig' },
  { key: 'internal',   nlLabel: '— Verbergen —' },
];

// ── Category config ────────────────────────────────────────────────────────────

interface CatConfig {
  key: TxCategory;
  expKey?: keyof ExpensesData;
  nlLabel: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

const CAT_CONFIGS: CatConfig[] = [
  { key: 'housing',    nlLabel: 'Huur / hypotheek',     color: 'bg-slate-500',   bg: 'bg-slate-50 dark:bg-slate-900',       border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-200' },
  { key: 'groceries',  expKey: 'groceries', nlLabel: 'Boodschappen',        color: 'bg-green-500',   bg: 'bg-green-50 dark:bg-green-900/20',    border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
  { key: 'transport',  expKey: 'transport', nlLabel: 'Transport',           color: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-200 dark:border-blue-800',  text: 'text-blue-700 dark:text-blue-300' },
  { key: 'insurance',  expKey: 'insurance', nlLabel: 'Verzekeringen',       color: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',    border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300' },
  { key: 'healthcare', expKey: 'healthcare', nlLabel: 'Zorg',               color: 'bg-rose-500',    bg: 'bg-rose-50 dark:bg-rose-900/20',      border: 'border-rose-200 dark:border-rose-800',  text: 'text-rose-700 dark:text-rose-300' },
  { key: 'leisure',    expKey: 'leisure',   nlLabel: 'Vrije tijd',          color: 'bg-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20',  border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300' },
  { key: 'education',  expKey: 'education', nlLabel: 'Opleiding',           color: 'bg-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-900/20',  border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
  { key: 'phone',      nlLabel: 'Telefoon / internet',  color: 'bg-cyan-500',    bg: 'bg-cyan-50 dark:bg-cyan-900/20',      border: 'border-cyan-200 dark:border-cyan-800',  text: 'text-cyan-700 dark:text-cyan-300' },
  { key: 'other',      expKey: 'other',     nlLabel: 'Overig',              color: 'bg-slate-400',   bg: 'bg-slate-50 dark:bg-slate-900',       border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-300' },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  expenses: ExpensesData;
  savings: SavingsData;
  woon: WoonData;
}

function calcMonthlyHousing(woon: WoonData): number {
  const extra = woon.gwe + woon.vve + woon.overig;
  if (woon.woningType === 'huur') return woon.maandhuur + extra;
  let hyp = 0;
  for (const h of woon.hypotheken) {
    const r = h.rentePercentage / 100 / 12;
    const n = h.looptijd;
    if (h.type === 'aflossingsvrijij') {
      hyp += h.leningBedrag * r;
    } else if (h.type === 'lineair') {
      hyp += h.leningBedrag / n + h.leningBedrag * r;
    } else {
      hyp += r === 0 ? h.leningBedrag / n : h.leningBedrag * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    }
  }
  return hyp + extra;
}

export default function BankImportTab({ expenses, savings, woon }: Props) {
  const { t } = useLanguage();
  const [txs, setTxs]          = useState<BankTx[]>(loadStored);
  const [dragging, setDragging]  = useState(false);
  const [error, setError]        = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<{ newCount: number; dupCount: number; from: string; to: string } | null>(null);
  const [expanded, setExpanded]  = useState<Set<TxCategory>>(new Set());
  const [dropTarget, setDropTarget] = useState<TxCategory | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setImportInfo(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const csv = e.target?.result as string;
        const parsed = parseING(csv);
        if (!parsed.length) { setError(t.expenses.importNoData); return; }

        const existingKeys = new Set(txs.map(txKey));
        const dupCount = parsed.filter(tx => existingKeys.has(txKey(tx))).length;
        const newTxs   = parsed.filter(tx => !existingKeys.has(txKey(tx)));

        const next = [...txs, ...newTxs];
        setTxs(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

        if (dupCount > 0 || next.length > 0) {
          const allDates = next.map(t => t.datum).sort();
          setImportInfo({
            newCount: newTxs.length,
            dupCount,
            from: dateToDMY(allDates[0]),
            to:   dateToDMY(allDates[allDates.length - 1]),
          });
        }
      } catch { setError(t.expenses.importParseError); }
    };
    reader.readAsText(file, 'utf-8');
  }, [txs, t]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
    else setError(t.expenses.importCsvOnly);
  }, [handleFile, t]);

  function clearAll() {
    setTxs([]); localStorage.removeItem(STORAGE_KEY);
  }

  function recat(key: string, cat: TxCategory) {
    const next = txs.map(tx =>
      txKey(tx) === key ? { ...tx, category: cat, excluded: cat === 'internal' } : tx
    );
    setTxs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleCat(cat: TxCategory) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const activeTxs  = txs.filter(t => !t.excluded);
  const months     = monthsInPeriod(txs);
  const period     = detectPeriod(txs);

  const sumCat = (cat: TxCategory) =>
    activeTxs.filter(x => x.category === cat && x.afBij === 'Af').reduce((s, x) => s + x.bedrag, 0);

  const incomeTotal    = activeTxs.filter(x => ['income','toeslagen','duo_inkomen','schenkingen'].includes(x.category) && x.afBij === 'Bij').reduce((s, x) => s + x.bedrag, 0);
  const investTotal    = sumCat('investments');
  const savingsTotal   = activeTxs.filter(x => x.category === 'savings' && x.afBij === 'Af').reduce((s, x) => s + x.bedrag, 0);
  const totalSpending  = CAT_CONFIGS.filter(c => c.key !== 'investments').reduce((s, c) => s + sumCat(c.key), 0);

  const housingMonthly = calcMonthlyHousing(woon);

  // budget for a given expense key, normalized to same period
  const budgetAmt = (cfg: CatConfig) => {
    if (cfg.key === 'housing') return housingMonthly * months;
    return cfg.expKey ? expenses[cfg.expKey] * months : 0;
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!txs.length) {
    return (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer
            ${dragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} className="mx-auto mb-3 text-slate-400" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.expenses.importTitle}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.expenses.importSubtitle}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{t.expenses.importDrop}</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
            {t.expenses.importClick}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold">{t.expenses.importHowTo}</p>
          <p>{t.expenses.importHowToING}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {txs.length} {t.expenses.importTransactions}
            {months > 1 && <span className="ml-1 text-slate-400 font-normal">({months} {t.expenses.importMonths})</span>}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{period}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Upload size={13} /> {t.expenses.importAdd}
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={13} /> {t.expenses.importClear}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      </div>

      {/* Duplicate import warning */}
      {importInfo && importInfo.dupCount > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>{importInfo.dupCount}</strong> {t.expenses.importDupSkipped}.{' '}
            {importInfo.newCount > 0 && <><strong>{importInfo.newCount}</strong> {t.expenses.importNewAdded}. </>}
            {t.expenses.importDataFrom} <strong>{importInfo.from}</strong> – <strong>{importInfo.to}</strong>.
          </span>
        </div>
      )}
      {importInfo && importInfo.dupCount === 0 && importInfo.newCount > 0 && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-sm text-green-700 dark:text-green-300">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <strong>{importInfo.newCount}</strong> {t.expenses.importNewAdded}. {t.expenses.importDataFrom} <strong>{importInfo.from}</strong> – <strong>{importInfo.to}</strong>.
          </span>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
          <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">{t.expenses.importIncome}</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{fmt.format(incomeTotal)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">{t.expenses.importExpenses}</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmt.format(totalSpending)}</p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 text-center">
          <p className="text-xs text-violet-600 dark:text-violet-400 mb-1 font-medium">{t.expenses.importInvested}</p>
          <p className="text-lg font-bold text-violet-700 dark:text-violet-300">{fmt.format(investTotal)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Sparen</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt.format(savingsTotal)}</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.expenses.importBreakdown}</span>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>{t.expenses.importActual}</span>
            <span>{t.expenses.importBudget}</span>
          </div>
        </div>

        {CAT_CONFIGS.map(cfg => {
          const actual  = sumCat(cfg.key);
          const txList  = activeTxs.filter(x => x.category === cfg.key && x.afBij === 'Af');
          if (!actual && !cfg.expKey) return null;

          const budget  = budgetAmt(cfg);
          const diff    = budget > 0 ? actual - budget : null;
          const over    = diff !== null && diff > 0;
          const maxBar  = budget > 0 ? Math.max(actual, budget) : actual || 1;
          const isOpen  = expanded.has(cfg.key);

          return (
            <div key={cfg.key} className={`border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors ${dropTarget === cfg.key ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              onDragOver={e => { e.preventDefault(); setDropTarget(cfg.key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
              onDrop={e => { e.preventDefault(); const k = e.dataTransfer.getData('tx-key'); if (k) recat(k, cfg.key); setDropTarget(null); }}
            >
              <button
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                onClick={() => toggleCat(cfg.key)}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.color}`} />
                <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0">{cfg.nlLabel}</span>

                {/* Budget comparison */}
                <div className="flex items-center gap-3 shrink-0">
                  {budget > 0 && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                        <div className={`absolute top-0 left-0 h-full rounded-full ${over ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(100, (actual / maxBar) * 100)}%` }} />
                        <div className="absolute top-0 left-0 h-full border-r-2 border-slate-400 dark:border-slate-500"
                          style={{ width: `${(budget / maxBar) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <span className={`text-sm font-semibold tabular-nums w-20 text-right ${over ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {fmtDec.format(actual)}
                  </span>
                  {budget > 0 && (
                    <span className="text-xs tabular-nums w-20 text-right text-slate-400">{fmt.format(budget)}</span>
                  )}
                  {budget === 0 && <span className="w-20" />}
                  {diff !== null && (
                    <span className={`text-xs tabular-nums w-16 text-right font-medium ${over ? 'text-red-500' : 'text-green-600'}`}>
                      {over ? '+' : '−'}{fmt.format(Math.abs(diff))}
                    </span>
                  )}
                  {diff === null && <span className="w-16" />}
                  {txList.length > 0
                    ? (isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />)
                    : <span className="w-3.5" />
                  }
                </div>
              </button>

              {/* Transaction list */}
              {isOpen && txList.length > 0 && (
                <div className={`px-3 pb-3 space-y-0.5 ${cfg.bg} border-t ${cfg.border}`}>
                  {txList.map(tx => (
                    <div
                      key={txKey(tx)}
                      className="flex items-center gap-2 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 px-2 group cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('tx-key', txKey(tx)); e.dataTransfer.effectAllowed = 'move'; }}
                    >
                      <GripVertical size={12} className="text-slate-300 dark:text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-slate-400 shrink-0 w-16 font-mono">{dateToDMY(tx.datum)}</span>
                      <span className={`flex-1 min-w-0 truncate ${cfg.text}`} title={tx.naam}>{tx.naam}</span>
                      <span className="shrink-0 font-medium tabular-nums text-slate-700 dark:text-slate-200">{fmtDec.format(tx.bedrag)}</span>
                      <select
                        value={tx.category}
                        onChange={e => recat(txKey(tx), e.target.value as TxCategory)}
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 text-xs border border-slate-200 dark:border-slate-600 rounded-md px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        {RECLASSIFIABLE.map(c => <option key={c.key} value={c.key}>{c.nlLabel}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-700 px-2">
                    <span className="flex-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{txList.length} transacties</span>
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtDec.format(actual)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Beleggingen row */}
      {investTotal > 0 && (
        <div className={`bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl transition-colors ${dropTarget === 'investments' ? 'ring-2 ring-violet-400' : ''}`}
          onDragOver={e => { e.preventDefault(); setDropTarget('investments'); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
          onDrop={e => { e.preventDefault(); const k = e.dataTransfer.getData('tx-key'); if (k) recat(k, 'investments'); setDropTarget(null); }}
        >
          <button className="w-full flex items-center gap-3 px-5 py-3 text-left"
            onClick={() => toggleCat('investments')}>
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-violet-500" />
            <span className="text-sm text-violet-700 dark:text-violet-300 flex-1">Beleggingen</span>
            <span className="text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300 mr-2">{fmtDec.format(investTotal)}</span>
            <span className="text-xs text-violet-500 mr-4">
              {t.expenses.importBudget}: {fmt.format(savings.maandelijksBeleggen * months)}
            </span>
            {expanded.has('investments')
              ? <ChevronDown size={14} className="text-violet-400 shrink-0" />
              : <ChevronRight size={14} className="text-violet-400 shrink-0" />}
          </button>
          {expanded.has('investments') && (
            <div className="px-3 pb-3 border-t border-violet-200 dark:border-violet-800 space-y-0.5">
              {activeTxs.filter(x => x.category === 'investments').map(tx => (
                <div key={txKey(tx)} className="flex items-center gap-2 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 px-2 group cursor-grab"
                  draggable onDragStart={e => { e.dataTransfer.setData('tx-key', txKey(tx)); }}>
                  <GripVertical size={12} className="text-violet-300 shrink-0 opacity-0 group-hover:opacity-100" />
                  <span className="text-violet-400 shrink-0 w-16 font-mono">{dateToDMY(tx.datum)}</span>
                  <span className="flex-1 min-w-0 truncate text-violet-700 dark:text-violet-300">{tx.naam}</span>
                  <span className="shrink-0 font-medium tabular-nums text-violet-700 dark:text-violet-300">{fmtDec.format(tx.bedrag)}</span>
                  <select value={tx.category} onChange={e => recat(txKey(tx), e.target.value as TxCategory)} onClick={e => e.stopPropagation()}
                    className="shrink-0 text-xs border border-violet-200 dark:border-violet-600 rounded-md px-1 py-0.5 bg-white dark:bg-slate-700 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    {RECLASSIFIABLE.map(c => <option key={c.key} value={c.key}>{c.nlLabel}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sparen row */}
      {(savingsTotal > 0 || activeTxs.some(x => x.category === 'savings')) && (
        <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors ${dropTarget === 'savings' ? 'ring-2 ring-blue-400' : ''}`}
          onDragOver={e => { e.preventDefault(); setDropTarget('savings'); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
          onDrop={e => { e.preventDefault(); const k = e.dataTransfer.getData('tx-key'); if (k) recat(k, 'savings'); setDropTarget(null); }}
        >
          <button className="w-full flex items-center gap-3 px-5 py-3 text-left"
            onClick={() => toggleCat('savings')}>
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">Sparen</span>
            <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300 mr-2">{fmtDec.format(savingsTotal)}</span>
            <span className="text-xs text-blue-500 mr-4">
              {t.expenses.importBudget}: {fmt.format(savings.monthlySavingsContribution * months)}
            </span>
            {expanded.has('savings')
              ? <ChevronDown size={14} className="text-blue-400 shrink-0" />
              : <ChevronRight size={14} className="text-blue-400 shrink-0" />}
          </button>
          {expanded.has('savings') && (
            <div className="px-3 pb-3 border-t border-blue-200 dark:border-blue-800 space-y-0.5">
              {activeTxs.filter(x => x.category === 'savings').map(tx => (
                <div key={txKey(tx)} className="flex items-center gap-2 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 px-2 group cursor-grab"
                  draggable onDragStart={e => { e.dataTransfer.setData('tx-key', txKey(tx)); }}>
                  <GripVertical size={12} className="text-blue-300 shrink-0 opacity-0 group-hover:opacity-100" />
                  <span className="text-blue-400 shrink-0 w-16 font-mono">{dateToDMY(tx.datum)}</span>
                  <span className="flex-1 min-w-0 truncate text-blue-700 dark:text-blue-300">{tx.naam}</span>
                  <span className={`shrink-0 font-medium tabular-nums text-blue-700 dark:text-blue-300`}>
                    {tx.afBij === 'Bij' ? '+' : ''}{fmtDec.format(tx.bedrag)}
                  </span>
                  <select value={tx.category} onChange={e => recat(txKey(tx), e.target.value as TxCategory)} onClick={e => e.stopPropagation()}
                    className="shrink-0 text-xs border border-blue-200 dark:border-blue-600 rounded-md px-1 py-0.5 bg-white dark:bg-slate-700 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    {RECLASSIFIABLE.map(c => <option key={c.key} value={c.key}>{c.nlLabel}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Income breakdown — grouped by sub-category */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-green-200 dark:border-green-800">
          <TrendingUp size={16} className="text-green-500 shrink-0" />
          <span className="text-sm font-semibold text-green-700 dark:text-green-300 flex-1">{t.expenses.importIncome}</span>
          <span className="text-sm font-semibold tabular-nums text-green-700 dark:text-green-300">{fmtDec.format(incomeTotal)}</span>
        </div>
        {/* Sub-category rows */}
        {([
          { key: 'income'      as TxCategory, label: 'Inkomsten (bruto)',     textColor: 'text-green-700 dark:text-green-300',   dropKey: 'income'       },
          { key: 'toeslagen'   as TxCategory, label: 'Toeslagen',             textColor: 'text-teal-700 dark:text-teal-300',     dropKey: 'toeslagen'    },
          { key: 'duo_inkomen' as TxCategory, label: 'DUO lening ontvangen',  textColor: 'text-blue-700 dark:text-blue-300',     dropKey: 'duo_inkomen'  },
          { key: 'schenkingen' as TxCategory, label: 'Schenkingen ontvangen', textColor: 'text-emerald-700 dark:text-emerald-300', dropKey: 'schenkingen' },
        ] as const).map(sub => {
          const txList = activeTxs.filter(x => x.category === sub.key && x.afBij === 'Bij');
          if (!txList.length) return null;
          const total  = txList.reduce((s, x) => s + x.bedrag, 0);
          const isOpen = expanded.has(sub.key);
          return (
            <div key={sub.key}
              className={`border-t border-green-200 dark:border-green-800 transition-colors ${dropTarget === sub.key ? 'bg-green-100 dark:bg-green-900/40' : ''}`}
              onDragOver={e => { e.preventDefault(); setDropTarget(sub.key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
              onDrop={e => { e.preventDefault(); const k = e.dataTransfer.getData('tx-key'); if (k) recat(k, sub.key); setDropTarget(null); }}
            >
              <button
                className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-green-100/60 dark:hover:bg-green-900/30 transition-colors"
                onClick={() => toggleCat(sub.key)}>
                <span className={`text-xs font-medium ${sub.textColor} flex-1`}>{sub.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${sub.textColor} mr-2`}>+{fmtDec.format(total)}</span>
                {isOpen ? <ChevronDown size={14} className="text-green-400 shrink-0" /> : <ChevronRight size={14} className="text-green-400 shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 bg-green-100/40 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 space-y-0.5">
                  {txList.map(tx => (
                    <div key={txKey(tx)} className="flex items-center gap-2 py-1.5 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 px-2 group cursor-grab"
                      draggable onDragStart={e => { e.dataTransfer.setData('tx-key', txKey(tx)); e.dataTransfer.effectAllowed = 'move'; }}>
                      <GripVertical size={12} className="text-green-300 dark:text-green-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-green-400 shrink-0 w-16 font-mono">{dateToDMY(tx.datum)}</span>
                      <span className={`flex-1 min-w-0 truncate ${sub.textColor}`} title={tx.naam}>{tx.naam}</span>
                      <span className={`shrink-0 font-medium tabular-nums ${sub.textColor}`}>+{fmtDec.format(tx.bedrag)}</span>
                      <select value={tx.category} onChange={e => recat(txKey(tx), e.target.value as TxCategory)} onClick={e => e.stopPropagation()}
                        className="shrink-0 text-xs border border-green-200 dark:border-green-600 rounded-md px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                        {RECLASSIFIABLE.map(c => <option key={c.key} value={c.key}>{c.nlLabel}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-green-200 dark:border-green-700 px-2">
                    <span className="flex-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{txList.length} transacties</span>
                    <span className={`text-xs font-bold tabular-nums ${sub.textColor}`}>+{fmtDec.format(total)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-4 px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{t.expenses.importLegendUnder}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{t.expenses.importLegendOver}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-slate-400" />{t.expenses.importLegendBudget}</span>
      </div>
    </div>
  );
}
