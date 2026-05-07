import { useState, useMemo } from 'react';
import { PiggyBank, Target, TrendingUp } from 'lucide-react';
import type { SavingsData } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: SavingsData;
  totalSavingsBalance: number;   // from WaardesData (passed in from App)
  onChange: (d: SavingsData) => void;
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ── Savings growth SVG chart ──────────────────────────────────────────────

interface GrowthPoint { year: number; balance: number; contributions: number }

function SavingsChart({
  startBalance, monthlyContribution, annualRate, years,
}: {
  startBalance: number; monthlyContribution: number; annualRate: number; years: number;
}) {
  const W = 520; const H = 160; const PAD = { t: 10, r: 10, b: 28, l: 52 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const points = useMemo<GrowthPoint[]>(() => {
    const pts: GrowthPoint[] = [];
    let balance = startBalance;
    let totalContributions = startBalance;
    const monthlyRate = annualRate / 100 / 12;
    for (let y = 0; y <= years; y++) {
      pts.push({ year: y, balance, contributions: totalContributions });
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyRate) + monthlyContribution;
        totalContributions += monthlyContribution;
      }
    }
    return pts;
  }, [startBalance, monthlyContribution, annualRate, years]);

  const maxVal = Math.max(...points.map(p => p.balance)) || 1;
  const xScale = (i: number) => PAD.l + (i / years) * iW;
  const yScale = (v: number) => PAD.t + iH - (v / maxVal) * iH;

  // Area paths
  const balanceLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.balance)}`).join(' ');
  const contribLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.contributions)}`).join(' ');
  const balanceArea = `${balanceLine} L${xScale(years)},${PAD.t + iH} L${xScale(0)},${PAD.t + iH} Z`;
  const contribArea = `${contribLine} L${xScale(years)},${PAD.t + iH} L${xScale(0)},${PAD.t + iH} Z`;

  // Y ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: f * maxVal,
    y: PAD.t + iH - f * iH,
  }));

  // Milestones
  const milestones = [5, 10, 20, 30].filter(y => y <= years);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      <defs>
        <linearGradient id="sg-balance" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="sg-contrib" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PAD.l - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {t.val >= 1_000_000 ? `${(t.val / 1_000_000).toFixed(1)}M`
              : t.val >= 1000 ? `${Math.round(t.val / 1000)}k`
              : Math.round(t.val)}
          </text>
        </g>
      ))}

      {/* Contribution area (inlays) */}
      <path d={contribArea} fill="url(#sg-contrib)" />
      <polyline points={points.map((p, i) => `${xScale(i)},${yScale(p.contributions)}`).join(' ')}
        fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4,2" />

      {/* Balance area */}
      <path d={balanceArea} fill="url(#sg-balance)" />
      <polyline points={points.map((p, i) => `${xScale(i)},${yScale(p.balance)}`).join(' ')}
        fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

      {/* Milestone labels */}
      {milestones.map(m => {
        const pt = points[m];
        if (!pt) return null;
        return (
          <g key={m}>
            <line x1={xScale(m)} y1={PAD.t} x2={xScale(m)} y2={PAD.t + iH}
              stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" />
            <text x={xScale(m)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {m}j
            </text>
            <text x={xScale(m)} y={yScale(pt.balance) - 5} textAnchor="middle" fontSize="8" fill="#10b981" fontWeight="600">
              {pt.balance >= 1000 ? `${Math.round(pt.balance / 1000)}k` : Math.round(pt.balance)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + iH} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={PAD.l} y1={PAD.t + iH} x2={W - PAD.r} y2={PAD.t + iH} stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SavingsSection({ data, totalSavingsBalance, onChange }: Props) {
  const [projYears, setProjYears] = useState(20);
  const [projRate,  setProjRate]  = useState(3.5);

  const finalBalance = useMemo(() => {
    let bal = totalSavingsBalance;
    const r = projRate / 100 / 12;
    for (let m = 0; m < projYears * 12; m++) {
      bal = bal * (1 + r) + data.monthlySavingsContribution;
    }
    return bal;
  }, [totalSavingsBalance, data.monthlySavingsContribution, projRate, projYears]);

  const interest = finalBalance - totalSavingsBalance - data.monthlySavingsContribution * projYears * 12;

  return (
    <div className="space-y-4">
      {/* Monthly contribution card */}
      <SectionCard title="Maandelijkse spaarbijdrage" icon={<PiggyBank size={20} />} accent="border-green-400">
        <div className="space-y-4">
          <CurrencyInput
            label="Spaarbijdrage per maand"
            hint="Hoeveel spaart u elke maand bij?"
            value={data.monthlySavingsContribution}
            onChange={v => onChange({ ...data, monthlySavingsContribution: v })}
          />
          <p className="text-xs text-slate-500">
            Voer uw actuele spaarsaldi in op het tabblad <strong>Waardes 1 jan</strong> — die worden gebruikt voor de Box 3 berekening.
          </p>
          {totalSavingsBalance > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-100">
                <p className="text-xs text-slate-500 mb-1">Huidig totaal saldo</p>
                <p className="text-base font-bold text-green-700">{nl.format(totalSavingsBalance)}</p>
              </div>
              <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-100">
                <p className="text-xs text-slate-500 mb-1">Jaarlijkse bijdrage</p>
                <p className="text-base font-bold text-green-700">{nl.format(data.monthlySavingsContribution * 12)}</p>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Growth projection */}
      <SectionCard title="Spaardoel prognose" icon={<Target size={20} />} accent="border-teal-400">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Looptijd</label>
              <div className="relative">
                <input type="number" min="1" max="50" step="1" value={projYears}
                  onChange={e => setProjYears(Math.max(1, Math.min(50, parseInt(e.target.value) || 20)))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">jaar</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Verwacht rendement</label>
              <div className="relative">
                <input type="number" min="0" max="20" step="0.1" value={projRate}
                  onChange={e => setProjRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>

          <SavingsChart
            startBalance={totalSavingsBalance}
            monthlyContribution={data.monthlySavingsContribution}
            annualRate={projRate}
            years={projYears}
          />

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-green-500 inline-block" />Eindwaarde met rente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-indigo-400 inline-block" />Inleg zonder rente
            </span>
          </div>

          {/* Outcome summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Eindwaarde na {projYears}j</p>
              <p className="text-base font-bold text-teal-700">{nl.format(finalBalance)}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Totale inleg</p>
              <p className="text-base font-bold text-indigo-600">
                {nl.format(totalSavingsBalance + data.monthlySavingsContribution * projYears * 12)}
              </p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-3 text-center">
              <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                <TrendingUp size={10} />Rente-opbrengst
              </p>
              <p className="text-base font-bold text-green-600">{nl.format(Math.max(0, interest))}</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
