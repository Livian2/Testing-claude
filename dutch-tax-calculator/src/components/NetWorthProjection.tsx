import { useMemo, useState, useRef, useCallback } from 'react';
import type { TaxFormData, PrognoseConfig } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import { computePositions } from '../utils/taxCalculations';
import { simuleerDuo } from '../utils/duo';
import { gereserveerdTotNu } from '../utils/afschrijvingen';
import { useLanguage } from '../i18n/LanguageContext';
import SectionCard from './SectionCard';
import { TrendingUp } from 'lucide-react';

interface Props {
  data: TaxFormData;
  config: PrognoseConfig;
  onConfigChange: (c: PrognoseConfig) => void;
}

interface ProjectionPoint {
  year: number;
  savings: number;
  investments: number;
  wozWaarde: number;
  hypotheekDebt: number;
  duoDebt: number;
  overigeDebt: number;
  totalDebt: number;
  afschrijvingenReserve: number;
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

// Catmull-Rom → cubic bezier smooth path
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

// Close smooth path into a filled area (down to baseY)
function smoothArea(pts: [number, number][], baseY: number): string {
  if (pts.length < 2) return '';
  const path = smoothPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${path} L ${last[0].toFixed(2)} ${baseY.toFixed(2)} L ${first[0].toFixed(2)} ${baseY.toFixed(2)} Z`;
}

const SERIES = [
  { key: 'netWorth',    color: '#3b82f6', label: 'Netto vermogen',        dashed: false, width: 2.5, fill: true  },
  { key: 'investments', color: '#a78bfa', label: 'Beleggingen',           dashed: false, width: 2,   fill: true  },
  { key: 'savings',     color: '#34d399', label: 'Spaarbalans',           dashed: false, width: 1.5, fill: false },
  { key: 'woz',         color: '#fbbf24', label: 'Eigen woning (WOZ)',    dashed: true,  width: 1.5, fill: false },
  { key: 'hyp',         color: '#fb923c', label: 'Hypotheekschuld (neg.)', dashed: true,  width: 1.5, fill: false },
  { key: 'box3',        color: '#f87171', label: 'Box 3 schulden (neg.)', dashed: true,  width: 1.5, fill: false },
] as const;

type SeriesKey = typeof SERIES[number]['key'];

export default function NetWorthProjection({ data, config, onConfigChange }: Props) {
  const { t } = useLanguage();
  const currentYear = data.personal.taxYear;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef                  = useRef<SVGSVGElement>(null);

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

    // WOZ: only included if the user owns the property; stays constant over years
    const wozWaarde = data.woon.woningType === 'hypotheek' ? (data.woon.wozWaarde ?? 0) : 0;

    // Pre-collect all afschrijving items for reserve projection
    const afschrijvingItems = data.afschrijvingen.categorieen.flatMap(c => c.items);
    const afschrijvingRate  = data.afschrijvingen.rentePercentage / 100;

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
      const duoDebt     = duoBalanceByYear.get(year) ?? 0;
      const overigeDebt = data.schulden.beleggingen.reduce((s, schuld) => {
        const elapsed = year - schuld.startJaar;
        if (elapsed < 0) return s + schuld.bedrag;
        if (elapsed >= schuld.looptijd) return s;
        return s + schuld.bedrag * (1 - elapsed / schuld.looptijd);
      }, 0);
      const totalDebt = hypotheekDebt + duoDebt + overigeDebt;
      // Accumulated afschrijvingen reserve earmarked from savings (grows each year)
      const afschrijvingenReserve = afschrijvingItems.reduce(
        (sum, item) => sum + gereserveerdTotNu(item, afschrijvingRate, year), 0
      );
      result.push({
        year, savings, investments, wozWaarde,
        hypotheekDebt, duoDebt, overigeDebt, totalDebt,
        afschrijvingenReserve,
        netWorth: savings + investments + wozWaarde - totalDebt - afschrijvingenReserve,
      });
    }
    return result;
  }, [data, config, currentYear, jaarlijksSparen, jaarlijksBeleggen]);

  // ── Chart geometry — fixed viewBox, scales proportionally via aspect-ratio ──
  const W = 1000; const H = 440;
  const padL = 72; const padR = 24; const padT = 24; const padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const hasWoz   = points[0]?.wozWaarde > 0;
  const box3Debt = (p: ProjectionPoint) => p.duoDebt + p.overigeDebt;
  const allValues = points.flatMap(p => [p.savings, p.investments, p.wozWaarde, -p.hypotheekDebt, -box3Debt(p), p.netWorth]);
  const dataMin = Math.min(...allValues, 0);
  const dataMax = Math.max(...allValues);
  const valuePad = (dataMax - dataMin) * 0.08 || 10000;
  const yMin = dataMin - valuePad;
  const yMax = dataMax + valuePad;

  const xPos = (i: number) => padL + (i / config.jaren) * chartW;
  const yPos = (v: number) => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const seriesPts = (vals: number[]): [number, number][] => vals.map((v, i) => [xPos(i), yPos(v)]);

  const ptsMap: Record<SeriesKey, [number, number][]> = {
    netWorth:    seriesPts(points.map(p => p.netWorth)),
    investments: seriesPts(points.map(p => p.investments)),
    savings:     seriesPts(points.map(p => p.savings)),
    woz:         seriesPts(points.map(p => p.wozWaarde)),
    hyp:         seriesPts(points.map(p => -p.hypotheekDebt)),
    box3:        seriesPts(points.map(p => -box3Debt(p))),
  };

  const ticks    = niceTickRange(yMin, yMax, 6);
  const spansZero = yMin < 0 && yMax > 0;
  const y0       = yPos(0);
  const xLabels: { i: number; label: string }[] = [];
  for (let i = 0; i <= config.jaren; i += Math.ceil(config.jaren / 6)) xLabels.push({ i, label: String(currentYear + i) });
  if (xLabels[xLabels.length - 1]?.i !== config.jaren)
    xLabels.push({ i: config.jaren, label: String(currentYear + config.jaren) });

  const now  = points[0];
  const last = points[points.length - 1];
  const breakEvenYear = now.netWorth < 0 ? (points.find(p => p.netWorth >= 0)?.year ?? null) : null;

  const periodOptions = [10, 20, 30];

  // ── SVG hover handling ──────────────────────────────────────────────────────
  const onSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const chartRelX = (svgX - padL) / chartW;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(chartRelX * config.jaren)));
    setHoverIdx(idx);
  }, [W, padL, chartW, points.length, config.jaren]);

  const hp = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverX = hoverIdx !== null ? xPos(hoverIdx) : null;

  // ── Gradient baseY (bottom of positive area) ────────────────────────────────
  const baseY = spansZero ? y0 : padT + chartH;

  return (
    <SectionCard title={t.forecast.title} icon={<TrendingUp size={20} />} accent="border-blue-500">

      {/* ── Control bar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-4">
        {([
          { label: t.forecast.investReturn, key: 'rendementBeleggingen' as const, max: 30 },
          { label: t.forecast.savingsRate,  key: 'spaarrente'           as const, max: 20 },
          { label: t.forecast.incomeGrowth, key: 'inkomensstijging'     as const, max: 20 },
        ] as const).map(({ label, key, max }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-blue-400">
              <input type="number" step="0.1" min="0" max={max}
                value={config[key] ?? 2}
                onChange={e => onConfigChange({ ...config, [key]: parseFloat(e.target.value) || 0 })}
                className="w-12 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">%</span>
            </div>
          </label>
        ))}
        <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">Periode</span>
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            {periodOptions.map(n => (
              <button key={n} onClick={() => onConfigChange({ ...config, jaren: n })}
                className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer border-0 ${
                  config.jaren === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-600'
                }`}
              >{n}j</button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        {/* Stat chips */}
        {[
          { label: 'Nu',       val: now.netWorth,  extra: '' },
          { label: `+${config.jaren}j`, val: last.netWorth, extra: '' },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-sm">
            <span className="text-[10px] text-slate-400">{label}</span>
            <span className={`text-xs font-bold tabular-nums ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{nl0.format(val)}</span>
          </div>
        ))}
        {breakEvenYear && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-sm">
            <span className="text-[10px] text-slate-400">Break-even</span>
            <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">{breakEvenYear}</span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-1 mb-4">
        Bijdragen via <strong className="text-slate-500 dark:text-slate-400">Kosten</strong> — sparen {nl0.format(jaarlijksSparen)}/jr · beleggen {nl0.format(jaarlijksBeleggen)}/jr
      </p>

      {/* ── Chart + table ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">

        {/* Chart */}
        <div className="flex flex-col rounded-xl overflow-hidden border border-slate-800 shadow-2xl">

          {/* SVG */}
          <div className="relative bg-[#080e1a]" style={{ userSelect: 'none' }}>
            <svg ref={svgRef}
              viewBox={`0 0 ${W} ${H}`} width="100%"
              style={{ display: 'block', height: 'auto' }}
              onMouseMove={onSvgMouseMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                {/* Area fills — userSpaceOnUse so gradient tracks actual data coordinates */}
                <linearGradient id="gNet" x1="0" y1={padT} x2="0" y2={padT + chartH} gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="gInvest" x1="0" y1={padT} x2="0" y2={padT + chartH} gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
                </linearGradient>
                {/* Chart clipping */}
                <clipPath id="chartClip">
                  <rect x={padL} y={padT} width={chartW} height={chartH} />
                </clipPath>
              </defs>

              {/* ── Background subtle dot grid ── */}
              {ticks.map((tick, i) => (
                <g key={i}>
                  <line x1={padL} y1={yPos(tick)} x2={W - padR} y2={yPos(tick)}
                    stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                  <text x={padL - 10} y={yPos(tick) + 4} textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.35)" fontFamily="system-ui, sans-serif">
                    {fmtK(tick)}
                  </text>
                </g>
              ))}

              {/* Left axis line */}
              <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

              {/* Zero line */}
              {spansZero && (
                <line x1={padL} y1={y0} x2={W - padR} y2={y0}
                  stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="6 4" />
              )}

              {/* X labels */}
              {xLabels.map(({ i, label }) => (
                <text key={i} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.3)" fontFamily="system-ui, sans-serif">
                  {label}
                </text>
              ))}

              {/* ── Area fills (clipped) ── */}
              <g clipPath="url(#chartClip)">
                {/* Net worth fill — only positive area */}
                <path d={smoothArea(ptsMap.investments, baseY)} fill="url(#gInvest)" />
                <path d={smoothArea(ptsMap.netWorth.map(([x, y]) => [x, Math.min(y, y0 + 1)] as [number, number]), baseY)} fill="url(#gNet)" />
              </g>

              {/* ── Lines ── */}
              <g clipPath="url(#chartClip)">
                {/* Back series first */}
                <path d={smoothPath(ptsMap.savings)}     fill="none" stroke="#34d399" strokeWidth={1.5} strokeLinecap="round" />
                {hasWoz && <path d={smoothPath(ptsMap.woz)} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="8 4" strokeLinecap="round" />}
                <path d={smoothPath(ptsMap.hyp)}         fill="none" stroke="#fb923c" strokeWidth={1.5} strokeDasharray="6 3" strokeLinecap="round" />
                <path d={smoothPath(ptsMap.box3)}        fill="none" stroke="#f87171" strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round" />
                <path d={smoothPath(ptsMap.investments)} fill="none" stroke="#a78bfa" strokeWidth={2}   strokeLinecap="round" />
                {/* Net worth — main line, on top */}
                <path d={smoothPath(ptsMap.netWorth)}    fill="none" stroke="#3b82f6" strokeWidth={3}   strokeLinecap="round" />
              </g>

              {/* ── Hover crosshair ── */}
              {hoverIdx !== null && hoverX !== null && hp !== null && (
                <g>
                  {/* Vertical rule */}
                  <line x1={hoverX} y1={padT} x2={hoverX} y2={padT + chartH}
                    stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 3" />
                  {/* Dots on each series */}
                  {([
                    { pts: ptsMap.netWorth,    color: '#3b82f6', r: 5, show: true },
                    { pts: ptsMap.investments, color: '#a78bfa', r: 4, show: true },
                    { pts: ptsMap.savings,     color: '#34d399', r: 3, show: true },
                    { pts: ptsMap.woz,         color: '#fbbf24', r: 3, show: hasWoz },
                    { pts: ptsMap.hyp,         color: '#fb923c', r: 3, show: true },
                    { pts: ptsMap.box3,        color: '#f87171', r: 3, show: true },
                  ] as const).filter(s => s.show).map(({ pts, color, r }, i) => {
                    const pt = pts[hoverIdx];
                    if (!pt) return null;
                    return (
                      <g key={i}>
                        <circle cx={pt[0]} cy={pt[1]} r={r + 2} fill={color} fillOpacity={0.2} />
                        <circle cx={pt[0]} cy={pt[1]} r={r} fill={color} />
                      </g>
                    );
                  })}

                  {/* Tooltip — position left of cursor if near right edge */}
                  {(() => {
                    const tipRows = [
                      { label: 'Netto',       val: hp.netWorth,                       color: '#60a5fa', show: true },
                      { label: 'Beleg',       val: hp.investments,                    color: '#c4b5fd', show: true },
                      { label: 'Spaar',       val: hp.savings,                        color: '#6ee7b7', show: true },
                      { label: 'WOZ',         val: hp.wozWaarde,                      color: '#fbbf24', show: hasWoz },
                      { label: 'Hypotheek',   val: -hp.hypotheekDebt,                 color: '#fdba74', show: true },
                      { label: 'Box3 sch.',   val: -(hp.duoDebt + hp.overigeDebt),    color: '#fca5a5', show: true },
                      { label: 'Afschr.res.', val: -hp.afschrijvingenReserve,         color: '#94a3b8', show: hp.afschrijvingenReserve > 0 },
                    ].filter(r => r.show);
                    const tipW = 185; const tipH = 28 + tipRows.length * 22;
                    const flip = hoverX > W - padR - tipW - 20;
                    const tx = flip ? hoverX - tipW - 14 : hoverX + 14;
                    const ty = Math.max(padT + 4, Math.min(padT + chartH - tipH - 4, yPos(hp.netWorth) - tipH / 2));
                    return (
                      <g transform={`translate(${tx},${ty})`}>
                        <rect width={tipW} height={tipH} rx={8} ry={8} fill="#0f172a" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                        <text x={12} y={20} fontSize={13} fontWeight="bold" fill="white" fontFamily="system-ui, sans-serif">{hp.year}</text>
                        {tipRows.map(({ label, val, color }, ri) => (
                          <g key={ri} transform={`translate(0,${32 + ri * 22})`}>
                            <rect x={12} y={4} width={8} height={8} rx={2} fill={color} />
                            <text x={26} y={13} fontSize={11} fill="rgba(255,255,255,0.6)" fontFamily="system-ui, sans-serif">{label}</text>
                            <text x={tipW - 10} y={13} textAnchor="end" fontSize={11} fontWeight="600"
                              fill={val >= 0 ? color : '#f87171'} fontFamily="system-ui, mono, sans-serif">{fmtK(val)}</text>
                          </g>
                        ))}
                      </g>
                    );
                  })()}
                </g>
              )}
            </svg>
          </div>

          {/* Legend */}
          <div className="bg-[#0d1526] border-t border-slate-800 px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              {SERIES.filter(s => s.key !== 'woz' || hasWoz).map(({ color, label, dashed }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <svg width={20} height={12} style={{ flexShrink: 0 }}>
                    <line x1={0} y1={6} x2={20} y2={6} stroke={color} strokeWidth={dashed ? 1.5 : 2}
                      strokeDasharray={dashed ? '5 2' : undefined} />
                  </svg>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-[52px]">Jaar</th>
                <th className="text-right px-2 py-2 font-semibold text-emerald-600 dark:text-emerald-400">Spaar</th>
                <th className="text-right px-2 py-2 font-semibold text-violet-500 dark:text-violet-400">Beleg</th>
                {hasWoz && <th className="text-right px-2 py-2 font-semibold text-amber-500 dark:text-amber-400">WOZ</th>}
                <th className="text-right px-2 py-2 font-semibold text-orange-500 dark:text-orange-400">Schuld</th>
                <th className="text-right px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">Netto</th>
              </tr>
            </thead>
          </table>
          <div className="overflow-y-auto" style={{ maxHeight: 500 }}>
            <table className="w-full text-xs table-fixed">
              <tbody>
                {points.map((p, i) => {
                  const isNow     = p.year === currentYear;
                  const isHovered = i === hoverIdx;
                  return (
                    <tr key={p.year}
                      onMouseEnter={() => setHoverIdx(i)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className={`border-b last:border-0 cursor-default transition-colors ${
                        isHovered
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/30'
                          : isNow
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/20'
                            : i % 2 === 0
                              ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/40'
                              : 'bg-slate-50/50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/40'
                      }`}
                    >
                      <td className={`px-3 py-1.5 font-semibold w-[52px] ${
                        isHovered ? 'text-blue-600 dark:text-blue-300'
                        : isNow   ? 'text-amber-600 dark:text-amber-400'
                        :           'text-slate-500 dark:text-slate-400'
                      }`}>
                        {p.year}
                        {isNow && <span className="ml-1 text-[9px] bg-amber-500 text-white rounded px-1 py-0.5 align-middle">nu</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmtK(p.savings)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-violet-500 dark:text-violet-400">{fmtK(p.investments)}</td>
                      {hasWoz && <td className="px-2 py-1.5 text-right font-mono tabular-nums text-amber-500 dark:text-amber-400">{fmtK(p.wozWaarde)}</td>}
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-orange-500 dark:text-orange-400">−{fmtK(p.totalDebt)}</td>
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
