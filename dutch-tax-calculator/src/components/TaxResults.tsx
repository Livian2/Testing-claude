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
    <div className={`min-w-0 rounded-xl border p-3 ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1 truncate">{label}</p>
      <p className="text-base lg:text-lg font-bold break-words">{value}</p>
    </div>
  );
}

export default function TaxResults({ result }: Props) {
  const { t } = useLanguage();
  const {
    box1, box3, toeslagen, totalTax, netDisposableIncome, totalExpenses,
    annualSavings, annualInvestments,
    portfolioCurrentValue,
    actualSavingsInterest, currentNetWorth, wozAsset, hypotheekRestschuld, afschrijvingenActueel,
    duoJaarbetaling, duoLeningJaar, afschrijvingenJaarDeposit,
    schenkbelasting, schenkNetOntvangen,
  } = result;

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
    ...(hypotheekRestschuld > 0 ? [{ label: t.resultsExtra.hypotheekSchuld, value: hypotheekRestschuld, textColor: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', bg: 'bg-red-50 dark:bg-red-900/20' }] : []),
    ...(box3.rawDebts > 0        ? [{ label: t.results.debtsBox3,            value: box3.rawDebts,      textColor: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', bg: 'bg-orange-50 dark:bg-orange-900/20' }] : []),
    ...(afschrijvingenActueel > 0 ? [{ label: t.results.depreciationRes,    value: afschrijvingenActueel, textColor: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', bg: 'bg-slate-50 dark:bg-slate-900' }] : []),
  ];

  return (
    <div className="space-y-4">

      {/* ── Hero (full width) ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={20} className="text-orange-400" />
          <h2 className="text-base font-semibold text-slate-200">{t.resultsExtra.taxCalcTitle}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.totalTax}</p>
            <p className="text-xl lg:text-2xl font-bold text-red-400 truncate">{fmt(totalTax)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.box1Tax}</p>
            <p className="text-xl lg:text-2xl font-bold text-orange-400 truncate">{fmt(box1.netTax)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.box3Tax}</p>
            <p className="text-xl lg:text-2xl font-bold text-purple-400 truncate">{fmt(box3.netTax)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.netDisposable}</p>
            <p className={`text-xl lg:text-2xl font-bold truncate ${netDisposableIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(netDisposableIncome)}
            </p>
          </div>
        </div>
        {hasToeslagen && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2">
            <Gift size={15} className="text-teal-400 shrink-0" />
            <span className="text-sm text-slate-300">
              {toeslagen.total > 0 && <>{t.resultsExtra.toeslagenReceive} <span className="text-teal-400 font-bold">{fmt(toeslagen.total)}</span> {t.resultsExtra.toeslagenSuffix}</>}
              {toeslagen.hypotheekrenteaftrek > 0 && <> {t.resultsExtra.hraAdvantage} <span className="text-blue-400 font-bold">{fmt(toeslagen.hypotheekrenteaftrek)}</span></>}
            </span>
          </div>
        )}
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

        {/* ════ LEFT COLUMN: Tax details ════ */}
        <div className="space-y-4">

          {/* ── Box 1 ── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-blue-400 bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800">
              <TrendingUp size={18} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.box1Title}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label={t.results.taxableIncome} value={fmt(box1.taxableIncome)} color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" />
                <StatCard label={t.results.grossTax}      value={fmt(box1.grossTax)}      color="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300" />
                <StatCard label={t.results.effectiveRate} value={fmtPct(box1.effectiveRate)} color="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" />
                <StatCard label={t.results.netBox1Tax}    value={fmt(box1.netTax)}          color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" />
              </div>

              {(box1.ewEffect !== 0 || box1.pensionDeduction > 0) && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
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

              {box1.brackets.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">{t.results.brackets}</p>
                  {box1.brackets.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <span className="text-xs w-10 text-slate-500 dark:text-slate-400 font-mono shrink-0">{fmtPct(b.rate)}</span>
                      <div className="flex-1 min-w-0 bg-slate-200 dark:bg-slate-700 rounded h-1.5 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded" style={{ width: `${Math.min(100, (b.base / 80000) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-right text-slate-600 dark:text-slate-300 shrink-0">{fmt(b.base)}</span>
                      <span className="text-xs text-right font-medium text-blue-700 dark:text-blue-400 shrink-0">{fmt(b.tax)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800 space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">{t.results.kortingen}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{t.results.ahk}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-green-600">− {fmt(box1.algemeneHeffingskorting)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm border-b border-green-200 dark:border-green-800 pb-2">
                  <span className="text-slate-700 dark:text-slate-200">{t.results.ak}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-green-600">− {fmt(box1.arbeidskorting)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm font-semibold">
                  <span className="text-slate-700 dark:text-slate-200">{t.results.totalKortingen}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-green-600">− {fmt(box1.algemeneHeffingskorting + box1.arbeidskorting)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Box 3 grondslag ── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-purple-400 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-800">
              <TrendingUp size={18} className="text-purple-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.box3Title}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  {t.resultsExtra.box3Transition} <strong>{t.resultsExtra.box3RatesSavings}</strong>,
                  {' '}{t.resultsExtra.assetsRate588.split(' ')[0]} <strong>{t.resultsExtra.box3RatesAssets}</strong>,
                  {' '}{t.resultsExtra.debtsRate262.split(' ')[0]} <strong>{t.resultsExtra.box3RatesDebts}</strong>. {t.common.total} <strong>{t.resultsExtra.box3TaxRate}</strong>.
                  {' '}{t.results.exemption}: <strong>{t.resultsExtra.box3ExemptSingle}</strong> / <strong>{t.resultsExtra.box3ExemptPartner}</strong> {t.resultsExtra.box3ExemptPartnerLabel}.
                </span>
              </div>

              <div className="space-y-0 max-w-sm">
                <Row label={t.results.savingsBalance}    value={fmt(box3.breakdown.savings)}     indent />
                <Row label={t.results.portfolioValue}    value={fmt(box3.breakdown.investments)} indent />
                {box3.totalDebts > 0 && (
                  <Row label={t.results.debtsBox3}       value={`− ${fmt(box3.totalDebts)}`}     indent red />
                )}
                {box3.afschrijvingenGereserveerd > 0 && (
                  <Row label={t.results.reservations}    value={`− ${fmt(box3.afschrijvingenGereserveerd)}`} indent red />
                )}
                <Row label={t.results.netWorth}          value={fmt(box3.netWealth)}             bold />
                <Row label={t.results.exemption}         value={`− ${fmt(box3.exemption)}`}      indent green />
                <Row label={t.results.taxableWealth}     value={fmt(box3.taxableWealth)}         bold />
                {box3.taxableWealth > 0 && <>
                  <Row label={t.resultsExtra.savingsRate103}   value={fmt(box3.breakdown.savingsFictitious)}     indent />
                  <Row label={t.resultsExtra.assetsRate588}    value={fmt(box3.breakdown.investmentsFictitious)} indent />
                  {box3.breakdown.debtsFictitious > 0 && (
                    <Row label={t.resultsExtra.debtsRate262}   value={`− ${fmt(box3.breakdown.debtsFictitious)}`} indent green />
                  )}
                  <Row label={t.results.fictitiousReturn} value={fmt(box3.fictitiousReturn)}               bold />
                </>}
                <Row label={t.results.box3TaxLabel}      value={fmt(box3.netTax)}                bold red />
                {actualSavingsInterest > 0 && (
                  <Row label={t.resultsExtra.actualSavingsRate} value={`+ ${fmt(actualSavingsInterest)}`} indent green />
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ════ RIGHT COLUMN: Financial overview ════ */}
        <div className="space-y-4">

          {/* ── Net worth visual ── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-white dark:from-slate-800 dark:to-slate-800">
              <Wallet size={18} className="text-emerald-500" />
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
                        <span className={`flex-1 min-w-0 text-xs truncate ${s.textColor} opacity-80`}>{s.label}</span>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${s.textColor}`}>{fmt(s.value)}</span>
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
                        <span className={`flex-1 min-w-0 text-xs truncate ${s.textColor} opacity-80`}>{s.label}</span>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${s.textColor}`}>− {fmt(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Portfolio gain/loss note */}
            </div>
          </div>

          {/* ── Cash flow ── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-green-400 bg-gradient-to-r from-green-50 to-white dark:from-slate-800 dark:to-slate-800">
              <TrendingDown size={18} className="text-green-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.cashflow}</h3>
            </div>
            <div className="p-6">
              {/* Visual income vs outflow bar */}
              {grossIncome > 0 && (() => {
                const totalOut = box1.netTax + box3.netTax + totalExpenses + annualSavings + annualInvestments + duoJaarbetaling + afschrijvingenJaarDeposit + schenkbelasting;
                const totalIn  = grossIncome + toeslagen.total + duoLeningJaar + schenkNetOntvangen;
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

              <div className="space-y-1">
              {[
                { label: t.results.grossIncome,    value:  grossIncome,          sign: '+', color: 'text-green-600' },
                { label: t.results.box1Tax,        value: -box1.netTax,          sign: '−', color: 'text-red-500' },
                { label: t.results.box3Tax,        value: -box3.netTax,          sign: '−', color: 'text-red-500' },
                ...(toeslagen.total > 0
                  ? [{ label: t.results.toeslagen, value: toeslagen.total,        sign: '+', color: 'text-teal-600' }]
                  : []),
                { label: t.results.totalExpenses,  value: -totalExpenses,        sign: '−', color: 'text-orange-500' },
                ...(annualSavings > 0
                  ? [{ label: t.expenses.monthlySavings, value: -annualSavings, sign: '−', color: 'text-blue-500' }]
                  : []),
                ...(annualInvestments > 0
                  ? [{ label: t.expenses.monthlyInvest, value: -annualInvestments, sign: '−', color: 'text-violet-500' }]
                  : []),
                ...(duoJaarbetaling > 0
                  ? [{ label: t.resultsExtra.duoRepayment, value: -duoJaarbetaling,       sign: '−', color: 'text-purple-600' }]
                  : []),
                ...(afschrijvingenJaarDeposit > 0
                  ? [{ label: t.resultsExtra.savingsProvisions, value: -afschrijvingenJaarDeposit, sign: '−', color: 'text-orange-400' }]
                  : []),
                ...(schenkbelasting > 0
                  ? [{ label: t.resultsExtra.schenkbelasting, value: -schenkbelasting, sign: '−', color: 'text-purple-600' }]
                  : []),
                ...(schenkNetOntvangen > 0
                  ? [{ label: t.resultsExtra.schenkNetOntvangen, value: schenkNetOntvangen, sign: '+', color: 'text-green-600' }]
                  : []),
                ...(duoLeningJaar > 0
                  ? [{ label: t.resultsExtra.duoLeningInflow, value: duoLeningJaar, sign: '+', color: 'text-blue-500' }]
                  : []),
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs">
                  <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">{row.label}</span>
                  <span className={`shrink-0 font-medium tabular-nums ${row.color}`}>{row.sign} {fmt(Math.abs(row.value))}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-3 border-t-2 border-slate-200 dark:border-slate-700">
                <span className="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{t.results.netDisposable}</span>
                <span className={`shrink-0 text-base font-bold tabular-nums ${netDisposableIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(netDisposableIncome)}
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* ── Toeslagen ── */}
          {hasToeslagen && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-teal-400 bg-gradient-to-r from-teal-50 to-white dark:from-slate-800 dark:to-slate-800">
                <Gift size={18} className="text-teal-500" />
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
