import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { TaxFormData, PrognoseConfig } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import { computePositions } from '../utils/taxCalculations';
import { simuleerDuo } from '../utils/duo';
import { gereserveerdTotNu, jaarDeposit } from '../utils/afschrijvingen';
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
  if (abs >= 1_000)     return `${sign}€${(abs / 1_000).toFixed(1).replace('.', ',')}k`;
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

type SeriesKey = 'netWorth' | 'investments' | 'savings' | 'woz' | 'hyp' | 'box3';

const FIRE_STATE_KEY = 'dutch-tax-fire-state';

interface FireState {
  swr: number;
  leeftijd: number;
  gewensteFireLeeftijd: number;
  aowLeeftijd: number;
  aowBedragMaand: number;
  pensioenBedragMaand: number;
  pensioenLeeftijd: number;
}

function loadFireState(): Partial<FireState> {
  try {
    const raw = localStorage.getItem(FIRE_STATE_KEY);
    return raw ? (JSON.parse(raw) as Partial<FireState>) : {};
  } catch { return {}; }
}

export default function NetWorthProjection({ data, config, onConfigChange }: Props) {
  const { t } = useLanguage();
  const currentYear = data.personal.taxYear;

  const SERIES = [
    { key: 'netWorth' as SeriesKey,    color: '#3b82f6', label: t.forecastExtra.legendNetWorth,    dashed: false, width: 2.5, fill: true  },
    { key: 'investments' as SeriesKey, color: '#a78bfa', label: t.forecastExtra.legendInvestments, dashed: false, width: 2,   fill: true  },
    { key: 'savings' as SeriesKey,     color: '#34d399', label: t.forecastExtra.legendSavings,     dashed: false, width: 1.5, fill: false },
    { key: 'woz' as SeriesKey,         color: '#fbbf24', label: t.forecastExtra.legendWoz,         dashed: true,  width: 1.5, fill: false },
    { key: 'hyp' as SeriesKey,         color: '#fb923c', label: t.forecastExtra.legendMortgage,    dashed: true,  width: 1.5, fill: false },
    { key: 'box3' as SeriesKey,        color: '#f87171', label: t.forecastExtra.legendBox3Debts,   dashed: true,  width: 1.5, fill: false },
  ];

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef                  = useRef<SVGSVGElement>(null);

  const isPartnerFireState = data.personal.filingStatus === 'partner';
  const _saved = loadFireState();
  const [swr, setSwr]                                   = useState<number>(_saved.swr                   ?? 4);
  const [leeftijd, setLeeftijd]                         = useState<number>(_saved.leeftijd              ?? data.personal.age ?? 35);
  const [gewensteFireLeeftijd, setGewensteFireLeeftijd] = useState<number>(_saved.gewensteFireLeeftijd  ?? 55);
  const [aowLeeftijd, setAowLeeftijd]                   = useState<number>(_saved.aowLeeftijd           ?? 67);
  const [aowBedragMaand, setAowBedragMaand]             = useState<number>(_saved.aowBedragMaand        ?? (isPartnerFireState ? 985 : 1400));
  const [pensioenBedragMaand, setPensioenBedragMaand]   = useState<number>(_saved.pensioenBedragMaand   ?? 0);
  const [pensioenLeeftijd, setPensioenLeeftijd]         = useState<number>(_saved.pensioenLeeftijd      ?? 67);

  useEffect(() => {
    try {
      localStorage.setItem(FIRE_STATE_KEY, JSON.stringify({
        swr, leeftijd, gewensteFireLeeftijd, aowLeeftijd, aowBedragMaand, pensioenBedragMaand, pensioenLeeftijd,
      } satisfies FireState));
    } catch { /* quota */ }
  }, [swr, leeftijd, gewensteFireLeeftijd, aowLeeftijd, aowBedragMaand, pensioenBedragMaand, pensioenLeeftijd]);

  const jaarlijksSparen   = data.savings.monthlySavingsContribution * 12;
  const jaarlijksBeleggen = data.savings.maandelijksBeleggen * 12;

  const points = useMemo<ProjectionPoint[]>(() => {
    const bankDataSafe = data.bankData ?? { spaarrekeningen: [], betaalrekeningen: [] };

    // Initial savings — single pass over each source
    let initSavings = 0;
    for (const r of data.waardes.spaarrekeningen)   initSavings += r.saldoJan1;
    for (const r of data.waardes.betaalrekeningen)  initSavings += r.saldoJan1;
    for (const r of bankDataSafe.spaarrekeningen)   initSavings += r.saldoJan1 ?? r.saldoHuidig;
    for (const r of bankDataSafe.betaalrekeningen)  initSavings += r.saldoJan1 ?? r.saldoHuidig;

    const positions = computePositions(data.portfolio.holdings, data.portfolio.transactions);
    let portfolioValue = 0;
    for (const p of positions) portfolioValue += p.currentValue;
    let jan1Investments = 0;
    for (const r of data.waardes.beleggingen) jan1Investments += r.waardeJan1;
    const initInvestments = portfolioValue > 0 ? portfolioValue : jan1Investments;
    const startInkomen     = data.income.grossSalary + data.income.freelanceIncome;
    const inkomensstijging = (config.inkomensstijging ?? 2) / 100;
    const isPartner        = data.personal.filingStatus === 'partner';

    // WOZ: only included if the user owns the property; stays constant over years
    const wozWaarde = data.woon.woningType === 'hypotheek' ? (data.woon.wozWaarde ?? 0) : 0;

    // Pre-collect afschrijving items once (was implicit flatMap per year)
    const afschrijvingItems: typeof data.afschrijvingen.categorieen[number]['items'] = [];
    for (const cat of data.afschrijvingen.categorieen) {
      for (const item of cat.items) afschrijvingItems.push(item);
    }
    const afschrijvingRate = data.afschrijvingen.rentePercentage / 100;

    // Annual income phases (bruto used as rough proxy for net reduction in withdrawal)
    const aowJaar              = aowBedragMaand * 12;
    const pensioenJaar         = pensioenBedragMaand * 12;
    const aowCalendarYear      = currentYear + Math.max(0, aowLeeftijd - leeftijd);
    const pensioenCalendarYear = currentYear + Math.max(0, pensioenLeeftijd - leeftijd);

    // Annual base expenses for withdrawal modelling (housing added per-year below)
    const e = data.expenses;
    const baseExp = (e.groceries + e.transport + e.insurance + e.healthcare + e.education + e.leisure + (e.phone ?? 0) + e.other) * 12;

    // Cache growth factors (was recomputed each iteration)
    const savingsGrowth = 1 + config.spaarrente / 100;
    const investGrowth  = 1 + config.rendementBeleggingen / 100;

    // ── Pre-compute per-year debt schedules outside the main loop ──
    const numYears = config.jaren;

    // Pre-compute annual housing cost per year.
    // Rent: constant. Mortgage: maandlast × 12 drops to 0 after payoff; extras persist.
    const extraAnnualHousing = (data.woon.gwe + data.woon.vve + data.woon.overig) * 12;
    const housingByYear = new Float64Array(numYears + 1);
    if (data.woon.woningType === 'huur') {
      housingByYear.fill((data.woon.maandhuur + data.woon.gwe + data.woon.vve + data.woon.overig) * 12);
    } else {
      for (let i = 0; i <= numYears; i++) {
        const y = currentYear + i;
        let hypPayment = 0;
        for (const h of data.woon.hypotheken) hypPayment += berekenHypotheek(h, y).maandlast;
        housingByYear[i] = hypPayment * 12 + extraAnnualHousing;
      }
    }
    const duoByYear = new Float64Array(numYears + 1);
    for (const duo of data.schulden.duo) {
      const sim = simuleerDuo(duo, startInkomen, inkomensstijging, currentYear, isPartner);
      for (const punt of sim.punten) {
        const idx = punt.jaar - currentYear;
        if (idx >= 0 && idx <= numYears) duoByYear[idx] += punt.balans;
      }
    }

    // Hypotheek restschuld per projection year (was computed inside the loop with .reduce)
    const hypByYear = new Float64Array(numYears + 1);
    for (let i = 0; i <= numYears; i++) {
      const y = currentYear + i;
      let s = 0;
      for (const h of data.woon.hypotheken) s += berekenHypotheek(h, y).restschuldBegin;
      hypByYear[i] = s;
    }

    // Beleggingsschulden — straight-line, can be expressed analytically per year
    const overigByYear = new Float64Array(numYears + 1);
    for (let i = 0; i <= numYears; i++) {
      const y = currentYear + i;
      let s = 0;
      for (const schuld of data.schulden.beleggingen) {
        const elapsed = y - schuld.startJaar;
        if (elapsed < 0)                  s += schuld.bedrag;
        else if (elapsed >= schuld.looptijd) { /* paid off */ }
        else                              s += schuld.bedrag * (1 - elapsed / schuld.looptijd);
      }
      overigByYear[i] = s;
    }

    // Afschrijvingen reserve per year — computed incrementally (O(years) instead of O(years²)).
    // Base (i=0) is the full cumulative reserve up to currentYear; each subsequent year only
    // adds that year's deposit, since gereserveerdTotNu(y) − gereserveerdTotNu(y−1) = jaarDeposit(y).
    const afschrByYear = new Float64Array(numYears + 1);
    let afschrAccum = 0;
    for (const item of afschrijvingItems) afschrAccum += gereserveerdTotNu(item, afschrijvingRate, currentYear);
    afschrByYear[0] = afschrAccum;
    for (let i = 1; i <= numYears; i++) {
      const y = currentYear + i;
      for (const item of afschrijvingItems) afschrAccum += jaarDeposit(item, afschrijvingRate, y);
      afschrByYear[i] = afschrAccum;
    }

    const swrDecimal      = swr / 100;
    const heffingsvrij    = isPartner ? 118_714 : 59_357;
    // Index at which forced retirement kicks in (stop contributing, start withdrawing)
    const retirementIdx   = Math.max(1, gewensteFireLeeftijd - leeftijd);

    const result: ProjectionPoint[] = [];
    let fired = false;
    let prevSavings = initSavings;
    let prevInvestments = initInvestments;

    for (let i = 0; i <= numYears; i++) {
      const year = currentYear + i;

      // FIRE uses only liquid (investable) assets — WOZ is excluded.
      // Threshold is year-specific: expenses drop when mortgage is paid off.
      const yearExp      = baseExp + housingByYear[i];
      const taxableW_y   = Math.max(0, yearExp / swrDecimal - heffingsvrij);
      const box3Drag_y   = taxableW_y * 0.0600 * 0.36;
      const fireNum_y    = (yearExp + box3Drag_y) / swrDecimal;
      // Trigger at the earlier of: FIRE number reached OR target retirement age
      if (!fired && i > 0 && ((prevSavings + prevInvestments) >= fireNum_y || i >= retirementIdx)) {
        fired = true;
      }

      let savings: number;
      let investments: number;

      if (i === 0) {
        savings = initSavings;
        investments = initInvestments;
      } else if (!fired) {
        savings     = prevSavings     * savingsGrowth + jaarlijksSparen;
        investments = prevInvestments * investGrowth  + jaarlijksBeleggen;
      } else {
        const aowIncome      = year > aowCalendarYear      ? aowJaar      : 0;
        const pensioenIncome = year > pensioenCalendarYear ? pensioenJaar : 0;
        const required       = Math.max(0, yearExp - aowIncome - pensioenIncome);
        const grownSavings     = Math.max(0, prevSavings)     * savingsGrowth;
        const grownInvestments = Math.max(0, prevInvestments) * investGrowth;
        const totalLiquid      = grownSavings + grownInvestments;
        if (required <= 0 || totalLiquid <= 0) {
          // No withdrawal needed or nothing left
          savings     = grownSavings;
          investments = grownInvestments;
        } else if (required >= totalLiquid) {
          savings     = 0;
          investments = 0;
        } else {
          // Proportional withdrawal: each bucket contributes its share of the total
          const savingsFrac  = grownSavings / totalLiquid;
          savings     = grownSavings     - required * savingsFrac;
          investments = grownInvestments - required * (1 - savingsFrac);
        }
      }

      const hypotheekDebt = hypByYear[i];
      const duoDebt       = duoByYear[i];
      const overigeDebt   = overigByYear[i];
      const totalDebt     = hypotheekDebt + duoDebt + overigeDebt;
      const afschrijvingenReserve = afschrByYear[i];

      result.push({
        year, savings, investments, wozWaarde,
        hypotheekDebt, duoDebt, overigeDebt, totalDebt,
        afschrijvingenReserve,
        netWorth: savings + investments + wozWaarde - totalDebt - afschrijvingenReserve,
      });

      prevSavings = savings;
      prevInvestments = investments;
    }
    return result;
  }, [data, config, currentYear, jaarlijksSparen, jaarlijksBeleggen, swr, leeftijd, gewensteFireLeeftijd, aowBedragMaand, pensioenBedragMaand, aowLeeftijd, pensioenLeeftijd]);

  // ── FIRE calculations ──────────────────────────────────────────────────────
  const annualExpenses = useMemo(() => {
    const e = data.expenses;
    const base = (e.groceries + e.transport + e.insurance + e.healthcare + e.education + e.leisure + (e.phone ?? 0) + e.other) * 12;
    // Add current housing cost
    const extra = (data.woon.gwe + data.woon.vve + data.woon.overig) * 12;
    if (data.woon.woningType === 'huur') {
      return base + (data.woon.maandhuur + data.woon.gwe + data.woon.vve + data.woon.overig) * 12;
    }
    let hypAnnual = 0;
    for (const h of data.woon.hypotheken) hypAnnual += berekenHypotheek(h, currentYear).maandlast * 12;
    return base + hypAnnual + extra;
  }, [data.expenses, data.woon, currentYear]);

  const isPartnerFire = data.personal.filingStatus === 'partner';
  const heffingsvrijdom = isPartnerFire ? 118_714 : 59_357;

  const fireNumber = useMemo(() => {
    const swrDecimal = swr / 100;
    const bruteFireNumber = annualExpenses / swrDecimal;
    const taxableWealth = Math.max(0, bruteFireNumber - heffingsvrijdom);
    const box3TaxDrag = taxableWealth * 0.0600 * 0.36;
    return (annualExpenses + box3TaxDrag) / swrDecimal;
  }, [annualExpenses, swr, heffingsvrijdom]);

  const bruteFireNumber = useMemo(() => annualExpenses / (swr / 100), [annualExpenses, swr]);

  // FIRE year: first year where liquid assets (excl. WOZ) reach the fire number
  const fireYear = useMemo(() => {
    const hit = points.find(p => (p.savings + p.investments) >= fireNumber);
    return hit ? hit.year : null;
  }, [points, fireNumber]);

  const aowGapYears = fireYear !== null ? Math.max(0, aowLeeftijd - (leeftijd + (fireYear - currentYear))) : null;
  const overbruggingskapitaal = aowGapYears !== null ? aowGapYears * annualExpenses : null;

  // AOW & pension phase derived values
  const aowJaarBedrag = aowBedragMaand * 12;
  const pensioenJaarBedrag = pensioenBedragMaand * 12;
  const aowCalendarYear = currentYear + Math.max(0, aowLeeftijd - leeftijd);
  const pensioenCalendarYear = currentYear + Math.max(0, pensioenLeeftijd - leeftijd);
  const nettoOnttrekkingNaAow = Math.max(0, annualExpenses - aowJaarBedrag - pensioenJaarBedrag);

  // FIRE progress uses liquid assets only (savings + investments, no WOZ)
  const fireProgress = useMemo(() => {
    const liquid = (points[0]?.savings ?? 0) + (points[0]?.investments ?? 0);
    if (fireNumber <= 0) return 100;
    return Math.min(100, Math.max(0, (liquid / fireNumber) * 100));
  }, [points, fireNumber]);

  // ── Chart geometry — fixed viewBox, scales proportionally via aspect-ratio ──
  const W = 1000; const H = 440;
  const padL = 72; const padR = 24; const padT = 24; const padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const hasWoz   = points[0]?.wozWaarde > 0;
  // Single-pass min/max — was flatMap creating O(points × 6) temporary array
  let dataMin = 0;
  let dataMax = 0;
  for (const p of points) {
    const b3 = p.duoDebt + p.overigeDebt;
    if (p.savings      < dataMin) dataMin = p.savings;       if (p.savings      > dataMax) dataMax = p.savings;
    if (p.investments  < dataMin) dataMin = p.investments;   if (p.investments  > dataMax) dataMax = p.investments;
    if (p.wozWaarde    < dataMin) dataMin = p.wozWaarde;     if (p.wozWaarde    > dataMax) dataMax = p.wozWaarde;
    if (-p.hypotheekDebt < dataMin) dataMin = -p.hypotheekDebt; if (-p.hypotheekDebt > dataMax) dataMax = -p.hypotheekDebt;
    if (-b3            < dataMin) dataMin = -b3;             if (-b3            > dataMax) dataMax = -b3;
    if (p.netWorth     < dataMin) dataMin = p.netWorth;      if (p.netWorth     > dataMax) dataMax = p.netWorth;
  }
  if (fireNumber > 0 && fireNumber > dataMax) dataMax = fireNumber;
  const valuePad = (dataMax - dataMin) * 0.08 || 10000;
  const yMin = dataMin - valuePad;
  const yMax = dataMax + valuePad;

  const xPos = useCallback((i: number) => padL + (i / config.jaren) * chartW, [config.jaren, chartW]);
  const yPos = useCallback((v: number) => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH, [chartH, yMin, yMax]);

  const ptsMap = useMemo<Record<SeriesKey, [number, number][]>>(() => {
    const map: Record<SeriesKey, [number, number][]> = {
      netWorth: [], investments: [], savings: [], woz: [], hyp: [], box3: [],
    };
    points.forEach((p, i) => {
      const x = xPos(i);
      map.netWorth.push([x, yPos(p.netWorth)]);
      map.investments.push([x, yPos(p.investments)]);
      map.savings.push([x, yPos(p.savings)]);
      map.woz.push([x, yPos(p.wozWaarde)]);
      map.hyp.push([x, yPos(-p.hypotheekDebt)]);
      map.box3.push([x, yPos(-(p.duoDebt + p.overigeDebt))]);
    });
    return map;
  }, [points, xPos, yPos]);

  const ticks    = niceTickRange(yMin, yMax, 6);
  const spansZero = yMin < 0 && yMax > 0;
  const y0       = yPos(0);
  const xLabels: { i: number; label: string }[] = [];
  const xLabelStep = Math.ceil(config.jaren / 6);
  for (let i = 0; i <= config.jaren; i += xLabelStep) xLabels.push({ i, label: String(currentYear + i) });
  if (xLabels[xLabels.length - 1]?.i !== config.jaren)
    xLabels.push({ i: config.jaren, label: String(currentYear + config.jaren) });

  const now  = points[0];
  const last = points[points.length - 1];
  const breakEvenYear = now.netWorth < 0 ? (points.find(p => p.netWorth >= 0)?.year ?? null) : null;

  const periodOptions = [10, 20, 30, 40, 50];

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
          <span className="text-xs text-slate-500 dark:text-slate-400">{t.forecastExtra.period}</span>
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
          { label: t.forecastExtra.now,       val: now.netWorth,  extra: '' },
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
        {t.forecastExtra.contributions} <strong className="text-slate-500 dark:text-slate-400">{t.tabs.expenses}</strong> — {t.forecastExtra.savingYr} {nl0.format(jaarlijksSparen)}/jr · {t.forecastExtra.investYr} {nl0.format(jaarlijksBeleggen)}/jr
      </p>

      {/* ── FIRE section ── */}
      <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tracking-wide uppercase">FIRE</span>

          {/* Huidige leeftijd */}
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.forecastExtra.currentAge}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-amber-400">
              <input type="number" min="18" max="80" step="1"
                value={leeftijd}
                onChange={e => setLeeftijd(parseInt(e.target.value) || 35)}
                className="w-12 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">jr</span>
            </div>
          </label>

          {/* Doel FIRE leeftijd */}
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.forecastExtra.fireTargetAge}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-amber-400">
              <input type="number" min={leeftijd} max="80" step="1"
                value={gewensteFireLeeftijd}
                onChange={e => setGewensteFireLeeftijd(parseInt(e.target.value) || 55)}
                className="w-12 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">jr</span>
            </div>
          </label>

          {/* SWR slider */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">SWR</span>
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
              {([3, 3.5, 4] as const).map(v => (
                <button key={v} onClick={() => setSwr(v)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border-0 ${
                    swr === v
                      ? 'bg-amber-500 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-600'
                  }`}
                >{v}%</button>
              ))}
            </div>
          </label>

          {/* AOW leeftijd */}
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.forecastExtra.aowAge}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-amber-400">
              <input type="number" min="60" max="75" step="1"
                value={aowLeeftijd}
                onChange={e => setAowLeeftijd(parseInt(e.target.value) || 67)}
                className="w-12 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">jr</span>
            </div>
          </label>

          {/* AOW bedrag per maand */}
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {t.forecastExtra.aowAmount}
              <span className="ml-1 text-[9px] text-slate-400 dark:text-slate-500">{t.forecastExtra.aowAmountHint}</span>
            </span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-emerald-400">
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-r border-slate-300 dark:border-slate-600 select-none">€</span>
              <input type="number" min="0" max="5000" step="10"
                value={aowBedragMaand}
                onChange={e => setAowBedragMaand(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
            </div>
          </label>

          {/* Aanvullend pensioen */}
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.forecastExtra.suppPension}</span>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-indigo-400">
              <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-r border-slate-300 dark:border-slate-600 select-none">€</span>
              <input type="number" min="0" max="10000" step="10"
                value={pensioenBedragMaand}
                onChange={e => setPensioenBedragMaand(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
              />
            </div>
          </label>

          {/* Pensioen leeftijd */}
          {pensioenBedragMaand > 0 && (
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.forecastExtra.pensionAge}</span>
              <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-indigo-400">
                <input type="number" min="55" max="75" step="1"
                  value={pensioenLeeftijd}
                  onChange={e => setPensioenLeeftijd(parseInt(e.target.value) || 67)}
                  className="w-12 px-2 py-1 text-xs outline-none bg-white dark:bg-slate-700 dark:text-slate-100 text-right"
                />
                <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-600 text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 select-none">jr</span>
              </div>
            </label>
          )}

          {/* FIRE numbers */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-slate-400">{t.forecastExtra.bruteFireLabel}</span>
              <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">{nl0.format(bruteFireNumber)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-slate-400">{t.forecastExtra.netBox3Label}</span>
              <span className="text-xs font-bold tabular-nums text-amber-500 dark:text-amber-300">{nl0.format(fireNumber)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-slate-400">{t.forecastExtra.annualExpenses}</span>
              <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{nl0.format(annualExpenses)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/40 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-slate-400">{t.forecastExtra.aowContrib}</span>
              <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{nl0.format(aowJaarBedrag)}/jr</span>
            </div>
            {pensioenJaarBedrag > 0 && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/40 rounded-lg px-2.5 py-1">
                <span className="text-[10px] text-slate-400">{t.forecastExtra.pensionContrib}</span>
                <span className="text-xs font-bold tabular-nums text-indigo-500 dark:text-indigo-400">{nl0.format(pensioenJaarBedrag)}/jr</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-slate-400">{t.forecastExtra.netWithdrawalAow}</span>
              <span className="text-xs font-bold tabular-nums text-blue-600 dark:text-blue-400">{nl0.format(nettoOnttrekkingNaAow)}/jr</span>
            </div>
            {fireYear !== null ? (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/40 rounded-lg px-2.5 py-1">
                <span className="text-[10px] text-slate-400">{t.forecastExtra.fiYear}</span>
                <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fireYear} <span className="font-normal text-slate-400">({t.forecastExtra.currentAge.toLowerCase()} {leeftijd + (fireYear - currentYear)})</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
                <span className="text-[10px] text-slate-400">{t.forecastExtra.fiYear}</span>
                <span className="text-xs font-bold tabular-nums text-slate-400">{t.forecastExtra.outsidePeriod}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Leeftijd-mijlpalen ── */}
        {(() => {
          const actualFiAge = fireYear !== null ? leeftijd + (fireYear - currentYear) : null;
          const yearsToTarget = Math.max(0, gewensteFireLeeftijd - leeftijd);
          const yearsToAow    = Math.max(0, aowLeeftijd - leeftijd);
          const targetVsActual = actualFiAge !== null ? actualFiAge - gewensteFireLeeftijd : null;
          const targetReached = actualFiAge !== null && actualFiAge <= gewensteFireLeeftijd;
          const targetFireYear = currentYear + yearsToTarget;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Now */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">{t.forecastExtra.nowLabel}</span>
                  <span className="text-[10px] text-slate-400">{currentYear}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-slate-700 dark:text-slate-200">{leeftijd}</span>
                  <span className="text-[11px] text-slate-400">jr</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t.forecastExtra.currentAgeLabel}</div>
              </div>

              {/* Target FIRE */}
              <div className={`bg-white dark:bg-slate-900 border rounded-lg px-3 py-2.5 ${
                targetReached
                  ? 'border-emerald-300 dark:border-emerald-700/50'
                  : 'border-amber-300 dark:border-amber-700/50'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">{t.forecastExtra.fireTargetAge}</span>
                  <span className="text-[10px] text-slate-400">{targetFireYear}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{gewensteFireLeeftijd}</span>
                  <span className="text-[11px] text-slate-400">jr</span>
                  <span className="ml-auto text-[11px] font-medium text-slate-500 dark:text-slate-400">+{yearsToTarget}j</span>
                </div>
                <div className="text-[10px] mt-0.5">
                  {actualFiAge === null ? (
                    <span className="text-slate-400">{t.forecastExtra.fireNotInPeriod}</span>
                  ) : targetVsActual! <= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ {t.forecastExtra.fireReachable} {actualFiAge} ({-targetVsActual!} {t.forecastExtra.fireEarlier})
                    </span>
                  ) : (
                    <span className="text-orange-500 dark:text-orange-400">
                      {t.forecastExtra.fireForecastAge} {actualFiAge} ({targetVsActual} {t.forecastExtra.fireLater})
                    </span>
                  )}
                </div>
              </div>

              {/* State pension */}
              <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">AOW</span>
                  <span className="text-[10px] text-slate-400">{aowCalendarYear}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{aowLeeftijd}</span>
                  <span className="text-[11px] text-slate-400">jr</span>
                  <span className="ml-auto text-[11px] font-medium text-slate-500 dark:text-slate-400">+{yearsToAow}j</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  +€{aowJaarBedrag.toLocaleString('nl-NL')}/jr {aowCalendarYear}
                </div>
              </div>
            </div>
          );
        })()}

        {/* FIRE progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.forecastExtra.fireProgress}</span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{fireProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fireProgress}%`,
                background: fireProgress >= 100
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #f59e0b, #d97706)',
              }}
            />
          </div>
        </div>

        {/* AOW gap */}
        {fireYear !== null && aowGapYears !== null && overbruggingskapitaal !== null && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t.forecastExtra.aowGapMsg} <strong className="text-amber-600 dark:text-amber-400">{fireYear}</strong>, {t.forecastExtra.aowGapAge}{' '}
            <strong className="text-slate-700 dark:text-slate-200">{aowGapYears} {t.forecastExtra.aowGapYears} {aowLeeftijd})</strong>.
            {aowGapYears > 0 && (
              <> {t.forecastExtra.bridgeCapital} <strong className="text-amber-600 dark:text-amber-400">{nl0.format(overbruggingskapitaal)}</strong>.</>
            )}
            {aowGapYears === 0 && <> {t.forecastExtra.sameYearAow}</>}
          </p>
        )}
        {fireYear === null && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t.forecastExtra.fiOutsidePeriod}
          </p>
        )}
      </div>

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

              {/* Retirement (target FIRE age) vertical dashed line */}
              {(() => {
                const retI = Math.max(0, gewensteFireLeeftijd - leeftijd);
                if (retI > 0 && retI <= config.jaren) {
                  const retX = xPos(retI);
                  return (
                    <g>
                      <line x1={retX} y1={padT} x2={retX} y2={padT + chartH}
                        stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.75} />
                      <text x={retX + 4} y={padT + 14} fontSize={9} fill="#f59e0b" fillOpacity={0.9}
                        fontFamily="system-ui, sans-serif" fontWeight="600">
                        Uittreden {currentYear + retI}
                      </text>
                    </g>
                  );
                }
                return null;
              })()}

              {/* AOW phase background band */}
              {(() => {
                const aowI = aowCalendarYear - currentYear;
                if (aowI > 0 && aowI <= config.jaren) {
                  const aowX = xPos(aowI);
                  return (
                    <rect x={aowX} y={padT} width={W - padR - aowX} height={chartH}
                      fill="rgba(16,185,129,0.06)" />
                  );
                }
                return null;
              })()}

              {/* AOW start vertical dashed line */}
              {(() => {
                const aowI = aowCalendarYear - currentYear;
                if (aowI > 0 && aowI <= config.jaren) {
                  const aowX = xPos(aowI);
                  return (
                    <g>
                      <line x1={aowX} y1={padT} x2={aowX} y2={padT + chartH}
                        stroke="#10b981" strokeWidth={1.5} strokeDasharray="6 4" strokeOpacity={0.7} />
                      <text x={aowX + 4} y={padT + 14} fontSize={9} fill="#10b981" fillOpacity={0.85} fontFamily="system-ui, sans-serif" fontWeight="600">
                        AOW {aowCalendarYear}
                      </text>
                    </g>
                  );
                }
                return null;
              })()}

              {/* Pensioen start vertical dashed line (if different from AOW) */}
              {(() => {
                const penI = pensioenCalendarYear - currentYear;
                const aowI = aowCalendarYear - currentYear;
                if (pensioenBedragMaand > 0 && penI > 0 && penI <= config.jaren && penI !== aowI) {
                  const penX = xPos(penI);
                  return (
                    <g>
                      <line x1={penX} y1={padT} x2={penX} y2={padT + chartH}
                        stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.7} />
                      <text x={penX + 4} y={padT + 26} fontSize={9} fill="#6366f1" fillOpacity={0.85} fontFamily="system-ui, sans-serif" fontWeight="600">
                        Pensioen {pensioenCalendarYear}
                      </text>
                    </g>
                  );
                }
                return null;
              })()}

              {/* FIRE target line */}
              {fireNumber > 0 && (
                <g>
                  <line x1={padL} y1={yPos(fireNumber)} x2={W - padR} y2={yPos(fireNumber)}
                    stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="8 4" />
                  <text x={padL + 6} y={yPos(fireNumber) - 5} fontSize={10} fill="#f59e0b" fillOpacity={0.85} fontFamily="system-ui, sans-serif" fontWeight="600">
                    FIRE {fmtK(fireNumber)}
                  </text>
                </g>
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
                      { label: t.forecastExtra.tooltipNetto,      val: hp.netWorth,                       color: '#60a5fa', show: true },
                      { label: t.forecastExtra.tooltipBeleg,      val: hp.investments,                    color: '#c4b5fd', show: true },
                      { label: t.forecastExtra.tooltipSpaar,      val: hp.savings,                        color: '#6ee7b7', show: true },
                      { label: 'WOZ',                             val: hp.wozWaarde,                      color: '#fbbf24', show: hasWoz },
                      { label: t.forecastExtra.tooltipHypotheek,  val: -hp.hypotheekDebt,                 color: '#fdba74', show: true },
                      { label: t.forecastExtra.tooltipBox3Sch,    val: -(hp.duoDebt + hp.overigeDebt),    color: '#fca5a5', show: true },
                      { label: t.forecastExtra.tooltipAfschrRes,  val: -hp.afschrijvingenReserve,         color: '#94a3b8', show: hp.afschrijvingenReserve > 0 },
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
              {fireNumber > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg width={20} height={12} style={{ flexShrink: 0 }}>
                    <line x1={0} y1={6} x2={20} y2={6} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="8 4" />
                  </svg>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{t.forecastExtra.fireTarget}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-[52px]">{t.forecastExtra.tableYearCol}</th>
                <th className="text-right px-2 py-2 font-semibold text-emerald-600 dark:text-emerald-400">{t.forecastExtra.tableSavingsCol}</th>
                <th className="text-right px-2 py-2 font-semibold text-violet-500 dark:text-violet-400">{t.forecastExtra.tableInvestCol}</th>
                {hasWoz && <th className="text-right px-2 py-2 font-semibold text-amber-500 dark:text-amber-400">WOZ</th>}
                <th className="text-right px-2 py-2 font-semibold text-orange-500 dark:text-orange-400">{t.forecastExtra.tableDebtCol}</th>
                <th className="text-right px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">{t.forecastExtra.tableNetCol}</th>
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
                        {isNow && <span className="ml-1 text-[9px] bg-amber-500 text-white rounded px-1 py-0.5 align-middle">{t.forecastExtra.now}</span>}
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
