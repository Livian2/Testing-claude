import { Calculator, TrendingUp, TrendingDown, Info, Gift } from 'lucide-react';
import type { TaxResult } from '../types';
import { fmt, fmtPct } from '../utils/taxCalculations';
import { useLanguage } from '../i18n/LanguageContext';

interface Props { result: TaxResult }

function Row({ label, value, bold, green, red, indent }: {
  label: string; value: string; bold?: boolean; green?: boolean; red?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center gap-2 py-1.5 text-sm ${bold ? 'font-semibold border-t border-slate-200 dark:border-slate-700 mt-1 pt-2' : 'border-b border-slate-50 dark:border-slate-700'}`}>
      <span className={`min-w-0 flex-1 ${indent ? 'pl-3 text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{label}</span>
      <span className={`shrink-0 text-right ${bold ? (red ? 'text-red-600' : green ? 'text-green-600' : 'text-slate-800 dark:text-slate-100') : (green ? 'text-green-600' : red ? 'text-red-500' : 'text-slate-700 dark:text-slate-200')}`}>
        {value}
      </span>
    </div>
  );
}

export default function TaxResults({ result }: Props) {
  const { t } = useLanguage();
  const {
    box1, box3, toeslagen, totalTax, netDisposableIncome, totalExpenses,
    portfolioGainLoss, portfolioCurrentValue, portfolioJan1Value,
    actualSavingsInterest, currentNetWorth, wozAsset, hypotheekRestschuld, afschrijvingenActueel,
    duoJaarbetaling, afschrijvingenJaarDeposit,
  } = result;

  const hasToeslagen = toeslagen.total > 0 || toeslagen.hypotheekrenteaftrek > 0;
  const hasPriceDiff = portfolioCurrentValue > 0 && Math.abs(portfolioCurrentValue - portfolioJan1Value) > 1;
  const grossIncome  = box1.taxableIncome;

  return (
    <div className="space-y-4">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={20} className="text-orange-400" />
          <h2 className="text-base font-semibold text-slate-200">Belastingberekening 2026</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.totalTax}</p>
            <p className="text-xl lg:text-2xl font-bold text-red-400 break-words">{fmt(totalTax)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.box1Tax}</p>
            <p className="text-xl lg:text-2xl font-bold text-orange-400 break-words">{fmt(box1.netTax)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.box3Tax}</p>
            <p className="text-xl lg:text-2xl font-bold text-purple-400 break-words">{fmt(box3.netTax)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1 truncate">{t.results.netDisposable}</p>
            <p className={`text-xl lg:text-2xl font-bold break-words ${netDisposableIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(netDisposableIncome)}
            </p>
          </div>
        </div>
        {hasToeslagen && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2">
            <Gift size={15} className="text-teal-400 shrink-0" />
            <span className="text-sm text-slate-300">
              {toeslagen.total > 0 && <>U ontvangt ca. <span className="text-teal-400 font-bold">{fmt(toeslagen.total)}</span> aan toeslagen</>}
              {toeslagen.hypotheekrenteaftrek > 0 && <> · HRA belastingvoordeel <span className="text-blue-400 font-bold">{fmt(toeslagen.hypotheekrenteaftrek)}</span></>}
            </span>
          </div>
        )}
      </div>

      {/* ── Toeslagen ── */}
      {hasToeslagen && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-teal-400 bg-gradient-to-r from-teal-50 to-white dark:from-slate-800 dark:to-slate-800">
            <Gift size={18} className="text-teal-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Toeslagen & voordelen (indicatief)</h3>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
              <Info size={14} className="mt-0.5 shrink-0" />
              Indicatieve berekening. Controleer uw exacte recht op{' '}
              <a href="https://www.belastingdienst.nl/wps/wcm/connect/nl/toeslagen" target="_blank" rel="noopener noreferrer" className="underline">belastingdienst.nl/toeslagen</a>.
            </div>
            <div className="grid grid-cols-1 gap-3">
              {toeslagen.zorgtoeslag > 0 && (
                <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
                  <p className="text-xs font-medium text-teal-700 dark:text-teal-300 opacity-75 mb-1">Zorgtoeslag</p>
                  <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{fmt(toeslagen.zorgtoeslag)}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 opacity-60 mt-1">{fmt(Math.round(toeslagen.zorgtoeslag / 12))} per maand</p>
                </div>
              )}
              {toeslagen.huurtoeslag > 0 && (
                <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
                  <p className="text-xs font-medium text-teal-700 dark:text-teal-300 opacity-75 mb-1">Huurtoeslag</p>
                  <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{fmt(toeslagen.huurtoeslag)}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 opacity-60 mt-1">{fmt(Math.round(toeslagen.huurtoeslag / 12))} per maand</p>
                </div>
              )}
              {toeslagen.hypotheekrenteaftrek > 0 && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 opacity-75 mb-1">Hypotheekrenteaftrek</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{fmt(toeslagen.hypotheekrenteaftrek)}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 opacity-60 mt-1">belastingvoordeel / jaar</p>
                </div>
              )}
              {toeslagen.total > 0 && (
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 opacity-75 mb-1">Totaal toeslagen</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{fmt(toeslagen.total)}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 opacity-60 mt-1">{fmt(Math.round(toeslagen.total / 12))} per maand</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Box 1 ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-blue-400 bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800">
          <TrendingUp size={18} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.box1Title}</h3>
        </div>
        <div className="p-6 space-y-4">
          {/* Key numbers */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t.results.taxableIncome, value: fmt(box1.taxableIncome),    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' },
              { label: t.results.grossTax,      value: fmt(box1.grossTax),         color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300' },
              { label: t.results.effectiveRate, value: fmtPct(box1.effectiveRate), color: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200' },
              { label: t.results.netBox1Tax,    value: fmt(box1.netTax),           color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' },
            ].map(c => (
              <div key={c.label} className={`min-w-0 rounded-xl border p-4 ${c.color}`}>
                <p className="text-xs font-medium opacity-75 mb-1 truncate">{c.label}</p>
                <p className="text-lg lg:text-xl font-bold break-words">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Income breakdown: gross → deductions → taxable */}
          {(box1.ewEffect !== 0 || box1.pensionDeduction > 0) && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Opbouw belastbaar inkomen</p>
              <div className="space-y-0">
                <Row label="Bruto inkomen" value={fmt(box1.grossIncomeBeforeDeductions)} />
                {box1.ewEffect < 0 && (
                  <Row label="Netto aftrekpost (rente − EWF)" value={`− ${fmt(Math.abs(box1.ewEffect))}`} indent green />
                )}
                {box1.ewEffect > 0 && (
                  <Row label="Eigenwoninginkomen (Wet Hillen)" value={`+ ${fmt(box1.ewEffect)}`} indent red />
                )}
                {box1.pensionDeduction > 0 && (
                  <Row label="Lijfrentepremies (aftrek)" value={`− ${fmt(box1.pensionDeduction)}`} indent green />
                )}
                <Row label={t.results.taxableIncome} value={fmt(box1.taxableIncome)} bold />
              </div>
            </div>
          )}

          {/* Brackets + kortingen side by side */}
          <div className="grid grid-cols-1 gap-4">
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
              <div className="flex justify-between items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{t.results.ahk}</span>
                <span className="shrink-0 font-semibold text-green-600">− {fmt(box1.algemeneHeffingskorting)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-sm border-b border-green-200 dark:border-green-800 pb-2">
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{t.results.ak}</span>
                <span className="shrink-0 font-semibold text-green-600">− {fmt(box1.arbeidskorting)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-sm font-semibold">
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{t.results.totalKortingen}</span>
                <span className="shrink-0 text-green-600">− {fmt(box1.algemeneHeffingskorting + box1.arbeidskorting)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Box 3 + Netto vermogen (merged) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-purple-400 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-800">
          <TrendingUp size={18} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.box3Title} &amp; {t.results.netWorth}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Overgangswetgeving 2026. Fictief rendement: spaargeld <strong>1,03%</strong>,
              overige bezittingen <strong>5,88%</strong>, schulden <strong>2,62%</strong>. Tarief <strong>36%</strong>.
              Heffingvrij: <strong>€57.684</strong> / <strong>€115.368</strong> (partners).
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">

            {/* Left: Box 3 tax calculation */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">{t.results.box3Grondslag}</p>
              <div className="space-y-0">
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
                  <Row label={`Spaargeld (1,03%)`}       value={fmt(box3.breakdown.savingsFictitious)}     indent />
                  <Row label={`Bezittingen (5,88%)`}     value={fmt(box3.breakdown.investmentsFictitious)} indent />
                  {box3.breakdown.debtsFictitious > 0 && (
                    <Row label={`Schulden (2,62%)`}      value={`− ${fmt(box3.breakdown.debtsFictitious)}`} indent green />
                  )}
                  <Row label={t.results.fictitiousReturn} value={fmt(box3.fictitiousReturn)}               bold />
                </>}
                <Row label={t.results.box3TaxLabel}      value={fmt(box3.netTax)}                bold red />
                {actualSavingsInterest > 0 && (
                  <Row label="Werkelijke spaarrente"     value={`+ ${fmt(actualSavingsInterest)}`} indent green />
                )}
              </div>
            </div>

            {/* Right: current net worth */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">{t.results.netWorth}</p>
              {hasPriceDiff && (
                <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                  Portfolio Jan 1: {fmt(portfolioJan1Value)} → huidig: {fmt(portfolioCurrentValue)}
                </div>
              )}
              <div className="space-y-0">
                <Row label={t.results.savingsBalance}  value={fmt(box3.breakdown.savings)}    indent />
                <Row label={t.results.portfolioValue}  value={fmt(portfolioCurrentValue)}     indent />
                {wozAsset > 0 && (
                  <Row label="Eigen woning (WOZ)"      value={`+ ${fmt(wozAsset)}`}           indent green />
                )}
                {hypotheekRestschuld > 0 && (
                  <Row label="Hypotheekschuld"         value={`− ${fmt(hypotheekRestschuld)}`} indent red />
                )}
                {box3.totalDebts > 0 && (
                  <Row label={t.results.debtsBox3}     value={`− ${fmt(box3.totalDebts)}`}    indent red />
                )}
                {afschrijvingenActueel > 0 && (
                  <Row label={t.results.depreciationRes} value={`− ${fmt(afschrijvingenActueel)}`} indent red />
                )}
                <Row
                  label={t.results.netWorth}
                  value={fmt(currentNetWorth)}
                  bold
                  green={currentNetWorth >= 0}
                  red={currentNetWorth < 0}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cash flow ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-green-400 bg-gradient-to-r from-green-50 to-white dark:from-slate-800 dark:to-slate-800">
          <TrendingDown size={18} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.results.cashflow}</h3>
        </div>
        <div className="p-6 space-y-1">
          {[
            { label: t.results.grossIncome,    value:  grossIncome,          sign: '+', color: 'text-green-600' },
            { label: t.results.box1Tax,        value: -box1.netTax,          sign: '−', color: 'text-red-500' },
            { label: t.results.box3Tax,        value: -box3.netTax,          sign: '−', color: 'text-red-500' },
            ...(toeslagen.total > 0
              ? [{ label: t.results.toeslagen, value: toeslagen.total,        sign: '+', color: 'text-teal-600' }]
              : []),
            { label: t.results.totalExpenses,  value: -totalExpenses,        sign: '−', color: 'text-orange-500' },
            ...(duoJaarbetaling > 0
              ? [{ label: 'DUO terugbetaling', value: -duoJaarbetaling,       sign: '−', color: 'text-purple-600' }]
              : []),
            ...(afschrijvingenJaarDeposit > 0
              ? [{ label: 'Sparen voorzieningen', value: -afschrijvingenJaarDeposit, sign: '−', color: 'text-orange-400' }]
              : []),
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 text-sm">
              <span className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">{row.label}</span>
              <span className={`shrink-0 font-medium ${row.color}`}>{row.sign} {fmt(Math.abs(row.value))}</span>
            </div>
          ))}
          <div className="flex justify-between items-center gap-2 pt-3 border-t-2 border-slate-200 dark:border-slate-700">
            <span className="min-w-0 flex-1 font-semibold text-slate-700 dark:text-slate-200">{t.results.netDisposable}</span>
            <span className={`shrink-0 text-lg font-bold ${netDisposableIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(netDisposableIncome)}
            </span>
          </div>
          {portfolioGainLoss !== 0 && (
            <div className="flex justify-between items-center gap-2 mt-2 text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="min-w-0 flex-1 text-slate-500 dark:text-slate-400">Gerealiseerde koerswinst/-verlies (informatief)</span>
              <span className={`shrink-0 font-medium ${portfolioGainLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {portfolioGainLoss >= 0 ? '+' : '−'}{fmt(Math.abs(portfolioGainLoss))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
