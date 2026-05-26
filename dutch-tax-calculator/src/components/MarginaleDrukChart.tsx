import { useMemo, useState, useRef, useCallback } from 'react';
import type { TaxFormData } from '../types';
import SectionCard from './SectionCard';
import { TrendingDown, AlertTriangle, Info } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  data: TaxFormData;
}

// ─── Simplified inline tax math (fast, directional — no external deps) ────────

// Box 1 brackets 2026
function calcBox1GrossTax(income: number): number {
  let tax = 0;
  let rem = Math.max(0, income);
  if (rem > 78426) { tax += (rem - 78426) * 0.4950; rem = 78426; }
  if (rem > 38441) { tax += (rem - 38441) * 0.3748; rem = 38441; }
  tax += rem * 0.3582;
  return tax;
}

// AHK 2026: max €3.115, afbouw 6,40% boven €29.739
function calcAHK(inkomen: number): number {
  if (inkomen <= 29739) return 3115;
  if (inkomen <= 78426) return Math.max(0, 3115 - (inkomen - 29739) * 0.0640);
  return 0;
}

// Arbeidskorting 2026 (simplified 4-phase)
function calcArbeidskorting(inkomen: number): number {
  if (inkomen <= 0) return 0;
  if (inkomen <= 11965)  return inkomen * 0.08324;
  if (inkomen <= 25845)  return 996  + (inkomen - 11965) * 0.31009;
  if (inkomen <= 45593)  return 5300 + (inkomen - 25845) * 0.01950;
  if (inkomen <= 132920) return Math.max(0, 5685 - (inkomen - 45593) * 0.06510);
  return 0;
}

// Net Box 1 tax after kortingen
function calcBox1NetTax(income: number): number {
  const gross = calcBox1GrossTax(income);
  const ahk   = calcAHK(income);
  const ak    = calcArbeidskorting(income);
  return Math.max(0, gross - ahk - ak);
}

// Zorgtoeslag 2026 — norm derived so toeslag = 0 at income limit
const ZORG_NORM_SINGLE  = 38441 * 0.0575; // ≈ 2210.36
const ZORG_MAX_SINGLE   = 1548;
const ZORG_LIMIT_SINGLE = 38441;
const ZORG_NORM_PARTNER  = ZORG_NORM_SINGLE * 2;
const ZORG_MAX_PARTNER   = 3096;
const ZORG_LIMIT_PARTNER = ZORG_NORM_PARTNER / 0.0575;

function calcZorgtoeslag(income: number, isPartner: boolean): number {
  const norm  = isPartner ? ZORG_NORM_PARTNER  : ZORG_NORM_SINGLE;
  const max   = isPartner ? ZORG_MAX_PARTNER   : ZORG_MAX_SINGLE;
  const limit = isPartner ? ZORG_LIMIT_PARTNER : ZORG_LIMIT_SINGLE;
  if (income >= limit) return 0;
  return Math.max(0, Math.min(max, norm - 0.0575 * income));
}

// Huurtoeslag 2026 (simplified)
const HUUR_AFTOP   = 660 * 12;
const HUUR_MAX_    = 900 * 12;
const HUUR_NORM    = 290 * 12;
const HUUR_DREMPEL = 17_500;

function calcHuurtoeslag(income: number, maandhuur: number, huurEnabled: boolean, isPartner: boolean): number {
  const limit  = isPartner ? 43_000 : 32_005;
  const jaarHuur = maandhuur * 12;
  if (!huurEnabled || jaarHuur <= 0 || jaarHuur > HUUR_MAX_ || income > limit) return 0;
  const effectief = Math.min(jaarHuur, HUUR_AFTOP);
  const base      = Math.max(0, effectief - HUUR_NORM);
  const incomeFac = Math.max(0, 1 - Math.max(0, income - HUUR_DREMPEL) / (limit - HUUR_DREMPEL));
  return base * incomeFac;
}

interface DataPoint {
  inkomen: number;
  effectiefBox1: number;       // total Box 1 tax / gross income  (0–1.2 clamped)
  marginalKortingen: number;   // 1 − (netIncome(x+1000) − netIncome(x)) / 1000
  marginalToeslagen: number;   // same but also includes toeslag loss
}

