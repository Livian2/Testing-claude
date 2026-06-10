import { useMemo, useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, Info, Gift, Wallet } from 'lucide-react';
import type { TaxResult } from '../types';
import { fmt, fmtPct } from '../utils/taxCalculations';
import { useLanguage } from '../i18n/LanguageContext';

interface Props { result: TaxResult }

function Row({ label, value, bold, green, red, indent }: {
  label: string; value: string; bold?: boolean; green?: boolean; red?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-1.5 text-sm ${bold ? 'font-semibold border-t border-slate-200 dark:border-slate-700 mt-1 pt-2' : 'border-b border-slate-50 dark:border-slate-700'}`}>
      <span className={`min-w-0 ${indent ? 'pl-3 text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{label}</span>
      <span className={`ml-auto shrink-0 tabular-nums ${bold ? (red ? 'text-red-600' : green ? 'text-green-600' : 'text-slate-800 dark:text-slate-100') : (green ? 'text-green-600' : red ? 'text-red-500' : 'text-slate-700 dark:text-slate-200')}`}>
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`min-w-0 rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1.5 truncate">{label}</p>
      <p className="text-xl lg:text-2xl font-bold truncate">{value}</p>
    </div>
  );
}

export default function TaxResults({ result }: Props) {
  const { t } = useLanguage();
  const {
    box1, box3, toeslagen, totalTax, netDisposableIncome, totalExpenses,
    annualSavings, annualInvestments,
    portfolioCurrentValue,
    actualSavingsInterest, currentNetWorth, wozAsset, hypotheekRestschuld,
    afschrijvingenActueel,
    duoJaarbetaling, duoLeningJaar, afschrijvingenJaarDeposit,
    schenkbelasting, schenkNetOntvangen,
  } = result;

  const [cfTab, setCfTab] = useState<'verwacht' | 'werkelijk'>('verwacht');

  // ── Bank actuals (from localStorage, raw totals — NOT annualized) ──────────
  const {
    hasBankData, budgetScale,
    aktIncome, aktToeslagen, aktDuoInkomen, aktSchenk, aktExpenses, aktInvest, aktSavings,
  } = useMemo(() => {
    interface RawTx { datum: string; category: string; afBij: string; bedrag: number; excluded: boolean; }
    let bankTxs: RawTx[];
    try { bankTxs = JSON.parse(localStorage.getItem('dutch-tax-bank-txs-v1') || '[]'); } catch { bankTxs = []; }

    let bankMonths = 1;
    if (bankTxs.length) {
      const dates = bankTxs.map(t => +t.datum).sort();
      const s = dates[0], e = dates[dates.length - 1];
      const sy = Math.floor(s / 10000), sm = Math.floor((s % 10000) / 100);
      const ey = Math.floor(e / 10000), em = Math.floor((e % 10000) / 100);
      bankMonths = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    }

    const EXPENSE_CATS = new Set(['groceries', 'transport', 'insurance', 'healthcare', 'education', 'leisure', 'other', 'housing', 'phone']);
    let income = 0, toesl = 0, duoInk = 0, schenk = 0, expenses = 0, invest = 0, savings = 0;
    for (const tx of bankTxs) {
      const bij = tx.afBij === 'Bij', af = tx.afBij === 'Af';
      if (tx.category === 'income'      && bij) income += tx.bedrag;
      else if (tx.category === 'toeslagen'   && bij) toesl += tx.bedrag;
      else if (tx.category === 'duo_inkomen' && bij) duoInk += tx.bedrag;
      else if (tx.category === 'schenkingen' && bij) schenk += tx.bedrag;
      else if (tx.category === 'investments' && af) invest += tx.bedrag;
      if (af && !tx.excluded && EXPENSE_CATS.has(tx.category)) expenses += tx.bedrag;
      if (tx.category === 'savings') savings += af ? tx.bedrag : -tx.bedrag;
    }
    return {
      hasBankData: bankTxs.length > 0,
      budgetScale: bankMonths / 12,
      aktIncome: income, aktToeslagen: toesl, aktDuoInkomen: duoInk, aktSchenk: schenk,
      aktExpenses: expenses, aktInvest: invest, aktSavings: savings,
    };
  }, []);

  const hasToeslagen = toeslagen.total > 0 || toeslagen.hypotheekrenteaftrek > 0;
  const grossIncome  = box1.taxableIncome;

  // Net worth breakdown — use rawDebts (actual debt, no Box 3 threshold applied)
  const totalAssets = box3.breakdown.savings + portfolioCurrentValue + Math.max(0, wozAsset);
  const totalDebts  = Math.max(0, hypotheekRestschuld) + Math.max(0, box3.rawDebts) + Math.max(0, afschrijvingenActueel);
  const assetSegments = [
    { label: t.results.savingsBalance, value: box3.breakdown.savings,    color: 'bg-blue-400',   textColor: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-800',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: t.results.portfolioValue, value: portfolioCurrentValue,     color: 'bg-violet-400', textColor: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    ...(wozAsset > 0 ? [{ label: t.resultsExtra.eigenWoning, value: wozAsset, color: 'bg-emerald-400', textColor: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }] : []),
  ].filter(s => s.value > 0);

  const debtSegments = [
    ...(hypotheekRestschuld > 0    ? [{ label: t.resultsExtra.hypotheekSchuld,       value: hypotheekRestschuld,   textColor: 'text-red-700 dark:text-red-300',    border: 'border-red-200 dark:border-red-800',    bg: 'bg-red-50 dark:bg-red-900/20'    }] : []),
    ...(box3.rawDebts > 0          ? [{ label: t.results.debtsBox3,                  value: box3.rawDebts,         textColor: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', bg: 'bg-orange-50 dark:bg-orange-900/20' }] : []),
    ...(afschrijvingenActueel > 0  ? [{ label: t.resultsExtra.savingsProvisions,     value: afschrijvingenActueel, textColor: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-900/20' }] : []),
  ];

  return (
    <div className="space-y-4">

      {/* ── Hero (full width) — flat ledger strip ── */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={16} className="text-slate-400 dark:text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.resultsExtra.taxCalcTitle}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200 dark:divide-slate-700">
          {[
            { label: t.results.totalTax,      value: fmt(totalTax),            cls: 'text-slate-800 dark:text-slate-100' },
            { label: t.results.box1Tax,       value: fmt(box1.netTax),         cls: 'text-slate-800 dark:text-slate-100' },
            { label: t.results.box3Tax,       value: fmt(box3.netTax),         cls: 'text-slate-800 dark:text-slate-100' },
            { label: t.results.netDisposable, value: fmt(netDisposableIncome), cls: netDisposableIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
          ].map(({ label, value, cls }, i) => (
            <div key={label} className={`min-w-0 px-4 ${i === 0 ? 'pl-0' : ''}`}>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 truncate">{label}</p>
              <p className={`text-lg lg:text-xl font-semibold font-mono tabular-nums truncate ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
        {hasToeslagen && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-2">
            <Gift size={15} className="text-teal-500 dark:text-teal-400 shrink-0" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {toeslagen.total > 0 && <>{t.resultsExtra.toeslagenReceive} <span className="text-teal-600 dark:text-teal-400 font-bold">{fmt(toeslagen.total)}</span> {t.resultsExtra.toeslagenSuffix}</>}
              {toeslagen.hypotheekrenteaftrek > 0 && <> {t.resultsExtra.hraAdvantage} <span className="text-blue-600 dark:text-blue-400 font-bold">{fmt(toeslagen.hypotheekrenteaftrek)}</span></>}
            </span>
          </div>
        )}
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

        {/* ════ LEFT COLUMN: Tax details ════ */}
        <div className="space-y-4">

          {/* ── Box 1 ── */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <TrendingUp size={16} className="text-slate-400 dark:text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.box1Title}</h3>
              <span className="ml-auto text-xs text-slate-400 shrink-0">{fmtPct(box1.effectiveRate)} {t.results.effectiveRate.toLowerCase()}</span>
            </div>
            <div className="p-5 space-y-4">

              {/* ── Summary pills ── */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label={t.results.taxableIncome} value={fmt(box1.taxableIncome)} color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" />
                <StatCard label={t.results.netBox1Tax}    value={fmt(box1.netTax)}          color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" />
              </div>

              {/* ── Income breakdown (only if deductions apply) ── */}
              {(box1.ewEffect !== 0 || box1.pensionDeduction > 0) && (
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-md p-4 border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">{t.resultsExtra.incomeBreakdown}</p>
                  <div className="space-y-0 max-w-sm">
                    <Row label={t.resultsExtra.grossIncomeLine} value={fmt(box1.grossIncomeBeforeDeductions)} />
                    {box1.ewEffect < 0 && (
                      <Row label={t.results.netDeductionHRA} value={`− ${fmt(Math.abs(box1.ewEffect))}`} indent green />
                    )}
                    {box1.ewEffect > 0 && (
                      <Row label={t.results.ewfIncomeLine} value={`+ ${fmt(box1.ewEffect)}`} indent red />
                    )}
                    {box1.pensionDeduction > 0 && (
                      <Row label={t.resultsExtra.pensionDeduction} value={`− ${fmt(box1.pensionDeduction)}`} indent green />
                    )}
                    <Row label={t.results.taxableIncome} value={fmt(box1.taxableIncome)} bold />
                  </div>
                </div>
              )}

              {/* ── Inkomstenbelasting box 1 (OLA-style) ── */}
              {box1.ibSchijven.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-md p-4 border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">{t.results.ibTitle}</p>
                  <div className="space-y-0">
                    {box1.ibSchijven.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs">
                        <span className="w-16 shrink-0 text-slate-600 dark:text-slate-300">{(t.results.schijfLabels)[i] ?? `${i + 1}e schijf`}</span>
                        <span className="w-12 shrink-0 text-right font-mono text-slate-500 dark:text-slate-400">{(s.ibRate * 100).toFixed(2).replace('.', ',')}%</span>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0">{t.results.schijfOf}</span>
                        <span className="flex-1 text-right text-slate-600 dark:text-slate-300 tabular-nums">{fmt(s.base)}</span>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0">=</span>
                        <span className="w-20 text-right font-semibold text-blue-700 dark:text-blue-400 tabular-nums shrink-0">{fmt(s.ibTax)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200 dark:border-slate-600">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.results.ibSubtotaal}</span>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums">{fmt(box1.ibSubtotaal)}</span>
                  </div>
                </div>
              )}

              {/* ── Premie volksverzekeringen (OLA-style) ── */}
              {box1.premieGrondslag > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-md p-4 border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">{t.results.premieTitle}</p>
                  <div className="space-y-0">
                    {[
                      { label: t.results.premieAOW, rate: 0.1790, tax: box1.premieAOW },
                      { label: t.results.premieANW, rate: 0.0010, tax: box1.premieANW },
                      { label: t.results.premieWLZ, rate: 0.0965, tax: box1.premieWLZ },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs">
                        <span className="w-16 shrink-0 text-slate-600 dark:text-slate-300">{p.label}</span>
                        <span className="w-12 shrink-0 text-right font-mono text-slate-500 dark:text-slate-400">{(p.rate * 100).toFixed(2).replace('.', ',')}%</span>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0">{t.results.schijfOf}</span>
                        <span className="flex-1 text-right text-slate-600 dark:text-slate-300 tabular-nums">{fmt(box1.premieGrondslag)}</span>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0">=</span>
                        <span className="w-20 text-right font-semibold text-indigo-700 dark:text-indigo-400 tabular-nums shrink-0">{fmt(p.tax)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200 dark:border-slate-600">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.results.premiesSubtotaal}</span>
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{fmt(box1.premiesSubtotaal)}</span>
                  </div>
                </div>
              )}

              {/* ── Totaal heffing voor kortingen ── */}
              {(box1.ibSchijven.length > 0 || box1.premieGrondslag > 0) && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                  <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{t.results.totalHeffingBox1}</span>
                  <span className="text-base font-bold text-orange-700 dark:text-orange-400 tabular-nums">{fmt(box1.ibSubtotaal + box1.premiesSubtotaal)}</span>
                </div>
              )}

              {/* ── Heffingskortingen (OLA-style) ── */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">{t.results.kortingen}</p>
                <div className="space-y-0">
                  <div className="flex items-center gap-3 py-1.5 border-b border-green-200 dark:border-green-800 text-sm">
                    <span className="flex-1 text-slate-700 dark:text-slate-200">{t.results.ahk}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-green-600 dark:text-green-400">− {fmt(box1.algemeneHeffingskorting)}</span>
                  </div>
                  <div className="flex items-center gap-3 py-1.5 border-b border-green-200 dark:border-green-800 text-sm">
                    <span className="flex-1 text-slate-700 dark:text-slate-200">{t.results.ak}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-green-600 dark:text-green-400">− {fmt(box1.arbeidskorting)}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-2 mt-1 border-t border-green-300 dark:border-green-700 text-sm font-semibold">
                    <span className="flex-1 text-slate-700 dark:text-slate-200">{t.results.totalKortingen}</span>
                    <span className="shrink-0 tabular-nums text-green-700 dark:text-green-300">− {fmt(box1.algemeneHeffingskorting + box1.arbeidskorting)}</span>
                  </div>
                </div>
              </div>

              {/* ── Netto Box 1 belasting ── */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
                <span className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100">{t.results.netBox1Tax}</span>
                <span className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(box1.netTax)}</span>
              </div>

            </div>
          </div>

          {/* ── Box 3 grondslag ── */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <TrendingUp size={16} className="text-slate-400 dark:text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.box3Title}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  {t.resultsExtra.box3Transition} <strong>{t.resultsExtra.box3RatesSavings}</strong>,
                  {' '}{t.resultsExtra.assetsRate588.split(' ')[0]} <strong>{t.resultsExtra.box3RatesAssets}</strong>,
                  {' '}{t.resultsExtra.debtsRate262.split(' ')[0]} <strong>{t.resultsExtra.box3RatesDebts}</strong>. {t.common.total} <strong>{t.resultsExtra.box3TaxRate}</strong>.
                  {' '}{t.results.exemption}: <strong>{t.resultsExtra.box3ExemptSingle}</strong> / <strong>{t.resultsExtra.box3ExemptPartner}</strong> {t.resultsExtra.box3ExemptPartnerLabel}.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard label={t.results.savingsBalance}  value={fmt(box3.breakdown.savings)}     color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" />
                <StatCard label={t.results.portfolioValue}  value={fmt(box3.breakdown.investments)} color="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300" />
                <StatCard label={t.results.taxableWealth}   value={fmt(box3.taxableWealth)}         color="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" />
                <StatCard label={t.results.box3TaxLabel}    value={fmt(box3.netTax)}                color="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400" />
              </div>

              {/* Grondslag breakdown */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Grondslag</p>
                  {[
                    { label: t.results.savingsBalance,   value: box3.breakdown.savings,                sign: '+' as const, color: 'text-blue-600' },
                    { label: t.results.portfolioValue,   value: box3.breakdown.investments,            sign: '+' as const, color: 'text-indigo-600' },
                    ...(box3.totalDebts > 0   ? [{ label: t.results.debtsBox3,     value: box3.totalDebts,                    sign: '−' as const, color: 'text-red-500' }]   : []),
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <span className="flex-1 min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">{r.label}</span>
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.color}`}>{r.sign} {fmt(r.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2 mt-1 border-t border-slate-200 dark:border-slate-600">
                    <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{t.results.netWorth}</span>
                    <span className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmt(box3.netWealth)}</span>
                  </div>
                </div>

                {box3.taxableWealth > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Fictief rendement</p>
                    {[
                      { label: t.resultsExtra.savingsRate103,  value: box3.breakdown.savingsFictitious,     sign: '+' as const, color: 'text-blue-600' },
                      { label: t.resultsExtra.assetsRate588,   value: box3.breakdown.investmentsFictitious, sign: '+' as const, color: 'text-indigo-600' },
                      ...(box3.breakdown.debtsFictitious > 0 ? [{ label: t.resultsExtra.debtsRate262, value: box3.breakdown.debtsFictitious, sign: '−' as const, color: 'text-green-600' }] : []),
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                        <span className="flex-1 min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">{r.label}</span>
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.color}`}>{r.sign} {fmt(r.value)}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 pt-2 mt-1 border-t border-slate-200 dark:border-slate-600">
                      <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{t.results.fictitiousReturn}</span>
                      <span className="text-base font-bold text-purple-600 tabular-nums">{fmt(box3.fictitiousReturn)}</span>
                    </div>
                  </div>
                )}

                {actualSavingsInterest > 0 && (
                  <div className="flex items-center gap-3 py-2 border-t border-slate-200 dark:border-slate-600">
                    <span className="flex-1 min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">{t.resultsExtra.actualSavingsRate}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-green-600">+ {fmt(actualSavingsInterest)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ════ RIGHT COLUMN: Financial overview ════ */}
        <div className="space-y-4">

          {/* ── Net worth visual ── */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <Wallet size={16} className="text-slate-400 dark:text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.netWorth}</h3>
            </div>
            <div className="p-6 space-y-5">

              {/* Big net worth number */}
              <div className="text-center py-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{t.results.netWorth}</p>
                <p className={`text-4xl font-bold tabular-nums ${currentNetWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmt(currentNetWorth)}
                </p>
                {currentNetWorth >= 0 && totalAssets > 0 && totalDebts > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Schuldgraad: {Math.round((totalDebts / totalAssets) * 100)}%
                  </p>
                )}
              </div>


              {/* Asset rows */}
              {assetSegments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Bezittingen</p>
                  <div className="space-y-1.5">
                    {assetSegments.map((s, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${s.bg} ${s.border}`}>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
                        <span className={`flex-1 min-w-0 text-sm truncate ${s.textColor} opacity-80`}>{s.label}</span>
                        <span className={`text-base font-bold tabular-nums shrink-0 ${s.textColor}`}>{fmt(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Debt rows */}
              {debtSegments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Schulden</p>
                  <div className="space-y-1.5">
                    {debtSegments.map((s, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${s.bg} ${s.border}`}>
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-400" />
                        <span className={`flex-1 min-w-0 text-sm truncate ${s.textColor} opacity-80`}>{s.label}</span>
                        <span className={`text-base font-bold tabular-nums shrink-0 ${s.textColor}`}>− {fmt(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Portfolio gain/loss note */}
            </div>
          </div>

          {/* ── Cash flow ── */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <TrendingDown size={16} className="text-slate-400 dark:text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">{t.results.cashflow}</h3>
              {hasBankData && (
                <div className="flex gap-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
                  {(['verwacht', 'werkelijk'] as const).map(tab => (
                    <button key={tab} onClick={() => setCfTab(tab)}
                      className={`px-3 py-1 font-medium transition-colors cursor-pointer border-0 capitalize
                        ${cfTab === tab ? 'bg-green-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6">
              {/* Visual income vs outflow bar */}
              {grossIncome > 0 && (() => {
                const totalOut = cfTab === 'werkelijk' && hasBankData
                  ? aktExpenses + aktInvest + (box1.netTax + box3.netTax + duoJaarbetaling + afschrijvingenJaarDeposit + schenkbelasting) * budgetScale
                  : box1.netTax + box3.netTax + totalExpenses + annualSavings + annualInvestments + duoJaarbetaling + afschrijvingenJaarDeposit + schenkbelasting;
                const totalIn  = cfTab === 'werkelijk' && hasBankData
                  ? aktIncome + aktToeslagen + aktDuoInkomen + aktSchenk
                  : grossIncome + toeslagen.total + duoLeningJaar + schenkNetOntvangen;
                const maxVal   = Math.max(totalIn, totalOut) || 1;
                return (
                  <div className="mb-5 space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Inkomsten</span><span className="text-green-600 font-medium">{fmt(totalIn)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(100, (totalIn / maxVal) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Uitgaven &amp; lasten</span><span className="text-red-500 font-medium">{fmt(totalOut)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, (totalOut / maxVal) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Period note removed — scaling annotation no longer shown */}

              {(() => {
                const isWerk = cfTab === 'werkelijk' && hasBankData;
                type CfRow = { label: string; budget: number; actual: number | null; sign: '+' | '−'; color: string };
                const sc = isWerk ? budgetScale : 1;

                const incomeRows: CfRow[] = [
                  { label: t.results.grossIncome,              budget: grossIncome * sc,              actual: isWerk ? aktIncome : null, sign: '+', color: 'text-green-600' },
                  ...(toeslagen.total > 0 || (isWerk && aktToeslagen > 0)
                    ? [{ label: t.results.toeslagen,           budget: toeslagen.total * sc,          actual: isWerk ? (aktToeslagen  > 0 ? aktToeslagen  : null) : null, sign: '+' as const, color: 'text-teal-600' }]
                    : []),
                  ...(schenkNetOntvangen > 0 || (isWerk && aktSchenk > 0)
                    ? [{ label: t.resultsExtra.schenkNetOntvangen, budget: schenkNetOntvangen * sc,   actual: isWerk ? (aktSchenk     > 0 ? aktSchenk     : null) : null, sign: '+' as const, color: 'text-green-600' }]
                    : []),
                  ...(duoLeningJaar > 0 || (isWerk && aktDuoInkomen > 0)
                    ? [{ label: t.resultsExtra.duoLeningInflow, budget: duoLeningJaar * sc,           actual: isWerk ? (aktDuoInkomen > 0 ? aktDuoInkomen : null) : null, sign: '+' as const, color: 'text-blue-500' }]
                    : []),
                ];

                const outflowRows: CfRow[] = [
                  { label: t.results.box1Tax,                  budget: -box1.netTax * sc,             actual: null, sign: '−', color: 'text-red-500' },
                  { label: t.results.box3Tax,                  budget: -box3.netTax * sc,             actual: null, sign: '−', color: 'text-red-500' },
                  { label: t.results.totalExpenses,            budget: -totalExpenses * sc,           actual: isWerk ? -aktExpenses : null, sign: '−', color: 'text-orange-500' },
                  ...(annualSavings > 0 || (isWerk && aktSavings > 0)
                    ? [{ label: t.expenses.monthlySavings,     budget: -annualSavings * sc,           actual: isWerk ? -aktSavings : null, sign: '−' as const, color: 'text-blue-500' }]
                    : []),
                  ...(annualInvestments > 0 || (isWerk && aktInvest > 0)
                    ? [{ label: t.expenses.monthlyInvest,      budget: -annualInvestments * sc,       actual: isWerk ? -aktInvest : null, sign: '−' as const, color: 'text-violet-500' }]
                    : []),
                  ...(duoJaarbetaling > 0
                    ? [{ label: t.resultsExtra.duoRepayment,   budget: -duoJaarbetaling * sc,         actual: null, sign: '−' as const, color: 'text-purple-600' }]
                    : []),
                  ...(afschrijvingenJaarDeposit > 0
                    ? [{ label: t.resultsExtra.savingsProvisions, budget: -afschrijvingenJaarDeposit * sc, actual: null, sign: '−' as const, color: 'text-orange-400' }]
                    : []),
                  ...(schenkbelasting > 0
                    ? [{ label: t.resultsExtra.schenkbelasting, budget: -schenkbelasting * sc,        actual: null, sign: '−' as const, color: 'text-purple-600' }]
                    : []),
                ];

                const totalIncome  = incomeRows.reduce((s, r) => s + (isWerk && r.actual !== null ? r.actual : r.budget), 0);
                const totalOutflow = outflowRows.reduce((s, r) => s + Math.abs(isWerk && r.actual !== null ? r.actual : r.budget), 0);
                const netActual    = totalIncome - totalOutflow;

                const renderRow = (row: CfRow, i: number) => {
                  const displayVal = isWerk && row.actual !== null ? row.actual : row.budget;
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <span className="flex-1 min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">{row.label}</span>
                      {isWerk && row.actual === null && (
                        <span className="text-xs text-slate-300 dark:text-slate-600 shrink-0" title="Budgetwaarde">~</span>
                      )}
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${row.color}`}>
                        {row.sign} {fmt(Math.abs(displayVal))}
                      </span>
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Inkomsten</p>
                      <div>{incomeRows.map(renderRow)}</div>
                      <div className="flex items-center gap-3 pt-2 mt-1 border-t border-slate-200 dark:border-slate-600">
                        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Totaal inkomsten</span>
                        <span className="text-base font-bold text-green-600 tabular-nums">+ {fmt(totalIncome)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Uitgaven &amp; lasten</p>
                      <div>{outflowRows.map(renderRow)}</div>
                      <div className="flex items-center gap-3 pt-2 mt-1 border-t border-slate-200 dark:border-slate-600">
                        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Totaal uitgaven</span>
                        <span className="text-base font-bold text-red-500 tabular-nums">− {fmt(totalOutflow)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-3 border-t-2 border-slate-300 dark:border-slate-600">
                      <span className="flex-1 min-w-0 text-base font-bold text-slate-800 dark:text-slate-100 truncate">{t.results.netDisposable}</span>
                      <span className={`shrink-0 text-xl font-bold tabular-nums ${netActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(netActual)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Toeslagen ── */}
          {hasToeslagen && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                <Gift size={16} className="text-slate-400 dark:text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.resultsExtra.toeslagenTitle}</h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  {t.resultsExtra.toeslagenWarning}{' '}
                  <a href="https://www.belastingdienst.nl/wps/wcm/connect/nl/toeslagen" target="_blank" rel="noopener noreferrer" className="underline">{t.resultsExtra.toeslagenLink}</a>.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {toeslagen.zorgtoeslag > 0 && (
                    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
                      <p className="text-xs font-medium text-teal-700 dark:text-teal-300 opacity-75 mb-1">{t.resultsExtra.zorgtoeslag}</p>
                      <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{fmt(toeslagen.zorgtoeslag)}</p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 opacity-60 mt-1">{fmt(Math.round(toeslagen.zorgtoeslag / 12))} {t.resultsExtra.perMonth}</p>
                    </div>
                  )}
                  {toeslagen.huurtoeslag > 0 && (
                    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
                      <p className="text-xs font-medium text-teal-700 dark:text-teal-300 opacity-75 mb-1">{t.resultsExtra.huurtoeslag}</p>
                      <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{fmt(toeslagen.huurtoeslag)}</p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 opacity-60 mt-1">{fmt(Math.round(toeslagen.huurtoeslag / 12))} {t.resultsExtra.perMonth}</p>
                    </div>
                  )}
                  {toeslagen.hypotheekrenteaftrek > 0 && (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 opacity-75 mb-1">{t.resultsExtra.hypotheekrenteaftrek}</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{fmt(toeslagen.hypotheekrenteaftrek)}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 opacity-60 mt-1">{t.resultsExtra.taxBenefitPerYr}</p>
                    </div>
                  )}
                  {toeslagen.total > 0 && (
                    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 opacity-75 mb-1">{t.resultsExtra.totalToeslagen}</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-400">{fmt(toeslagen.total)}</p>
                      <p className="text-xs text-green-600 dark:text-green-500 opacity-60 mt-1">{fmt(Math.round(toeslagen.total / 12))} {t.resultsExtra.perMonth}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
        {/* end right column */}
      </div>
    </div>
  );
}
