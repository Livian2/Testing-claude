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

  // Area fill polygon: line points + close along bottom
  const areaPolygon = (vals: number[], baseY: number) => {
    const pts = vals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
    const n = vals.length - 1;
    return `${pts} ${xPos(n)},${baseY} ${xPos(0)},${baseY}`;
  };

  return (
    <SectionCard title={t.forecast.title} icon={<TrendingUp size={20} />} accent="border-emerald-400">

      {/* ── Control bar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-4">

        {/* Inputs */}
        {([
          { label: t.forecast.investReturn, key: 'rendementBeleggingen' as const, max: 30 },
          { label: t.forecast.savingsRate,  key: 'spaarrente'           as const, max: 20 },
          { label: t.forecast.incomeGrowth, key: 'inkomensstijging'     as const, max: 20 },
        ] as const).map(({ label, key, max }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-400 bg-white dark:bg-slate-700">
              <input
                type="number" step="0.1" min="0" max={max}
                value={config[key] ?? 2}
                onChange={e => onConfigChange({ ...config, [key]: parseFloat(e.target.value) || 0 })}
                className="w-12 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">%</span>
            </div>
          </label>
        ))}

        {/* Divider */}
        <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block" />

        {/* Period */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">Periode</span>
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            {periodOptions.map(opt => (
              <button key={opt.value} onClick={() => onConfigChange({ ...config, jaren: opt.value })}
                className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer border-0 ${
                  config.jaren === opt.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-600'
                }`}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Spacer + stat chips */}
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Nu',              val: now.netWorth,  colored: true  },
            { label: `+${config.jaren}j`, val: last.netWorth, colored: true  },
          ].map(({ label, val, colored }) => (
            <div key={label} className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-sm">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{label}</span>
              <span className={`text-xs font-bold tabular-nums ${colored ? (val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-slate-700 dark:text-slate-200'}`}>
                {nl0.format(val)}
              </span>
            </div>
          ))}
          {breakEvenYear && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-sm">
              <span className="text-[10px] text-slate-400">Break-even</span>
              <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">{breakEvenYear}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3 -mt-1">
        Bijdragen instellen via <strong className="text-slate-500 dark:text-slate-400">Kosten</strong> — sparen {nl0.format(jaarlijksSparen)}/jr · beleggen {nl0.format(jaarlijksBeleggen)}/jr
      </p>

      {/* ── Chart + table ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">

        {/* Chart */}
        <div className="flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-lg">
          <div className="bg-slate-900 dark:bg-slate-950">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={chartHeight} preserveAspectRatio="none" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="fillInvest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="fillSave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {ticks.map((tick, i) => (
                <g key={i}>
                  <line x1={padL} y1={yPos(tick)} x2={W - padR} y2={yPos(tick)} stroke="#334155" strokeWidth={0.5} />
                  <text x={padL - 8} y={yPos(tick) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{fmtK(tick)}</text>
                </g>
              ))}

              {/* Zero line */}
              {spansZero && (
                <line x1={padL} y1={yPos(0)} x2={W - padR} y2={yPos(0)} stroke="#64748b" strokeWidth={1} strokeDasharray="4 3" />
              )}

              {/* X labels */}
              {xLabels.map(({ i, label }) => (
                <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={10} fill="#94a3b8">{label}</text>
              ))}

              {/* Left axis */}
              <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#334155" strokeWidth={1} />

              {/* Area fills */}
              <polygon points={areaPolygon(points.map(p => p.investments), padT + chartH)} fill="url(#fillInvest)" />
              <polygon points={areaPolygon(points.map(p => p.savings), padT + chartH)} fill="url(#fillSave)" />
              {spansZero && (
                <polygon points={areaPolygon(points.map(p => Math.max(p.netWorth, 0)), yPos(0))} fill="url(#fillNet)" />
              )}

              {/* Lines */}
              <polyline points={line(points.map(p => p.savings))}        fill="none" stroke="#10b981" strokeWidth={2}   strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => p.investments))}    fill="none" stroke="#8b5cf6" strokeWidth={2}   strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => -p.hypotheekDebt))} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="6 3" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => -box3Debt(p)))}     fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={line(points.map(p => p.netWorth))}       fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>

          {/* Legend */}
          <div className="bg-slate-800 dark:bg-slate-900 border-t border-slate-700 px-4 py-2">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
              {SERIES.map(({ color, label, dashed }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <svg width={18} height={10} style={{ flexShrink: 0 }}>
                    <line x1={0} y1={5} x2={18} y2={5} stroke={color} strokeWidth={dashed ? 1.5 : 2} strokeDasharray={dashed ? '4 2' : undefined} />
                  </svg>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resize handle */}
          <div onMouseDown={onMouseDown}
            className="bg-slate-800 dark:bg-slate-900 border-t border-slate-700 flex items-center justify-center gap-2 py-1.5 cursor-ns-resize select-none group">
            <GripHorizontal size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
            <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">hoogte aanpassen</span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          {/* Fixed header */}
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-[52px]">Jaar</th>
                <th className="text-right px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">Spaar</th>
                <th className="text-right px-3 py-2 font-semibold text-purple-600 dark:text-purple-400">Beleg</th>
                <th className="text-right px-3 py-2 font-semibold text-orange-500 dark:text-orange-400">Schuld</th>
                <th className="text-right px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">Netto</th>
              </tr>
            </thead>
          </table>
          {/* Scrollable body */}
          <div className="overflow-y-auto" style={{ maxHeight: Math.max(chartHeight + 44, 280) }}>
            <table className="w-full text-xs table-fixed">
              <tbody>
                {points.map((p, i) => {
                  const isNow = p.year === currentYear;
                  return (
                    <tr key={p.year} className={`border-b last:border-0 ${
                      isNow
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30'
                        : i % 2 === 0
                          ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/40'
                          : 'bg-slate-50/50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/40'
                    }`}>
                      <td className={`px-3 py-1.5 font-semibold w-[52px] ${isNow ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {p.year}
                        {isNow && <span className="ml-1 text-[9px] bg-blue-500 text-white rounded px-1 py-0.5 align-middle">nu</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmtK(p.savings)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-purple-600 dark:text-purple-400">{fmtK(p.investments)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-orange-500 dark:text-orange-400">−{fmtK(p.totalDebt)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums font-semibold ${p.netWorth >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
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
