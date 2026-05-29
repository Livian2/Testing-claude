import { useState, useMemo } from 'react';
import { CreditCard, Plus, Trash2, ChevronDown, ChevronRight, GraduationCap, TrendingDown, BookOpen } from 'lucide-react';
import type { SchuldenData, SchuldItem, DuoType } from '../types';
import { simuleerDuo, berekenDuoJaarbetaling, DUO_DRAAGKRACHT_VRIJ, DUO_DRAAGKRACHT_PARTNER_VRIJ, type DuoFase } from '../utils/duo';
import { useLanguage } from '../i18n/LanguageContext';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: SchuldenData;
  taxYear: number;
  grossSalary: number;
  isPartner?: boolean;
  onChange: (d: SchuldenData) => void;
}

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function uid() { return Math.random().toString(36).slice(2); }

const DEFAULT_SCHULD: Omit<SchuldItem, 'id' | 'label'> = {
  bedrag: 0, rentePercentage: 0, looptijd: 15, rentevastePeriode: 5, startJaar: 2020,
};

interface SchuldCardProps {
  item: SchuldItem;
  taxYear: number;
  onUpdate: (p: Partial<SchuldItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
  accent: string;
  isDuo?: boolean;
}

function SchuldCard({ item, taxYear, onUpdate, onRemove, canRemove, accent, isDuo }: SchuldCardProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  const jaarRente      = item.bedrag * (item.rentePercentage / 100);
  const maandRente     = jaarRente / 12;
  const eindeVast      = item.startJaar + item.rentevastePeriode;
  // Aflossing voltooid = aflossingsStartJaar (clock start) + looptijd
  const aflossStart    = item.aflossingsStartJaar ?? item.startJaar;
  const eindeLooptijd  = aflossStart + item.looptijd;
  const jarenResterend = Math.max(0, eindeLooptijd - taxYear);

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${accent}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 bg-opacity-60">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-0 cursor-pointer p-0"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {item.label || 'Schuld'}
          {item.bedrag > 0 && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">{nl.format(item.bedrag)}</span>
          )}
        </button>
        {canRemove && (
          <button onClick={onRemove}
            className="text-red-400 hover:text-red-600 bg-transparent border-0 cursor-pointer p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white dark:bg-slate-800 space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">{t.debts.name}</label>
              <input
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-400"
                placeholder="bijv. DUO studieschuld"
                value={item.label}
                onChange={e => onUpdate({ label: e.target.value })}
              />
            </div>
            <CurrencyInput
              label={t.debts.debtAtRenteStart}
              hint={isDuo ? t.debts.debtAtRenteStart : t.debts.balanceLabel}
              value={item.bedrag}
              onChange={v => onUpdate({ bedrag: v })}
              tooltip={<InfoTooltip tip={t.debts.debtAtRenteStartTip} />}
            />
          </div>

          {isDuo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* SF15 / SF35 selector */}
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.stelsel}</label>
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
                  {([
                    { value: 'sf15' as DuoType, label: 'SF15', desc: t.schuldExtra.sf15OldDesc, tip: t.debts.sf15Tip },
                    { value: 'sf35' as DuoType, label: 'SF35', desc: t.schuldExtra.sf35NewDesc, tip: t.debts.sf35Tip },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      title={opt.desc}
                      onClick={() => {
                        const looptijd = opt.value === 'sf15' ? 15 : 35;
                        onUpdate({ duoType: opt.value, looptijd });
                      }}
                      className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-colors border-0 cursor-pointer ${
                        (item.duoType ?? 'sf35') === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">{opt.label} <InfoTooltip tip={opt.tip} /></span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {(item.duoType ?? 'sf35') === 'sf15'
                    ? t.debts.schemeSf15OldDesc
                    : t.debts.schemeSf35NewDesc}
                </p>
              </div>

              {/* Lening start — when borrowing began (before interest) */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {t.debts.loanStart} <span className="text-slate-400 dark:text-slate-500 font-normal">— {t.debts.loanStartHint}</span> <InfoTooltip tip={t.debts.loanStartTip} />
                </label>
                <input
                  type="number" min={1990} max={2100}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder={String(item.startJaar)}
                  value={item.leningStartJaar || ''}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    onUpdate({ leningStartJaar: isNaN(v) ? undefined : v });
                  }}
                />
              </div>

              {/* Aflossing start — 15/35-year clock */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {t.debts.repaymentStart} <span className="text-slate-400 dark:text-slate-500 font-normal">— {t.debts.repaymentStartHint}</span> <InfoTooltip tip={t.debts.repaymentStartTip} />
                </label>
                <input
                  type="number" min={1990} max={2100}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={String(item.startJaar)}
                  value={item.aflossingsStartJaar || ''}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    onUpdate({ aflossingsStartJaar: isNaN(v) ? undefined : v });
                  }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">{t.debts.interestRate}</label>
              <input
                type="number" min={0} max={20} step={0.01}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-400"
                placeholder="2.5"
                value={item.rentePercentage || ''}
                onChange={e => onUpdate({ rentePercentage: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">{t.debts.duration} <InfoTooltip tip={t.debts.durationTip} /></label>
              <input
                type="number" min={1} max={50}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-400"
                placeholder="15"
                value={item.looptijd || ''}
                onChange={e => onUpdate({ looptijd: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">{t.debts.fixedRatePeriod}</label>
              <input
                type="number" min={1} max={30}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-400"
                placeholder="5"
                value={item.rentevastePeriode || ''}
                onChange={e => onUpdate({ rentevastePeriode: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">{t.debts.renteStartYear} <InfoTooltip tip={t.debts.interestStartTip} /></label>
              <input
                type="number" min={1990} max={2050}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-400"
                placeholder="2020"
                value={item.startJaar || ''}
                onChange={e => onUpdate({ startJaar: parseInt(e.target.value) || 2020 })}
              />
            </div>
          </div>

          {/* Summary */}
          {item.bedrag > 0 && item.rentePercentage > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t.debts.yearlyInterestAmt}</p>
                <p className="font-bold text-red-800 dark:text-red-400">{nl2.format(jaarRente)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t.debts.monthlyInterest}</p>
                <p className="font-bold text-red-700 dark:text-red-400">{nl2.format(maandRente)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t.debts.rateFixedUntil}</p>
                <p className="font-bold text-slate-700 dark:text-slate-200">{eindeVast}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{Math.max(0, eindeVast - taxYear)} {t.debts.yearsRemaining}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t.debts.repaymentDone}</p>
                <p className="font-bold text-slate-700 dark:text-slate-200">{eindeLooptijd}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{jarenResterend} {t.debts.yearsRemaining}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DebtGroupProps {
  title: string;
  icon: React.ReactNode;
  items: SchuldItem[];
  taxYear: number;
  accent: string;
  buttonColor: string;
  isDuo?: boolean;
  onAdd: (duoType?: DuoType) => void;
  onUpdate: (id: string, p: Partial<SchuldItem>) => void;
  onRemove: (id: string) => void;
}

function DebtGroup({ title, icon, items, taxYear, accent, buttonColor, isDuo, onAdd, onUpdate, onRemove }: DebtGroupProps) {
  const { t } = useLanguage();
  const totaal = items.reduce((s, d) => s + d.bedrag, 0);
  const totaalRente = items.reduce((s, d) => s + d.bedrag * (d.rentePercentage / 100), 0);

  return (
    <SectionCard title={title} icon={icon} accent={accent}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-5 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            {t.common.noItems}
          </div>
        ) : (
          items.map(item => (
            <SchuldCard
              key={item.id}
              item={item}
              taxYear={taxYear}
              accent="border-red-100"
              isDuo={isDuo}
              onUpdate={p => onUpdate(item.id, p)}
              onRemove={() => onRemove(item.id)}
              canRemove={true}
            />
          ))
        )}

        {isDuo ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAdd('sf15')}
              className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
            >
              <Plus size={13} /> {t.debts.addSf15}
            </button>
            <button
              onClick={() => onAdd('sf35')}
              className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
            >
              <Plus size={13} /> {t.debts.addSf35}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAdd()}
            className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
          >
            <Plus size={13} /> {t.debts.addDebt}
          </button>
        )}

        {items.length > 0 && totaal > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-4 py-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.debts.totalDebts}</p>
              <p className="text-base font-bold text-red-800 dark:text-red-400">{nl.format(totaal)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-4 py-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.debts.yearlyInterest}</p>
              <p className="text-base font-bold text-red-700 dark:text-red-400">{nl2.format(totaalRente)}</p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── DUO Simulation Chart ─────────────────────────────────────────────────────

const W = 800, H = 280, PAD = { t: 16, r: 16, b: 32, l: 72 };

const FASE_COLOR: Record<DuoFase, string> = {
  'voor-start':    '#94a3b8',
  'lening':        '#a78bfa',
  'aangroei':      '#f59e0b',
  'aflossing':     '#3b82f6',
  'kwijtschelding':'#ef4444',
  'afgelost':      '#22c55e',
};

interface ChartPoint {
  jaar: number;
  balans: number;
  fase: DuoFase;
}

const FASE_PRIORITY: DuoFase[] = ['aangroei', 'aflossing', 'kwijtschelding', 'lening', 'voor-start', 'afgelost'];

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

function DuoChart({ points, chartStart, maxBal, taxYear }: {
  points: ChartPoint[];
  chartStart: number;
  maxBal: number;
  taxYear: number;
}) {
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const nPts = points.length;
  if (nPts < 2) return null;

  const xS = (i: number) => PAD.l + (i / Math.max(nPts - 1, 1)) * iW;
  const yS = (v: number) => PAD.t + iH - Math.min(1, v / Math.max(maxBal, 1)) * iH;

  // Build colored path segments (group consecutive same-phase points)
  const segments: { fase: DuoFase; indices: number[] }[] = [];
  points.forEach((p, i) => {
    const last = segments[segments.length - 1];
    if (last && last.fase === p.fase) {
      last.indices.push(i);
    } else {
      if (last) last.indices.push(i); // overlap for continuity
      segments.push({ fase: p.fase, indices: [i] });
    }
  });

  const segmentToPts = (indices: number[]): [number, number][] =>
    indices.map(i => [xS(i), yS(points[i].balans)] as [number, number]);

  // X-axis ticks every 5 years + first + last
  const xTicks = points.filter((p, i) => {
    return i === 0 || i === nPts - 1 || (p.jaar - chartStart) % 5 === 0;
  });

  const taxYearIdx = points.findIndex(p => p.jaar === taxYear);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#080e1a] shadow-sm">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }}>
        <defs>
          <clipPath id="duo-chart-clip">
            <rect x={PAD.l} y={PAD.t} width={iW} height={iH} />
          </clipPath>
          {/* One gradient per phase color */}
          {(Object.entries(FASE_COLOR) as [DuoFase, string][]).map(([fase, color]) => (
            <linearGradient key={fase} id={`duo-grad-${fase}`} x1="0" y1={PAD.t} x2="0" y2={PAD.t + iH} gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={PAD.l} y1={yS(maxBal * f)} x2={PAD.l + iW} y2={yS(maxBal * f)}
              className="stroke-slate-200 dark:stroke-white/5" strokeWidth={1} />
            <text x={PAD.l - 8} y={yS(maxBal * f) + 4} textAnchor="end" fontSize={11}
              className="fill-slate-500 dark:fill-white/40" fontFamily="system-ui, sans-serif">
              {f === 0 ? '€ 0' : nl.format(Math.round(maxBal * f))}
            </text>
          </g>
        ))}

        {/* Left axis */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + iH}
          className="stroke-slate-300 dark:stroke-white/10" strokeWidth={1} />

        {/* Filled area + smooth line per segment */}
        {segments.map((seg, si) => {
          if (seg.indices.length < 2) return null;
          const pts = segmentToPts(seg.indices);
          const linePath = smoothPath(pts);
          const lastPt   = pts[pts.length - 1];
          const firstPt  = pts[0];
          const areaPath = `${linePath} L ${lastPt[0].toFixed(2)} ${(PAD.t + iH).toFixed(2)} L ${firstPt[0].toFixed(2)} ${(PAD.t + iH).toFixed(2)} Z`;
          const color    = FASE_COLOR[seg.fase];
          return (
            <g key={si} clipPath="url(#duo-chart-clip)">
              <path d={areaPath}  fill={`url(#duo-grad-${seg.fase})`} />
              <path d={linePath}  fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Tax year marker */}
        {taxYearIdx >= 0 && (
          <g>
            <line
              x1={xS(taxYearIdx)} y1={PAD.t} x2={xS(taxYearIdx)} y2={PAD.t + iH}
              className="stroke-slate-400 dark:stroke-white/30"
              strokeWidth={1} strokeDasharray="4 3"
            />
            <rect x={xS(taxYearIdx) - 14} y={PAD.t + 2} width={28} height={14} rx={3}
              className="fill-amber-500" />
            <text x={xS(taxYearIdx)} y={PAD.t + 12} textAnchor="middle" fontSize={9.5}
              fontWeight="700" fill="white" fontFamily="system-ui, sans-serif">nu</text>
          </g>
        )}

        {/* X-axis labels */}
        {xTicks.map((p, i) => {
          const idx = points.indexOf(p);
          return (
            <text key={i} x={xS(idx)} y={H - 10} textAnchor="middle" fontSize={11}
              className="fill-slate-500 dark:fill-white/40" fontFamily="system-ui, sans-serif">
              {p.jaar}
            </text>
          );
        })}

        {/* X-axis baseline */}
        <line x1={PAD.l} y1={PAD.t + iH} x2={PAD.l + iW} y2={PAD.t + iH}
          className="stroke-slate-300 dark:stroke-white/10" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── DUO Simulation Card ──────────────────────────────────────────────────────

function DuoSimulatieCard({
  duo, taxYear, grossSalary, isPartner,
}: { duo: SchuldItem[]; taxYear: number; grossSalary: number; isPartner: boolean }) {
  const { t } = useLanguage();
  const [inkomensstijging, setInkomensstijging] = useState(2);

  const drempel = isPartner ? DUO_DRAAGKRACHT_PARTNER_VRIJ : DUO_DRAAGKRACHT_VRIJ;
  const maandBetaling = berekenDuoJaarbetaling(grossSalary, isPartner) / 12;

  // All DUO simulations + derived chart/summary data are expensive (per-year simulation
  // loops). Memoise so they only recompute when the inputs actually change — not on every
  // unrelated re-render of this tab.
  const {
    activeDuo, chartStart, chartPoints, totalStartDebt, totalBalansAflossStart, totalKwijtschelding,
    totalBetaald, totalRenteTotaal, allAfgelost, latestAfgelost,
    hasLening, hasAangroei, hasAflossing, hasKwijtschelding, maxBal,
  } = useMemo(() => {
    const activeDuo = duo.filter(d => d.bedrag > 0);
    const simulations = activeDuo.map(d =>
      simuleerDuo(d, grossSalary, inkomensstijging / 100, taxYear, isPartner)
    );

    // Chart starts at the earliest of taxYear or any leningStartJaar (or startJaar fallback)
    const minLeningStart = activeDuo.reduce((min, d) => Math.min(min, d.leningStartJaar ?? d.startJaar), taxYear);
    const chartStart = Math.min(taxYear, minLeningStart);

    // Chart ends a few years past the latest aflossEind
    const maxAflossEind = activeDuo.reduce((max, d) => {
      const s = d.aflossingsStartJaar ?? d.startJaar;
      return Math.max(max, s + d.looptijd);
    }, 0);
    const chartEnd = maxAflossEind + 2;

    // Build combined chart points
    const chartPoints: ChartPoint[] = [];
    for (let jaar = chartStart; jaar <= chartEnd; jaar++) {
      let totaalBalans = 0;
      let dominantFase: DuoFase = 'afgelost';

      simulations.forEach(sim => {
        const pt = sim.punten.find(p => p.jaar === jaar);
        if (pt) {
          totaalBalans += pt.balans;
          const pi = FASE_PRIORITY.indexOf(pt.fase);
          const di = FASE_PRIORITY.indexOf(dominantFase);
          if (pi < di) dominantFase = pt.fase;
        }
      });

      chartPoints.push({ jaar, balans: totaalBalans, fase: dominantFase });
      if (totaalBalans === 0 && jaar > chartStart + 1) break;
    }

    // Summary stats — single pass over simulations
    const totalStartDebt = activeDuo.reduce((s, d) => s + d.bedrag, 0);
    let totalBalansAflossStart = 0, totalKwijtschelding = 0, totalBetaald = 0, totalRenteTotaal = 0;
    let allAfgelost = true;
    let latestAfgelost: number | null = null;
    for (const sim of simulations) {
      totalBalansAflossStart += sim.balansOpAflossStart;
      totalKwijtschelding    += sim.kwijtscheldingsBedrag;
      totalBetaald           += sim.betaaldTotaal;
      totalRenteTotaal       += sim.renteTotaal;
      if (sim.afgelosdJaar === null) allAfgelost = false;
      else latestAfgelost = latestAfgelost === null ? sim.afgelosdJaar : Math.max(latestAfgelost, sim.afgelosdJaar);
    }

    // Phase legend entries that appear in the chart — single pass
    let hasLening = false, hasAangroei = false, hasAflossing = false, hasKwijtschelding = false;
    let maxBal = Math.max(totalStartDebt, 1);
    for (const p of chartPoints) {
      if (p.fase === 'lening')             hasLening = true;
      else if (p.fase === 'aangroei')      hasAangroei = true;
      else if (p.fase === 'aflossing')     hasAflossing = true;
      else if (p.fase === 'kwijtschelding') hasKwijtschelding = true;
      if (p.balans > maxBal) maxBal = p.balans;
    }

    return {
      activeDuo, chartStart, chartPoints, totalStartDebt, totalBalansAflossStart, totalKwijtschelding,
      totalBetaald, totalRenteTotaal, allAfgelost, latestAfgelost,
      hasLening, hasAangroei, hasAflossing, hasKwijtschelding, maxBal,
    };
  }, [duo, grossSalary, inkomensstijging, taxYear, isPartner]);

  const noIncome = grossSalary <= drempel;

  return (
    <SectionCard title={t.debts.simulation} icon={<BookOpen size={20} />} accent="border-blue-400">
      <div className="space-y-4">
        {/* Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.debts.currentIncome}</p>
            <p className="text-base font-bold text-blue-800 dark:text-blue-300">
              {nl.format(grossSalary)}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">/jr</span>
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.debts.paymentNow}</p>
            <p className="text-base font-bold text-blue-700 dark:text-blue-300">
              {noIncome
                ? <span className="text-slate-400 dark:text-slate-500 text-sm">{t.schuldExtra.underDrempel}</span>
                : <>{nl.format(maandBetaling)}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">/mnd</span></>
              }
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-1 col-span-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">{t.debts.incomeGrowth}</label>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-blue-400">
              <input
                type="number" step="0.5" min="0" max="15"
                value={inkomensstijging}
                onChange={e => setInkomensstijging(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 dark:text-slate-100 min-w-0"
              />
              <span className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm border-l border-slate-300 dark:border-slate-600 select-none">%</span>
            </div>
          </div>
        </div>

        {/* Rule explanation */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{t.debts.paymentRule} </span>
            {t.debts.paymentRuleDesc} <strong>{nl.format(drempel)}</strong>/jr
            {isPartner ? ` ${t.debts.partnerStatus}` : ` ${t.debts.singleStatus}`}.
            {' '}{t.debts.writeOffAfterTerm}
          </p>
          {duo.some(d => d.duoType === 'sf15') && (
            <p><span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold rounded px-1 mr-1">SF15</span>{t.schuldExtra.sf15Line}</p>
          )}
          {duo.some(d => !d.duoType || d.duoType === 'sf35') && (
            <p><span className="inline-block bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold rounded px-1 mr-1">SF35</span>{t.schuldExtra.sf35Line}</p>
          )}
        </div>

        {/* Chart */}
        {chartPoints.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t.debts.duoChartTitle}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {hasLening && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: FASE_COLOR['lening'] }} />
                    {t.schuldExtra.phaseLoan}
                  </span>
                )}
                {hasAangroei && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: FASE_COLOR['aangroei'] }} />
                    {t.schuldExtra.phaseAccrual}
                  </span>
                )}
                {hasAflossing && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: FASE_COLOR['aflossing'] }} />
                    {t.schuldExtra.phaseRepayment}
                  </span>
                )}
                {hasKwijtschelding && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: FASE_COLOR['kwijtschelding'] }} />
                    {t.schuldExtra.phaseWriteoff}
                  </span>
                )}
              </div>
            </div>
            <DuoChart
              points={chartPoints}
              chartStart={chartStart}
              maxBal={maxBal}
              taxYear={taxYear}
            />
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.debtAtInterestStart}</p>
            <p className="font-bold text-slate-800 dark:text-slate-100">{nl.format(totalStartDebt)}</p>
          </div>
          {totalBalansAflossStart > totalStartDebt && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.debtAtRepayStart}</p>
              <p className="font-bold text-amber-700">{nl.format(Math.round(totalBalansAflossStart))}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t.schuldExtra.afterAccrual}</p>
            </div>
          )}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.totalPaid}</p>
            <p className="font-bold text-blue-700">{nl.format(Math.round(totalBetaald))}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t.schuldExtra.inclInterest} {nl.format(Math.round(totalRenteTotaal))} {t.schuldExtra.interest}</p>
          </div>
          <div className={`border rounded-xl px-3 py-2.5 ${totalKwijtschelding > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{totalKwijtschelding > 0 ? t.schuldExtra.writeOff : t.schuldExtra.fullyRepaid}</p>
            <p className={`font-bold ${totalKwijtschelding > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
              {totalKwijtschelding > 0
                ? nl.format(Math.round(totalKwijtschelding))
                : (allAfgelost && latestAfgelost ? String(latestAfgelost) : '—')}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{allAfgelost ? t.debts.repaidIn : t.debts.writeOffIn}</p>
            <p className="font-bold text-slate-700 dark:text-slate-200">
              {allAfgelost && latestAfgelost
                ? `${latestAfgelost} (${latestAfgelost - taxYear} jr)`
                : activeDuo.map(d => {
                    const s = d.aflossingsStartJaar ?? d.startJaar;
                    return `${s + d.looptijd}`;
                  }).join(', ')}
            </p>
          </div>
        </div>

        {noIncome && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
            {t.debts.underThresholdFull.replace('{income}', nl.format(grossSalary)).replace('{drempel}', nl.format(drempel))}
            {' '}{t.debts.underIncomeTip}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

export default function SchuldenSection({ data, taxYear, grossSalary, isPartner, onChange }: Props) {
  const { t } = useLanguage();
  let totalDebts = 0, totaalRente = 0;
  for (const d of [...data.duo, ...data.beleggingen]) {
    totalDebts += d.bedrag;
    totaalRente += d.bedrag * (d.rentePercentage / 100);
  }
  const box3Debts  = Math.max(0, totalDebts - 3700);

  return (
    <div className="space-y-4">
      <DebtGroup
        title={t.debts.duoSectionTitle}
        icon={<GraduationCap size={20} />}
        items={data.duo}
        taxYear={taxYear}
        accent="border-blue-400"
        buttonColor="bg-blue-600 hover:bg-blue-700"
        isDuo={true}
        onAdd={(duoType = 'sf35') => onChange({
          ...data,
          duo: [...data.duo, {
            ...DEFAULT_SCHULD,
            id: uid(),
            label: `DUO schuld ${data.duo.length + 1} (${duoType.toUpperCase()})`,
            rentePercentage: 2.56,
            looptijd: duoType === 'sf15' ? 15 : 35,
            duoType,
          }],
        })}
        onUpdate={(id, p) => onChange({ ...data, duo: data.duo.map(d => d.id === id ? { ...d, ...p } : d) })}
        onRemove={id => onChange({ ...data, duo: data.duo.filter(d => d.id !== id) })}
      />

      <DebtGroup
        title={t.debts.investmentDebtsTitle}
        icon={<TrendingDown size={20} />}
        items={data.beleggingen}
        taxYear={taxYear}
        accent="border-orange-400"
        buttonColor="bg-orange-600 hover:bg-orange-700"
        onAdd={() => onChange({
          ...data,
          beleggingen: [...data.beleggingen, {
            ...DEFAULT_SCHULD,
            id: uid(),
            label: `Beleggingsschuld ${data.beleggingen.length + 1}`,
          }],
        })}
        onUpdate={(id, p) => onChange({ ...data, beleggingen: data.beleggingen.map(d => d.id === id ? { ...d, ...p } : d) })}
        onRemove={id => onChange({ ...data, beleggingen: data.beleggingen.filter(d => d.id !== id) })}
      />

      {/* DUO aflossing simulatie */}
      {data.duo.length > 0 && data.duo.some(d => d.bedrag > 0) && (
        <DuoSimulatieCard
          duo={data.duo}
          taxYear={taxYear}
          grossSalary={grossSalary}
          isPartner={isPartner ?? false}
        />
      )}

      {/* Box 3 summary */}
      {totalDebts > 0 && (
        <SectionCard title={t.debts.summary} icon={<CreditCard size={20} />} accent="border-red-400">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.totalDebts}</p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">{nl.format(totalDebts)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.threshold}</p>
              <p className="text-base font-bold text-slate-500 dark:text-slate-400">– {nl.format(3700)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.deductible}</p>
              <p className="text-base font-bold text-red-700">{nl.format(box3Debts)}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.schuldExtra.yearlyInterest}</p>
              <p className="text-base font-bold text-orange-700">{nl2.format(totaalRente)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 flex items-start gap-1">
            <InfoTooltip tip={t.debts.summaryThresholdTip} />
            {t.schuldExtra.summaryNote} <strong>2.62%</strong> (2026).
          </p>
        </SectionCard>
      )}
    </div>
  );
}
