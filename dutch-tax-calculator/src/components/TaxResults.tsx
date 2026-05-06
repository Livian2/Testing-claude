import { Calculator, TrendingUp, TrendingDown, Info } from 'lucide-react';
import type { TaxResult } from '../types';
import { fmt, fmtPct } from '../utils/taxCalculations';

interface Props {
  result: TaxResult;
}

function StatCard({
  label, value, sub, color = 'slate', positive,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  positive?: boolean;
}) {
  const colors: Record<string, string> = {
    red:    'bg-red-50 border-red-200 text-red-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    slate:  'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
      <p className={`text-xl font-bold ${positive === undefined ? '' : positive ? 'text-green-600' : 'text-red-600'}`}>
        {value}
      </p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

function BracketBar({ rate, base, tax }: { rate: number; base: number; tax: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs w-12 text-slate-500 font-mono">{fmtPct(rate)}</span>
      <div className="flex-1 bg-slate-100 rounded h-2 overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded"
          style={{ width: `${Math.min(100, (base / 80000) * 100)}%` }}
        />
      </div>
      <span className="text-xs w-20 text-right text-slate-600">{fmt(base)}</span>
      <span className="text-xs w-20 text-right font-medium text-blue-700">{fmt(tax)}</span>
    </div>
  );
}

export default function TaxResults({ result }: Props) {
  const { box1, box3, totalTax, netDisposableIncome, totalExpenses, portfolioGainLoss } = result;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={20} className="text-orange-400" />
          <h2 className="text-base font-semibold text-slate-200">Belastingberekening 2025</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Totaal te betalen</p>
            <p className="text-2xl font-bold text-red-400">{fmt(totalTax)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Box 1 belasting</p>
            <p className="text-2xl font-bold text-orange-400">{fmt(box1.netTax)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Box 3 belasting</p>
            <p className="text-2xl font-bold text-purple-400">{fmt(box3.netTax)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Netto besteedbaar</p>
            <p className={`text-2xl font-bold ${netDisposableIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(netDisposableIncome)}
            </p>
          </div>
        </div>
      </div>

      {/* Box 1 Detail */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-blue-400 bg-gradient-to-r from-blue-50 to-white">
          <TrendingUp size={18} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">Box 1 — Inkomen uit werk en woning</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Belastbaar inkomen"   value={fmt(box1.taxableIncome)}          color="blue" />
            <StatCard label="Bruto belasting"       value={fmt(box1.grossTax)}               color="orange" />
            <StatCard label="Effectief tarief"      value={fmtPct(box1.effectiveRate)}       color="slate" />
            <StatCard label="Netto Box 1 belasting" value={fmt(box1.netTax)}                color="red" />
          </div>

          {/* Brackets */}
          {box1.brackets.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Schijvenberekening</p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex text-xs text-slate-400 font-medium mb-2 gap-3">
                  <span className="w-12">Tarief</span>
                  <span className="flex-1">Inkomen</span>
                  <span className="w-20 text-right">Grondslag</span>
                  <span className="w-20 text-right">Belasting</span>
                </div>
                {box1.brackets.map((b, i) => (
                  <BracketBar key={i} {...b} />
                ))}
              </div>
            </div>
          )}

          {/* Heffingskortingen */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Heffingskortingen</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex justify-between items-center bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
                <span className="text-sm text-slate-700">Algemene heffingskorting</span>
                <span className="font-semibold text-green-600">- {fmt(box1.algemeneHeffingskorting)}</span>
              </div>
              <div className="flex justify-between items-center bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
                <span className="text-sm text-slate-700">Arbeidskorting</span>
                <span className="font-semibold text-green-600">- {fmt(box1.arbeidskorting)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Box 3 Detail */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-purple-400 bg-gradient-to-r from-purple-50 to-white">
          <TrendingUp size={18} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-800">Box 3 — Vermogen (sparen en beleggen)</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Box 3 berekening o.b.v. <strong>overgangswetgeving 2025</strong> (rechtsherstel). Fictief rendement: spaargeld <strong>1,44%</strong>,
              overige bezittingen <strong>5,88%</strong>, schulden <strong>2,62%</strong>. Belastingtarief: <strong>36%</strong>.
              Heffingvrij vermogen: <strong>€57.000</strong> (alleenstaand) / <strong>€114.000</strong> (fiscaal partners).
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Totaal vermogen"        value={fmt(box3.totalAssets)}      color="purple" />
            <StatCard label="Schulden"               value={fmt(box3.totalDebts)}       color="orange" />
            <StatCard label="Netto vermogen"         value={fmt(box3.netWealth)}        color="blue" />
            <StatCard label="Heffingvrij vermogen"   value={fmt(box3.exemption)}        color="green" />
            <StatCard label="Belastbaar vermogen"    value={fmt(box3.taxableWealth)}    color="slate" />
            <StatCard label="Box 3 belasting (36%)"  value={fmt(box3.netTax)}           color="red" />
          </div>

          {box3.taxableWealth > 0 && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
              <p className="text-xs font-semibold text-slate-600 mb-3">Fictief rendement uitsplitsing</p>
              {[
                { label: 'Spaargeld (1,44%)', value: box3.breakdown.savingsFictitious, positive: false },
                { label: 'Overige bezittingen (5,88%)', value: box3.breakdown.investmentsFictitious, positive: false },
                { label: 'Schulden (2,62%)', value: -box3.breakdown.debtsFictitious, positive: true },
                { label: 'Totaal fictief rendement', value: box3.fictitiousReturn, bold: true },
                { label: 'Belasting (36%)', value: box3.grossTax, bold: true, red: true },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between text-sm py-1 ${row.bold ? 'font-semibold border-t border-slate-200 pt-2' : ''}`}>
                  <span className="text-slate-600">{row.label}</span>
                  <span className={row.red ? 'text-red-600' : row.positive ? 'text-green-600' : 'text-slate-800'}>
                    {row.value < 0 ? '- ' : ''}{fmt(Math.abs(row.value))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cash flow summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-green-400 bg-gradient-to-r from-green-50 to-white">
          <TrendingDown size={18} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-800">Kasstroom overzicht</h3>
        </div>
        <div className="p-6 space-y-2">
          {[
            { label: 'Bruto inkomen', value: result.box1.taxableIncome + (result.box1.algemeneHeffingskorting * 0), sign: '+', color: 'green' },
            { label: 'Box 1 belasting', value: box1.netTax, sign: '-', color: 'red' },
            { label: 'Box 3 belasting', value: box3.netTax, sign: '-', color: 'red' },
            { label: 'Totale kosten', value: totalExpenses, sign: '-', color: 'orange' },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-sm">
              <span className="text-slate-600">{row.label}</span>
              <span className={`font-medium ${row.color === 'green' ? 'text-green-600' : row.color === 'red' ? 'text-red-500' : 'text-orange-500'}`}>
                {row.sign} {fmt(row.value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3 border-t-2 border-slate-200">
            <span className="font-semibold text-slate-700">Netto besteedbaar inkomen</span>
            <span className={`text-lg font-bold ${netDisposableIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(netDisposableIncome)}
            </span>
          </div>
          {portfolioGainLoss !== 0 && (
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-slate-500">Gerealiseerde koerswinst/-verlies</span>
              <span className={portfolioGainLoss >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {portfolioGainLoss >= 0 ? '+' : ''}{fmt(portfolioGainLoss)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
