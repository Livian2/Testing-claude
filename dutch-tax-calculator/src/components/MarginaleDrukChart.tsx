import { useMemo, useState, useRef } from 'react';
import type { TaxFormData } from '../types';
import SectionCard from './SectionCard';
import { TrendingDown } from 'lucide-react';

interface Props {
  data: TaxFormData;
}

// ── Simplified 2026 tax formulas (fast, no external deps) ─────────────────────

function calcBox1Tax(grossIncome: number): number {
  // Brackets 2026
  let tax = 0;
  let rem = Math.max(0, grossIncome);
  const b1 = Math.min(rem, 38441);       tax += b1 * 0.3582; rem -= b1;
  const b2 = Math.min(rem, 78426 - 38441); tax += b2 * 0.3748; rem -= b2;
  tax += rem * 0.4950;
  return tax;
}

function calcAHK(income: number): number {
  if (income <= 29739) return 3115;
  if (income <= 78426) return Math.max(0, 3115 - (income - 29739) * 0.0640);
  return 0;
}

function calcArbeidskorting(income: number): number {
  if (income <= 0) return 0;
  if (income <= 11965)  return income * 0.08324;
  if (income <= 25845)  return 996 + (income - 11965) * 0.31009;
  if (income <= 45593)  return 5300 + (income - 25845) * 0.01950;
  if (income <= 132920) return Math.max(0, 5685 - (income - 45593) * 0.06510);
  return 0;
}

function calcZorgtoeslag(income: number, isPartner: boolean): number {
  // 2026: normPremie − 5.75% × inkomen, max €1548 (single) / €3096 (partner), floor €0
  const NORM_SINGLE   = 38441 * 0.0575; // ≈ 2210
  const NORM_PARTNER  = NORM_SINGLE * 2;
  const MAX_SINGLE    = 1548;
  const MAX_PARTNER   = 3096;
  const LIMIT_SINGLE  = 38441;
  const LIMIT_PARTNER = NORM_PARTNER / 0.0575;

  const norm  = isPartner ? NORM_PARTNER  : NORM_SINGLE;
  const max   = isPartner ? MAX_PARTNER   : MAX_SINGLE;
  const limit = isPartner ? LIMIT_PARTNER : LIMIT_SINGLE;
  if (income >= limit) return 0;
  return Math.max(0, Math.min(max, norm - 0.0575 * income));
}

function calcHuurtoeslag(income: number, jaarHuur: number, isPartner: boolean): number {
  const HUUR_AFTOP   = 660 * 12;
  const HUUR_MAX     = 900 * 12;
  const HUUR_NORM    = 290 * 12;
  const HUUR_DREMPEL = 17_500;
  const HUUR_LIMIT   = isPartner ? 43_000 : 32_005;
  if (jaarHuur <= 0 || jaarHuur > HUUR_MAX || income > HUUR_LIMIT) return 0;
  const effectief    = Math.min(jaarHuur, HUUR_AFTOP);
  const base         = Math.max(0, effectief - HUUR_NORM);
  const factor       = Math.max(0, 1 - Math.max(0, income - HUUR_DREMPEL) / (HUUR_LIMIT - HUUR_DREMPEL));
  return base * factor;
}

// Net Box 1 tax (after kortingen, floored at 0)
function netBox1Tax(grossIncome: number): number {
  const gross = calcBox1Tax(grossIncome);
  const ahk   = calcAHK(grossIncome);
  const ak    = calcArbeidskorting(grossIncome);
  return Math.max(0, gross - ahk - ak);
}

// Net income = grossIncome − Box1 netTax + zorgtoeslag [+ huurtoeslag]
function netIncome(
  grossIncome: number,
  isPartner: boolean,
  jaarHuur: number,
  includeToeslagen: boolean,
): number {
  const tax    = netBox1Tax(grossIncome);
  const zorg   = includeToeslagen ? calcZorgtoeslag(grossIncome, isPartner) : 0;
  const huur   = includeToeslagen ? calcHuurtoeslag(grossIncome, jaarHuur, isPartner) : 0;
  return grossIncome - tax + zorg + huur;
}

