import { useMemo } from 'react';
import type { TaxFormData, PrognoseConfig } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import SectionCard from './SectionCard';
import CurrencyInput from './CurrencyInput';
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
  hypotheekDebt: number;
  duoDebt: number;
  overigeDebt: number;
  totalDebt: number;
  netWorth: number;
}

const nl0 = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function fmtK(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}€${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace('.', ',')}m`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}€${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace('.', ',')}k`;
  }
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
    const candidate = f * magnitude;
    if (candidate >= rawStep) {
      niceStep = candidate;
      break;
    }
  }
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount + 1; i++) {
    const t = niceMin + i * niceStep;
    if (t > max + niceStep) break;
    ticks.push(t);
  }
  // Trim to just enough ticks covering [min, max]
  const filtered = ticks.filter(t => t >= niceMin && t <= niceMin + (tickCount + 1) * niceStep);
  // Return 5-6 ticks within range
  return filtered.slice(0, tickCount);
}

export default function NetWorthProjection({ data, config, onConfigChange }: Props) {
  const currentYear = data.personal.taxYear;

  const points = useMemo<ProjectionPoint[]>(() => {
    // Starting values
    const initSavings =
      data.waardes.spaarrekeningen.reduce((s, r) => s + r.saldoJan1, 0) +
      data.waardes.betaalrekeningen.reduce((s, r) => s + r.saldoJan1, 0);

    // Investments: prefer actual portfolio current value (using live prices, falling
    // back to purchase price), and only fall back to Box 3 jan-1 values if no portfolio.
    const portfolioValue = data.portfolio.holdings.reduce((s, h) => {
      const price = h.currentPrice > 0 ? h.currentPrice : h.pricePerUnit;
      return s + h.quantity * price;
    }, 0);
    const jan1Investments = data.waardes.beleggingen.reduce((s, r) => s + r.waardeJan1, 0);
    const initInvestments = portfolioValue > 0 ? portfolioValue : jan1Investments;

    const result: ProjectionPoint[] = [];

    for (let i = 0; i <= config.jaren; i++) {
      const year = currentYear + i;

      // Savings: grows by spaarrente% each year + annual deposit
      const savings =
        i === 0
          ? initSavings
          : result[i - 1].savings * (1 + config.spaarrente / 100) + config.jaarlijksSparen;

      // Investments: grows by rendementBeleggingen% each year + annual investment
      const investments =
        i === 0
          ? initInvestments
          : result[i - 1].investments * (1 + config.rendementBeleggingen / 100) + config.jaarlijksBeleggen;

      // Hypotheek debt: sum restschuldBegin from berekenHypotheek
      const hypotheekDebt = data.woon.hypotheken.reduce((sum, hyp) => {
        return sum + berekenHypotheek(hyp, year).restschuldBegin;
      }, 0);

      // DUO debt: linear decline with grace period
      const duoDebt = data.schulden.duo.reduce((sum, duo) => {
        const aflossStart = duo.aflossingsStartJaar ?? duo.startJaar;
        if (year < aflossStart) return sum + duo.bedrag;
        const elapsed = year - aflossStart;
        if (elapsed >= duo.looptijd) return sum;
        return sum + duo.bedrag * (1 - elapsed / duo.looptijd);
      }, 0);

      // Overige beleggingsschulden: linear decline from startJaar over looptijd
      const overigeDebt = data.schulden.beleggingen.reduce((sum, schuld) => {
        const elapsed = year - schuld.startJaar;
        if (elapsed < 0) return sum + schuld.bedrag;
        if (elapsed >= schuld.looptijd) return sum;
        return sum + schuld.bedrag * (1 - elapsed / schuld.looptijd);
      }, 0);

      const totalDebt = hypotheekDebt + duoDebt + overigeDebt;
      const netWorth = savings + investments - totalDebt;

      result.push({ year, savings, investments, hypotheekDebt, duoDebt, overigeDebt, totalDebt, netWorth });
    }

    return result;
  }, [data, config, currentYear]);

  // SVG dimensions
  const W = 800;
  const H = 320;
  const padL = 75;
  const padR = 20;
  const padT = 25;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allValues = points.flatMap(p => [p.savings, p.investments, -p.totalDebt, p.netWorth]);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const valuePad = (dataMax - dataMin) * 0.05 || 1;
  const yMin = dataMin - valuePad;
  const yMax = dataMax + valuePad;

  function xPos(i: number): number {
    return padL + (i / config.jaren) * chartW;
  }

  function yPos(v: number): number {
    return padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  }

  function polyline(values: number[]): string {
    return values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
  }

  const ticks = niceTickRange(yMin, yMax, 6);
  const spansZero = yMin < 0 && yMax > 0;

  // X-axis labels every 5 years
  const xLabels: { i: number; label: string }[] = [];
  for (let i = 0; i <= config.jaren; i += 5) {
    xLabels.push({ i, label: String(currentYear + i) });
  }
  if (config.jaren % 5 !== 0) {
    xLabels.push({ i: config.jaren, label: String(currentYear + config.jaren) });
  }

  // Summary stats
  const now = points[0];
  const last = points[points.length - 1];
  const breakEvenPoint = points.find(p => p.netWorth >= 0);
  const breakEvenYear = now.netWorth < 0 && breakEvenPoint ? breakEvenPoint.year : null;

  const periodOptions: { value: number; label: string }[] = [
    { value: 10, label: '10 jr' },
    { value: 20, label: '20 jr' },
    { value: 30, label: '30 jr' },
  ];

  return (
    <SectionCard title="Vermogensprognose" icon={<TrendingUp size={20} />} accent="border-emerald-400">
      {/* Config inputs */}
      <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <CurrencyInput
            label="Jaarlijkse spaarbijdrage"
            value={config.jaarlijksSparen}
            onChange={v => onConfigChange({ ...config, jaarlijksSparen: v })}
            suffix="/jaar"
          />
          <CurrencyInput
            label="Jaarlijkse beleggingsbijdrage"
            value={config.jaarlijksBeleggen}
            onChange={v => onConfigChange({ ...config, jaarlijksBeleggen: v })}
            suffix="/jaar"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Verwacht rendement beleggingen</label>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 bg-white">
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={config.rendementBeleggingen}
                onChange={e => onConfigChange({ ...config, rendementBeleggingen: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white min-w-0"
              />
              <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm border-l border-slate-300 select-none">%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Verwacht spaarrente</label>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 bg-white">
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={config.spaarrente}
                onChange={e => onConfigChange({ ...config, spaarrente: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white min-w-0"
              />
              <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm border-l border-slate-300 select-none">%</span>
            </div>
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 mr-1">Prognoseperiode:</span>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            {periodOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => onConfigChange({ ...config, jaren: opt.value })}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  config.jaren === opt.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padL}
                y1={yPos(tick)}
                x2={W - padR}
                y2={yPos(tick)}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={yPos(tick) + 4}
                textAnchor="end"
                fontSize={10}
                fill="#64748b"
              >
                {fmtK(tick)}
              </text>
            </g>
          ))}

          {/* Zero reference line */}
          {spansZero && (
            <line
              x1={padL}
              y1={yPos(0)}
              x2={W - padR}
              y2={yPos(0)}
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}

          {/* X axis labels */}
          {xLabels.map(({ i, label }) => (
            <text
              key={i}
              x={xPos(i)}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#64748b"
            >
              {label}
            </text>
          ))}

          {/* X axis base line */}
          <line
            x1={padL}
            y1={padT + chartH}
            x2={W - padR}
            y2={padT + chartH}
            stroke="#e2e8f0"
            strokeWidth={1}
          />

          {/* Savings line */}
          <polyline
            points={polyline(points.map(p => p.savings))}
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Investments line */}
          <polyline
            points={polyline(points.map(p => p.investments))}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Total debt (shown as negative) */}
          <polyline
            points={polyline(points.map(p => -p.totalDebt))}
            fill="none"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Net worth (bold) */}
          <polyline
            points={polyline(points.map(p => p.netWorth))}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          {[
            { color: '#10b981', label: 'Spaarbalans', dashed: false },
            { color: '#8b5cf6', label: 'Beleggingen', dashed: false },
            { color: '#ef4444', label: 'Totale schuld (neg.)', dashed: true },
            { color: '#3b82f6', label: 'Netto vermogen', dashed: false },
          ].map(({ color, label, dashed }) => (
            <div key={label} className="flex items-center gap-1.5">
              <svg width={16} height={10}>
                <line
                  x1={0}
                  y1={5}
                  x2={16}
                  y2={5}
                  stroke={color}
                  strokeWidth={dashed ? 1.5 : 2}
                  strokeDasharray={dashed ? '4 2' : undefined}
                />
              </svg>
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Netto vermogen nu</p>
          <p className={`text-base font-bold ${now.netWorth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {nl0.format(now.netWorth)}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Netto vermogen in {config.jaren} jaar</p>
          <p className={`text-base font-bold ${last.netWorth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {nl0.format(last.netWorth)}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Break-even jaar</p>
          <p className="text-base font-bold text-slate-800">
            {breakEvenYear !== null ? breakEvenYear : '—'}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