function buildDataPoints(data: TaxFormData): DataPoint[] {
  const isPartner   = data.personal.filingStatus === 'partner';
  const woningType  = data.woon.woningType;
  const maandhuur   = woningType === 'huur' ? data.woon.maandhuur : 0;
  const huurEnabled = data.woon.huurtoeslagEnabled !== false;

  function netIncomeKortingen(x: number): number {
    return x - calcBox1NetTax(x);
  }

  function netIncomeToeslagen(x: number): number {
    const box1 = calcBox1NetTax(x);
    const zorg = calcZorgtoeslag(x, isPartner);
    const huur = calcHuurtoeslag(x, maandhuur, huurEnabled, isPartner);
    return x - box1 + zorg + huur;
  }

  const STEP = DATA_STEP;
  const MAX  = 150000;
  const N    = Math.floor(MAX / STEP) + 1;
  const points: DataPoint[] = new Array(N);

  // Cache netIncome values to reuse adjacent computations
  let prevNetK = netIncomeKortingen(0);
  let prevNetT = netIncomeToeslagen(0);
  for (let i = 0; i < N; i++) {
    const x = i * STEP;
    const xNext = x + STEP;
    const box1Tax = calcBox1NetTax(x);
    const effectiefBox1 = x > 0 ? Math.max(0, Math.min(1.2, box1Tax / x)) : 0;

    const netK1 = netIncomeKortingen(xNext);
    const marginalKortingen = Math.max(0, Math.min(1.2, 1 - (netK1 - prevNetK) / STEP));

    const netT1 = netIncomeToeslagen(xNext);
    const marginalToeslagen = Math.max(0, Math.min(1.2, 1 - (netT1 - prevNetT) / STEP));

    points[i] = { inkomen: x, effectiefBox1, marginalKortingen, marginalToeslagen };
    prevNetK = netK1;
    prevNetT = netT1;
  }

  return points;
}

// ─── Data constants ───────────────────────────────────────────────────────────

const DATA_STEP = 2000; // must stay in sync with buildDataPoints

// ─── SVG layout constants ─────────────────────────────────────────────────────

const VIEW_W    = 1000;
const VIEW_H    = 320;
const PAD_LEFT  = 58;
const PAD_RIGHT = 20;
const PAD_TOP   = 20;
const PAD_BOT   = 40;

const CHART_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const CHART_H = VIEW_H - PAD_TOP  - PAD_BOT;

const X_MAX   = 150000;
const Y_MAX   = 1.2;    // 120%

function xToSvg(inkomen: number): number {
  return PAD_LEFT + (inkomen / X_MAX) * CHART_W;
}

function yToSvg(pct: number): number {
  return PAD_TOP + CHART_H - (pct / Y_MAX) * CHART_H;
}

