import { useMemo, useState, useRef, useCallback } from 'react';
import type { TaxFormData, PrognoseConfig } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import { computePositions } from '../utils/taxCalculations';
import { simuleerDuo } from '../utils/duo';
import { useLanguage } from '../i18n/LanguageContext';
import SectionCard from './SectionCard';
import { TrendingUp, GripHorizontal } from 'lucide-react';

interface Props {
  data: TaxFormData;
  config: PrognoseConfig;
  onConfigChange: (c: PrognoseConfig) => void;
}

interface ProjectionPoint {
  year: number;
  savings: number;
  investments: number;
  hypotheekDebt: number;
  duoDebt: number;
  overigeDebt: number;
  totalDebt: number;
  netWorth: number;
}

const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function fmtK(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1).replace('.', ',')}m`;
  if (abs >= 1_000)     return `${sign}€${Math.round(abs / 1_000)}k`;
  return `${sign}€${abs.toFixed(0)}`;
}

function niceTickRange(min: number, max: number, tickCount = 6): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rawStep = range / (tickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep))));
  const niceFractions = [1, 2, 2.5, 5, 10];
  let niceStep = magnitude;
  for (const f of niceFractions) {
    if (f * magnitude >= rawStep) { niceStep = f * magnitude; break; }
  }
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount + 1; i++) {
    const t = niceMin + i * niceStep;
    if (t > max + niceStep) break;
    ticks.push(t);
  }
  return ticks.slice(0, tickCount);
}

const MIN_CHART_H = 140;
const MAX_CHART_H = 600;

export default function NetWorthProjection({ data, config, onConfigChange }: Props) {
  const { t } = useLanguage();
  const currentYear = data.personal.taxYear;

  const [chartHeight, setChartHeight] = useState(260);
  const dragStartY  = useRef<number | null>(null);
  const dragStartH  = useRef<number>(260);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current  = e.clientY;
    dragStartH.current  = chartHeight;

    const onMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = ev.clientY - dragStartY.current;
      setChartHeight(Math.min(MAX_CHART_H, Math.max(MIN_CHART_H, dragStartH.current + delta)));
    };
    const onUp = () => {
      dragStartY.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [chartHeight]);

  const jaarlijksSparen   = data.savings.monthlySavingsContribution * 12;
  const jaarlijksBeleggen = data.savings.maandelijksBeleggen * 12;

  const points = useMemo<ProjectionPoint[]>(() => {
    const initSavings =
      data.waardes.spaarrekeningen.reduce((s, r) => s + r.saldoJan1, 0) +
      data.waardes.betaalrekeningen.reduce((s, r) => s + r.saldoJan1, 0);

    const positions = computePositions(data.portfolio.holdings, data.portfolio.transactions);
    const portfolioValue = positions.reduce((s, p) => s + p.currentValue, 0);
    const jan1Investments = data.waardes.beleggingen.reduce((s, r) => s + r.waardeJan1, 0);
    const initInvestments = portfolioValue > 0 ? portfolioValue : jan1Investments;

    const startInkomen = data.income.grossSalary + data.income.freelanceIncome;
    const inkomensstijging = (config.inkomensstijging ?? 2) / 100;
    const isPartner = data.personal.filingStatus === 'partner';

    const duoBalanceByYear = new Map<number, number>();
    for (const duo of data.schulden.duo) {
      const sim = simuleerDuo(duo, startInkomen, inkomensstijging, currentYear, isPartner);
      for (const punt of sim.punten) {
        duoBalanceByYear.set(punt.jaar, (duoBalanceByYear.get(punt.jaar) ?? 0) + punt.balans);
      }
    }

    const result: ProjectionPoint[] = [];
    for (let i = 0; i <= config.jaren; i++) {
      const year = currentYear + i;
      const savings     = i === 0 ? initSavings     : result[i-1].savings     * (1 + config.spaarrente / 100) + jaarlijksSparen;
      const investments = i === 0 ? initInvestments : result[i-1].investments * (1 + config.rendementBeleggingen / 100) + jaarlijksBeleggen;
      const hypotheekDebt = data.woon.hypotheken.reduce((s, h) => s + berekenHypotheek(h, year).restschuldBegin, 0);
      const duoDebt       = duoBalanceByYear.get(year) ?? 0;
      const overigeDebt   = data.schulden.beleggingen.reduce((s, schuld) => {
        const elapsed = year - schuld.startJaar;
        if (elapsed < 0) return s + schuld.bedrag;
        if (elapsed >= schuld.looptijd) return s;
        return s + schuld.bedrag * (1 - elapsed / schuld.looptijd);
      }, 0);
      const totalDebt = hypotheekDebt + duoDebt + overigeDebt;
      result.push({ year, savings, investments, hypotheekDebt, duoDebt, overigeDebt, totalDebt, netWorth: savings + investments - totalDebt });
    }
    return result;
  }, [data, config, currentYear, jaarlijksSparen, jaarlijksBeleggen]);

  // SVG chart dimensions — viewBox height tracks chartHeight
  const W = 800;
  const H = chartHeight;
  const padL = 68; const padR = 16; const padT = 16; const padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const box3Debt = (p: ProjectionPoint) => p.duoDebt + p.overigeDebt;
  const allValues = points.flatMap(p => [p.savings, p.investments, -p.hypotheekDebt, -box3Debt(p), p.netWorth]);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const valuePad = (dataMax - dataMin) * 0.05 || 1;
  const yMin = dataMin - valuePad;
  const yMax = dataMax + valuePad;

  const xPos  = (i: number) => padL + (i / config.jaren) * chartW;
  const yPos  = (v: number) => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const line  = (vals: number[]) => vals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');

  const ticks = niceTickRange(yMin, yMax, 6);
  const spansZero = yMin < 0 && yMax > 0;
  const xLabels: { i: number; label: string }[] = [];
  for (let i = 0; i <= config.jaren; i += 5) xLabels.push({ i, label: String(currentYear + i) });
  if (config.jaren % 5 !== 0) xLabels.push({ i: config.jaren, label: String(currentYear + config.jaren) });

  const now  = points[0];
  const last = points[points.length - 1];
  const breakEvenYear = now.netWorth < 0 ? (points.find(p => p.netWorth >= 0)?.year ?? null) : null;

  const periodOptions = [
    { value: 10, label: `10 ${t.forecast.years}` },
    { value: 20, label: `20 ${t.forecast.years}` },
    { value: 30, label: `30 ${t.forecast.years}` },
  ];

  const SERIES = [
    { color: '#10b981', label: 'Spaarbalans',            dashed: false },
    { color: '#8b5cf6', label: 'Beleggingen',            dashed: false },
    { color: '#f97316', label: 'Hypotheekschuld (neg.)', dashed: true  },
    { color: '#ef4444', label: 'Box 3 schulden (neg.)',  dashed: true  },
    { color: '#3b82f6', label: 'Netto vermogen',         dashed: false },
  ];

  return (
    <SectionCard title={t.forecast.title} icon={<TrendingUp size={20} />} accent="border-emerald-400">

      {/* ── Compact toolbar: inputs + period + stat chips ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 py-1 mb-3">

        {/* Three % inputs */}
        {([
          { label: t.forecast.investReturn, key: 'rendementBeleggingen' as const, max: 30 },
          { label: t.forecast.savingsRate,  key: 'spaarrente'           as const, max: 20 },
          { label: t.forecast.incomeGrowth, key: 'inkomensstijging'     as const, max: 20 },
        ] as const).map(({ label, key, max }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-emerald-400 bg-white dark:bg-slate-700">
              <input
                type="number" step="0.1" min="0" max={max}
                value={config[key] ?? 2}
                onChange={e => onConfigChange({ ...config, [key]: parseFloat(e.target.value) || 0 })}
                className="w-14 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 dark:text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">%</span>
            </div>
          </div>
        ))}

        {/* Period selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">Periode</span>
          <div className="flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
            {periodOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => onConfigChange({ ...config, jaren: opt.value })}
                className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer border-0 ${
                  config.jaren === opt.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stat chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Nu</span>
            <span className={`text-xs font-semibold tabular-nums ${now.netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {nl0.format(now.netWorth)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">+{config.jaren}j</span>
            <span className={`text-xs font-semibold tabular-nums ${last.netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {nl0.format(last.netWorth)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Break-even</span>
            <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {breakEvenYear ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Hint line */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3 px-1">
        Bijdragen instellen op het tabblad <strong className="font-medium text-slate-500 dark:text-slate-400">Kosten</strong>.
        Huidig: sparen <strong className="font-medium">{nl0.format(jaarlijksSparen)}/jr</strong> · beleggen <strong className="font-medium">{nl0.format(jaarlijksBeleggen)}/jr</strong>.
      </p>

      {/* ── Chart + table side by side on xl screens ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-0 xl:gap-4 items-start">

        {/* Chart column */}
        <div className="flex flex-col">

          {/* SVG chart — dark background */}
          <div className="bg-slate-900 dark:bg-slate-950 rounded-t-xl overflow-hidden border border-b-0 border-slate-700">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height={chartHeight}
              preserveAspectRatio="none"
              style={{ display: 'block' }}
            >
              {/* Horizontal grid lines + Y-axis labels */}
              {ticks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={padL} y1={yPos(tick)} x2={W - padR} y2={yPos(tick)}
                    stroke="#1e293b" strokeWidth={1}
                  />
                  <text x={padL - 6} y={yPos(tick) + 4} textAnchor="end" fontSize={10} fill="#64748b">
                    {fmtK(tick)}
                  </text>
                </g>
              ))}

              {/* Zero line */}
              {spansZero && (
                <line
                  x1={padL} y1={yPos(0)} x2={W - padR} y2={yPos(0)}
                  stroke="#475569" strokeWidth={1} strokeDasharray="4 3"
                />
              )}

              {/* X-axis labels */}
              {xLabels.map(({ i, label }) => (
                <text key={i} x={xPos(i)} y={H - padB + 16} textAnchor="middle" fontSize={10} fill="#64748b">
                  {label}
                </text>
              ))}

              {/* X-axis baseline */}
              <line
                x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH}
                stroke="#1e293b" strokeWidth={1}
              />

              {/* Data series */}
              <polyline points={line(points.map(p => p.savings))}         fill="none" stroke="#10b981" strokeWidth={2}   strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => p.investments))}     fill="none" stroke="#8b5cf6" strokeWidth={2}   strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => -p.hypotheekDebt))}  fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="6 3" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => -box3Debt(p)))}      fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => p.netWorth))}        fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>

          {/* Legend strip */}
          <div className="bg-slate-900 dark:bg-slate-950 border-x border-slate-700 px-4 py-2">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
              {SERIES.map(({ color, label, dashed }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <svg width={16} height={10} style={{ flexShrink: 0 }}>
                    <line x1={0} y1={5} x2={16} y2={5} stroke={color}
                      strokeWidth={dashed ? 1.5 : 2} strokeDasharray={dashed ? '4 2' : undefined} />
                  </svg>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="bg-slate-800 dark:bg-slate-900 border border-t-0 border-slate-700 rounded-b-xl flex items-center justify-center py-1.5 cursor-ns-resize select-none group"
            title="Sleep om hoogte aan te passen"
          >
            <GripHorizontal size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            <span className="ml-1.5 text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">sleep om hoogte aan te passen</span>
          </div>
        </div>

        {/* ── Scrollable data table ── */}
        <div className="mt-3 xl:mt-0 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          {/* Sticky header */}
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Jaar</th>
                <th className="text-right px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">Spaar</th>
                <th className="text-right px-3 py-2 font-semibold text-purple-600 dark:text-purple-400">Beleg</th>
                <th className="text-right px-3 py-2 font-semibold text-orange-500 dark:text-orange-400">Schulden</th>
                <th className="text-right px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">Netto</th>
              </tr>
            </thead>
          </table>

          {/* Scrollable body */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: Math.max(chartHeight, MIN_CHART_H) }}
          >
            <table className="w-full text-xs">
              <tbody>
                {points.map((p, i) => {
                  const isNow = p.year === currentYear;
                  return (
                    <tr
                      key={p.year}
                      className={`border-b last:border-0 transition-colors ${
                        isNow
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30'
                          : i % 2 === 0
                            ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/50'
                      }`}
                    >
                      <td
                        className={`px-3 py-1.5 font-medium ${
                          isNow ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {p.year}
                        {isNow && <span className="ml-1 text-blue-400 dark:text-blue-500 text-[10px]">nu</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtK(p.savings)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-purple-600 dark:text-purple-400 tabular-nums">{fmtK(p.investments)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-orange-500 dark:text-orange-400 tabular-nums">−{fmtK(p.totalDebt)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-semibold tabular-nums ${
                        p.netWorth >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'
                      }`}>
                        {fmtK(p.netWorth)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