interface ChartPoint {
  income: number;
  effectiefTarief: number;      // Box1 netTax / grossIncome
  marginalKortingen: number;    // 1 − Δnet(Box1 only) / 1000
  marginalToeslagen: number;    // 1 − Δnet(incl. toeslagen) / 1000
  zorgVerliesPerK: number;      // zorgtoeslag loss per €1000 income rise
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const W = 1000; const H = 320;
const padL = 60; const padR = 24; const padT = 24; const padB = 40;
const chartW = W - padL - padR;
const chartH = H - padT - padB;

function xPos(income: number): number {
  return padL + (income / 150000) * chartW;
}

function yPos(pct: number): number {
  // 0%→bottom, 120%→top
  return padT + chartH - (Math.min(120, Math.max(0, pct)) / 120) * chartH;
}

function linePath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  return pts.reduce((d, [x, y], i) => d + (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`), '');
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MarginaleDrukChart({ data }: Props) {
  const isPartner = data.personal.filingStatus === 'partner';
  const jaarHuur  = data.woon.woningType === 'huur' ? data.woon.maandhuur * 12 : 0;
  const huurEnabled = data.woon.huurtoeslagEnabled !== false;

  const points = useMemo<ChartPoint[]>(() => {
    const result: ChartPoint[] = [];
    const step = 1000;
    for (let x = 0; x <= 150000; x += step) {
      const tax = netBox1Tax(x);
      const effectiefTarief = x > 0 ? (tax / x) * 100 : 0;

      // Marginal rate Box1 incl. kortingen (no toeslagen)
      const netX     = netIncome(x,        isPartner, 0, false);
      const netXp    = netIncome(x + step, isPartner, 0, false);
      const marginalKortingen = x < 150000 ? (1 - (netXp - netX) / step) * 100 : 0;

      // Marginal rate incl. toeslagen
      const jh       = huurEnabled ? jaarHuur : 0;
      const netXT    = netIncome(x,        isPartner, jh, true);
      const netXpT   = netIncome(x + step, isPartner, jh, true);
      const marginalToeslagen = x < 150000 ? (1 - (netXpT - netXT) / step) * 100 : 0;

      // Zorgtoeslag loss per €1000 extra
      const zorgX    = calcZorgtoeslag(x,        isPartner);
      const zorgXp   = calcZorgtoeslag(x + step, isPartner);
      const zorgVerliesPerK = Math.max(0, zorgX - zorgXp);

      result.push({ income: x, effectiefTarief, marginalKortingen, marginalToeslagen, zorgVerliesPerK });
    }
    return result;
  }, [isPartner, jaarHuur, huurEnabled]);

  // Current user's gross income
  const userIncome = data.income.grossSalary + data.income.freelanceIncome +
                     data.income.rentalIncome + data.income.otherBox1Income;

  // Find the point nearest to the user's income
  const userIdx = useMemo(() => {
    const clamped = Math.min(150000, Math.max(0, userIncome));
    return Math.round(clamped / 1000);
  }, [userIncome]);

  const userPoint = points[userIdx] ?? points[0];

  // Hover state
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hoverPoint = hoverIdx !== null ? (points[hoverIdx] ?? null) : null;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX  = e.clientX - rect.left;
    const svgX  = (relX / rect.width) * W;
    const chartX = svgX - padL;
    const income  = Math.max(0, Math.min(150000, (chartX / chartW) * 150000));
    setHoverIdx(Math.round(income / 1000));
  }

  // Build danger zone bands (marginalToeslagen > 80%)
  const dangerBands = useMemo(() => {
    const bands: { x1: number; x2: number }[] = [];
    let start: number | null = null;
    for (const p of points) {
      const danger = p.marginalToeslagen > 80;
      if (danger && start === null) start = p.income;
      if (!danger && start !== null) {
        bands.push({ x1: start, x2: p.income });
        start = null;
      }
    }
    if (start !== null) bands.push({ x1: start, x2: 150000 });
    return bands;
  }, [points]);

  // Line paths
  const pathEffectief   = linePath(points.map(p => [xPos(p.income), yPos(p.effectiefTarief)]   as [number, number]));
  const pathKortingen   = linePath(points.map(p => [xPos(p.income), yPos(p.marginalKortingen)]  as [number, number]));
  const pathToeslagen   = linePath(points.map(p => [xPos(p.income), yPos(p.marginalToeslagen)]  as [number, number]));

  // Y-axis ticks: 0, 20, 40, 60, 80, 100, 120
  const yTicks = [0, 20, 40, 60, 80, 100, 120];
  // X-axis ticks: 0, 25k, 50k, 75k, 100k, 125k, 150k
  const xTicks = [0, 25000, 50000, 75000, 100000, 125000, 150000];

  const userIsInDanger = userPoint.marginalToeslagen > 80;

  return (
    <div className="space-y-4">
      <SectionCard title="Marginale Druk" icon={<TrendingDown size={16} />} accent="border-b border-teal-400">
        {/* Summary panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Effectief tarief Box 1</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {userPoint.effectiefTarief.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">bij jouw inkomen</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Marginale druk (incl. kortingen)</div>
            <div className="text-xl font-bold text-orange-500 dark:text-orange-400">
              {userPoint.marginalKortingen.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">van elke extra euro</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Marginale druk (incl. toeslagen)</div>
            <div className={`text-xl font-bold ${userIsInDanger ? 'text-red-500 dark:text-red-400' : 'text-teal-600 dark:text-teal-400'}`}>
              {userPoint.marginalToeslagen.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {userIsInDanger ? 'Gevarenzone!' : 'bij jouw inkomen'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Zorgtoeslag verlies / €1.000</div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
              €{userPoint.zorgVerliesPerK.toFixed(0)}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">minder toeslag</div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: 'block', height: 'auto' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Background */}
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="transparent" />

            {/* Danger zone bands (>80%) */}
            {dangerBands.map((b, i) => (
              <rect
                key={i}
                x={xPos(b.x1)}
                y={padT}
                width={xPos(b.x2) - xPos(b.x1)}
                height={chartH}
                fill="rgba(239,68,68,0.10)"
              />
            ))}

            {/* 80% threshold line */}
            <line
              x1={padL} y1={yPos(80)} x2={W - padR} y2={yPos(80)}
              stroke="rgba(239,68,68,0.5)" strokeWidth="1" strokeDasharray="4 3"
            />
            <text x={padL + 4} y={yPos(80) - 4} fontSize="9" fill="rgba(239,68,68,0.7)" fontFamily="sans-serif">
              80% drempel
            </text>

            {/* 100% line */}
            <line
              x1={padL} y1={yPos(100)} x2={W - padR} y2={yPos(100)}
              stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="2 4"
            />

            {/* Grid lines (Y) */}
            {yTicks.map(tick => (
              <line
                key={tick}
                x1={padL} y1={yPos(tick)} x2={W - padR} y2={yPos(tick)}
                stroke="rgba(148,163,184,0.15)" strokeWidth="1"
              />
            ))}

            {/* Y axis labels */}
            {yTicks.map(tick => (
              <text
                key={tick}
                x={padL - 6} y={yPos(tick) + 4}
                fontSize="10" textAnchor="end" fill="rgb(148,163,184)" fontFamily="sans-serif"
              >
                {tick}%
              </text>
            ))}

            {/* X axis labels */}
            {xTicks.map(tick => (
              <text
                key={tick}
                x={xPos(tick)} y={H - padB + 16}
                fontSize="10" textAnchor="middle" fill="rgb(148,163,184)" fontFamily="sans-serif"
              >
                {tick === 0 ? '€0' : `€${tick / 1000}k`}
              </text>
            ))}

            {/* Axis lines */}
            <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="rgba(148,163,184,0.3)" strokeWidth="1" />

            {/* Lines */}
            <path d={pathEffectief} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
            <path d={pathKortingen} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
            <path d={pathToeslagen} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" />

            {/* User income vertical marker */}
            {userIncome >= 0 && userIncome <= 150000 && (
              <>
                <line
                  x1={xPos(userIncome)} y1={padT}
                  x2={xPos(userIncome)} y2={padT + chartH}
                  stroke="rgba(251,191,36,0.7)" strokeWidth="1.5" strokeDasharray="4 3"
                />
                <text
                  x={Math.min(xPos(userIncome) + 4, W - padR - 60)}
                  y={padT + 14}
                  fontSize="9" fill="rgb(251,191,36)" fontFamily="sans-serif"
                >
                  Jouw inkomen
                </text>
              </>
            )}

            {/* Hover crosshair */}
            {hoverPoint && (
              <>
                <line
                  x1={xPos(hoverPoint.income)} y1={padT}
                  x2={xPos(hoverPoint.income)} y2={padT + chartH}
                  stroke="rgba(255,255,255,0.25)" strokeWidth="1"
                />
                {/* Dots on lines */}
                <circle cx={xPos(hoverPoint.income)} cy={yPos(hoverPoint.effectiefTarief)}  r="4" fill="#3b82f6" />
                <circle cx={xPos(hoverPoint.income)} cy={yPos(hoverPoint.marginalKortingen)} r="4" fill="#f97316" />
                <circle cx={xPos(hoverPoint.income)} cy={yPos(hoverPoint.marginalToeslagen)} r="4" fill="#14b8a6" />

                {/* Tooltip */}
                {(() => {
                  const tx = xPos(hoverPoint.income);
                  const tipW = 190; const tipH = 90;
                  const tipX = tx + tipW + 16 > W ? tx - tipW - 8 : tx + 8;
                  const tipY = padT + 10;
                  return (
                    <g>
                      <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="6"
                        fill="rgba(15,23,42,0.92)" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
                      <text x={tipX + 10} y={tipY + 16} fontSize="11" fontWeight="bold"
                        fill="rgb(226,232,240)" fontFamily="sans-serif">
                        Inkomen: €{hoverPoint.income.toLocaleString('nl-NL')}
                      </text>
                      <text x={tipX + 10} y={tipY + 32} fontSize="10" fill="#3b82f6" fontFamily="sans-serif">
                        Effectief Box 1: {hoverPoint.effectiefTarief.toFixed(1)}%
                      </text>
                      <text x={tipX + 10} y={tipY + 48} fontSize="10" fill="#f97316" fontFamily="sans-serif">
                        Marginaal (kortingen): {hoverPoint.marginalKortingen.toFixed(1)}%
                      </text>
                      <text x={tipX + 10} y={tipY + 64} fontSize="10" fill="#14b8a6" fontFamily="sans-serif">
                        Marginaal (toeslagen): {hoverPoint.marginalToeslagen.toFixed(1)}%
                      </text>
                      <text x={tipX + 10} y={tipY + 80} fontSize="10" fill="rgb(148,163,184)" fontFamily="sans-serif">
                        Zorgtoeslag verlies/k: €{hoverPoint.zorgVerliesPerK.toFixed(0)}
                      </text>
                    </g>
                  );
                })()}
              </>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-blue-500 rounded" />
            Effectief tarief Box 1
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-orange-500 rounded" />
            Marginale druk incl. kortingen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-teal-500 rounded" />
            Marginale druk incl. toeslagen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }} />
            Gevarenzone &gt;80%
          </span>
        </div>
      </SectionCard>

      {/* Explanation card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
        <p><strong>Wat is marginale druk?</strong> Het percentage van elke extra euro bruto inkomen dat je kwijtraakt aan belasting en verminderde toeslagen.</p>
        <p><strong>Gevarenzone (&gt;80%):</strong> Hier hou je minder dan €0,20 over van elke extra euro. Dit doet zich voor bij de afbouw van de zorgtoeslag (~€23k–€38k), de arbeidskorting-piek (~€45k) en hoge inkomens (&gt;€78k, 49,5%-tarief).</p>
        <p><strong>Let op:</strong> Dit zijn vereenvoudigde berekeningen. Box 3, partnertoeslagen, en eigenwoningforfait zijn niet meegenomen in de marginaliteit.</p>
      </div>
    </div>
  );
}