function polyline(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function fmtK(v: number): string {
  if (v >= 1000) return `€${Math.round(v / 1000)}k`;
  return `€${v}`;
}

const DANGER_THRESHOLD = 0.80;

const nlCur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarginaleDrukChart({ data }: Props) {
  const { t } = useLanguage();
  const isPartner  = data.personal.filingStatus === 'partner';
  const grossIncome =
    data.income.grossSalary + data.income.freelanceIncome +
    data.income.rentalIncome + data.income.otherBox1Income;

  const points = useMemo(() => buildDataPoints(data), [data]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartDivRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const div = chartDivRef.current;
    if (!div) return;
    const rect   = div.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    // Convert pixel → SVG viewBox space → data value
    const svgX   = (pixelX / rect.width) * VIEW_W;
    const dataX  = ((svgX - PAD_LEFT) / CHART_W) * X_MAX;
    // Find closest data point (DATA_STEP must match buildDataPoints)
    const idx    = Math.round(dataX / DATA_STEP);
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
  }, [points.length]);

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  // Snap to nearest 1000
  const userIdx = Math.min(points.length - 1, Math.max(0, Math.round(grossIncome / 1000)));
  const userPt  = points[userIdx];
  const hovPt   = hoverIdx !== null ? points[hoverIdx] : null;

  // Danger zones where marginalToeslagen > 80%
  const dangerZones = useMemo(() => {
    const zones: { x1: number; x2: number }[] = [];
    let inDanger = false;
    let dangerStart = 0;
    for (const pt of points) {
      const isDanger = pt.marginalToeslagen > DANGER_THRESHOLD;
      if (isDanger && !inDanger) { dangerStart = pt.inkomen; inDanger = true; }
      else if (!isDanger && inDanger) { zones.push({ x1: dangerStart, x2: pt.inkomen }); inDanger = false; }
    }
    if (inDanger) zones.push({ x1: dangerStart, x2: X_MAX });
    return zones;
  }, [points]);

  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
  const xTicks = [0, 25000, 50000, 75000, 100000, 125000, 150000];

  const { lineBox1, lineKort, lineToes } = useMemo(() => ({
    lineBox1: polyline(points.map(p => [xToSvg(p.inkomen), yToSvg(p.effectiefBox1)])),
    lineKort: polyline(points.map(p => [xToSvg(p.inkomen), yToSvg(p.marginalKortingen)])),
    lineToes: polyline(points.map(p => [xToSvg(p.inkomen), yToSvg(p.marginalToeslagen)])),
  }), [points]);

  const userX = xToSvg(grossIncome);

  const userEffBox1  = userPt?.effectiefBox1      ?? 0;
  const userMargKort = userPt?.marginalKortingen   ?? 0;
  const userMargToes = userPt?.marginalToeslagen   ?? 0;
  const inDangerZone = userMargToes > DANGER_THRESHOLD;

  const zorgAtUser       = calcZorgtoeslag(grossIncome, isPartner);
  const zorgAt1k         = calcZorgtoeslag(grossIncome + 1000, isPartner);
  const zorgLossPerKeur  = zorgAtUser - zorgAt1k;

  return (
    <div className="space-y-4">
      <SectionCard
        title={t.tabs.marginale}
        icon={<TrendingDown size={16} />}
      >
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-blue-400 rounded" />
              {t.marginale.effectiveRateBox1}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-orange-400 rounded" />
              {t.marginale.pressureWithCredits}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-teal-400 rounded" />
              {t.marginale.pressureWithAllowances}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-3 rounded-sm border" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.35)' }} />
              {t.marginale.dangerZone}
            </div>
          </div>

          {/* SVG Chart */}
          <div
            ref={chartDivRef}
            className="relative w-full overflow-hidden rounded-xl bg-slate-900 dark:bg-slate-950"
            style={{ cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              width="100%"
              style={{ display: 'block', pointerEvents: 'none' }}
            >
              {/* Horizontal grid lines */}
              {yTicks.map(y => (
                <line
                  key={y}
                  x1={PAD_LEFT} y1={yToSvg(y)}
                  x2={PAD_LEFT + CHART_W} y2={yToSvg(y)}
                  stroke={y === 0.8 ? '#ef4444' : '#334155'}
                  strokeWidth={y === 0.8 ? 0.8 : 0.5}
                  strokeDasharray={y === 0.8 ? '6 4' : undefined}
                  opacity={y === 0.8 ? 0.55 : 0.4}
                />
              ))}
              {/* Vertical grid lines */}
              {xTicks.map(x => (
                <line
                  key={x}
                  x1={xToSvg(x)} y1={PAD_TOP}
                  x2={xToSvg(x)} y2={PAD_TOP + CHART_H}
                  stroke="#334155"
                  strokeWidth={0.5}
                  opacity={0.4}
                />
              ))}

              {/* Danger zone fills */}
              {dangerZones.map((zone, i) => (
                <rect
                  key={i}
                  x={xToSvg(zone.x1)}
                  y={PAD_TOP}
                  width={Math.max(0, xToSvg(zone.x2) - xToSvg(zone.x1))}
                  height={CHART_H}
                  fill="#ef4444"
                  opacity={0.09}
                />
              ))}

              {/* Y-axis tick labels */}
              {yTicks.map(y => (
                <text
                  key={y}
                  x={PAD_LEFT - 6}
                  y={yToSvg(y) + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#94a3b8"
                >
                  {Math.round(y * 100)}%
                </text>
              ))}

              {/* X-axis tick labels */}
              {xTicks.map(x => (
                <text
                  key={x}
                  x={xToSvg(x)}
                  y={PAD_TOP + CHART_H + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#94a3b8"
                >
                  {fmtK(x)}
                </text>
              ))}

              {/* 80% danger label */}
              <text
                x={PAD_LEFT + CHART_W - 4}
                y={yToSvg(0.8) - 4}
                textAnchor="end"
                fontSize={9}
                fill="#ef4444"
                opacity={0.75}
              >
                80% grens
              </text>

              {/* Blue: effectief Box 1 */}
              <polyline
                points={lineBox1}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeLinejoin="round"
                opacity={0.85}
              />
              {/* Orange: marginale druk kortingen */}
              <polyline
                points={lineKort}
                fill="none"
                stroke="#fb923c"
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={0.9}
              />
              {/* Teal: marginale druk toeslagen */}
              <polyline
                points={lineToes}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth={2.5}
                strokeLinejoin="round"
                opacity={0.95}
              />

              {/* User income vertical marker */}
              {grossIncome > 0 && grossIncome <= X_MAX && (
                <>
                  <line
                    x1={userX} y1={PAD_TOP}
                    x2={userX} y2={PAD_TOP + CHART_H}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    opacity={0.8}
                  />
                  <text
                    x={Math.min(userX + 4, PAD_LEFT + CHART_W - 30)}
                    y={PAD_TOP + 13}
                    fontSize={9}
                    fill="#f59e0b"
                    opacity={0.9}
                  >
                    Jij
                  </text>
                </>
              )}

              {/* Hover interactive layer */}
              {hovPt !== null && (
                <>
                  <line
                    x1={xToSvg(hovPt.inkomen)} y1={PAD_TOP}
                    x2={xToSvg(hovPt.inkomen)} y2={PAD_TOP + CHART_H}
                    stroke="#ffffff"
                    strokeWidth={0.8}
                    opacity={0.2}
                  />
                  <circle cx={xToSvg(hovPt.inkomen)} cy={yToSvg(hovPt.effectiefBox1)}    r={3.5} fill="#60a5fa" />
                  <circle cx={xToSvg(hovPt.inkomen)} cy={yToSvg(hovPt.marginalKortingen)} r={3.5} fill="#fb923c" />
                  <circle cx={xToSvg(hovPt.inkomen)} cy={yToSvg(hovPt.marginalToeslagen)} r={3.5} fill="#2dd4bf" />

                  {/* Tooltip */}
                  {(() => {
                    const tx   = xToSvg(hovPt.inkomen);
                    const flip = tx > PAD_LEFT + CHART_W * 0.65;
                    const bx   = flip ? tx - 170 : tx + 10;
                    const by   = PAD_TOP + 8;
                    const h    = hovPt.marginalToeslagen > DANGER_THRESHOLD ? 90 : 78;
                    return (
                      <g>
                        <rect x={bx} y={by} width={160} height={h} rx={6} ry={6} fill="#1e293b" opacity={0.96} />
                        <text x={bx + 8} y={by + 15} fontSize={10} fontWeight="bold" fill="#f1f5f9">
                          {fmtK(hovPt.inkomen)} bruto
                        </text>
                        <rect x={bx + 8}  y={by + 22} width={8} height={8} rx={2} fill="#60a5fa" />
                        <text x={bx + 20} y={by + 30} fontSize={9} fill="#cbd5e1">
                          Eff. Box 1: {fmtPct(hovPt.effectiefBox1)}
                        </text>
                        <rect x={bx + 8}  y={by + 37} width={8} height={8} rx={2} fill="#fb923c" />
                        <text x={bx + 20} y={by + 45} fontSize={9} fill="#cbd5e1">
                          {t.marginale.tooltipCredits}: {fmtPct(hovPt.marginalKortingen)}
                        </text>
                        <rect x={bx + 8}  y={by + 52} width={8} height={8} rx={2} fill="#2dd4bf" />
                        <text x={bx + 20} y={by + 60} fontSize={9} fill="#cbd5e1">
                          {t.marginale.tooltipAllowances}: {fmtPct(hovPt.marginalToeslagen)}
                        </text>
                        <text x={bx + 8}  y={by + 74} fontSize={9} fill="#94a3b8">
                          Netto: €{Math.round((1 - hovPt.marginalToeslagen) * 10)} / €10 extra
                        </text>
                        {hovPt.marginalToeslagen > DANGER_THRESHOLD && (
                          <text x={bx + 8} y={by + 86} fontSize={9} fill="#f87171" fontWeight="bold">
                            ⚠ {t.marginale.dangerZoneShort}
                          </text>
                        )}
                      </g>
                    );
                  })()}
                </>
              )}

              {/* Chart axes */}
              <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + CHART_H} stroke="#475569" strokeWidth={1} />
              <line x1={PAD_LEFT} y1={PAD_TOP + CHART_H} x2={PAD_LEFT + CHART_W} y2={PAD_TOP + CHART_H} stroke="#475569" strokeWidth={1} />
            </svg>
          </div>

          <p className="text-center text-[11px] text-slate-500 dark:text-slate-500 -mt-2">
            Bruto inkomen Box 1
          </p>
        </div>
      </SectionCard>

      {/* Summary Panel */}
      <SectionCard
        title="Jouw marginale druk"
        icon={<Info size={16} />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Effectief tarief Box 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Effectief belastingtarief</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {fmtPct(userEffBox1)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Box 1 belasting / bruto inkomen</p>
            </div>

            {/* Marginale druk incl. kortingen */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Marginale druk (kortingen)</p>
              <p className={`text-2xl font-bold ${userMargKort > DANGER_THRESHOLD ? 'text-red-500' : 'text-orange-500 dark:text-orange-400'}`}>
                {fmtPct(userMargKort)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Per €1.000 extra houdt u €{Math.round((1 - userMargKort) * 1000)} over
              </p>
            </div>

            {/* Marginale druk incl. toeslagen */}
            <div className={`rounded-xl p-4 border ${
              inDangerZone
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
            }`}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Marginale druk (incl. toeslagen)</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${inDangerZone ? 'text-red-600 dark:text-red-400' : 'text-teal-600 dark:text-teal-400'}`}>
                  {fmtPct(userMargToes)}
                </p>
                {inDangerZone && <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {inDangerZone ? 'U bevindt zich in een gevarenzone!' : 'Inclusief verlies aan toeslagen'}
              </p>
            </div>

            {/* Zorgtoeslag verlies per €1k */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Zorgtoeslag verlies</p>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                €{Math.round(zorgLossPerKeur)}
                <span className="text-base font-normal text-slate-400 dark:text-slate-500"> /€1k</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {zorgLossPerKeur > 0
                  ? `Per €1.000 meer inkomen verliest u €${Math.round(zorgLossPerKeur)} zorgtoeslag`
                  : 'Geen zorgtoeslag op dit inkomensniveau'}
              </p>
            </div>
          </div>

          {/* Danger zone warning */}
          {inDangerZone && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <strong>{t.marginale.dangerZoneShort}:</strong> {t.marginale.dangerZoneExplain}{' '}
                {nlCur.format(grossIncome)} bedraagt de marginale druk inclusief toeslag-afbouw{' '}
                <strong>{fmtPct(userMargToes)}</strong>.
                Van elke extra euro houdt u slechts <strong>{fmtPct(1 - userMargToes)}</strong> over.
                Overweeg extra pensioenopbouw of andere aftrekposten om uw belastbaar inkomen te verlagen.
              </p>
            </div>
          )}

          {/* Uitleg */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <strong>Wat is marginale druk?</strong> Het percentage van elke extra euro bruto inkomen dat u <em>niet</em> overhoudt
            — door belasting én afbouw van heffingskortingen en toeslagen.
            Bij 80% houdt u slechts €200 over van €1.000 extra.
            De teal-lijn toont de werkelijke marginale druk inclusief zorgtoeslag- en huurtoeslag-afbouw;
            die kan &gt;100% zijn bij inkomensgrenzen (de "zorgtoeslag-klif" rondom €38.441 single / €76.882 partners).
            <br />
            <span className="opacity-70">
              Indicatieve berekening op basis van 2026-parameters; geen rekening gehouden met pensioenaftrek,
              MKB-winstvrijstelling of andere aftrekposten.
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
