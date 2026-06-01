import {
  useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';

/* ────────────────────────────────────────────────────────────────────────────
 *  Showcase — shared component library
 *
 *  A small kit of theme-aware panels that share the landing page's
 *  "glass + accent" aesthetic. Used by LandingPage and in-app tabs so
 *  the two surfaces feel like the same product.
 *  Colors are passed as CSS hex strings so any tab can tint a panel.
 * ──────────────────────────────────────────────────────────────────────────── */

const hexAlpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ── PanelCard ──────────────────────────────────────────────────────────── */
export function PanelCard({
  accent, icon, title, badge, children, footer, className = '',
}: {
  accent: string;
  icon?: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group/panel relative flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 backdrop-blur shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${className}`}
      style={{
        backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${hexAlpha(accent, 0.06)} 0%, transparent 60%)`,
      }}
    >
      {/* Accent glow ribbon along the top */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b text-sm font-semibold text-slate-700 dark:text-slate-100"
        style={{ borderBottomColor: hexAlpha(accent, 0.4) }}
      >
        {icon && <span className="shrink-0" style={{ color: accent }}>{icon}</span>}
        <span className="truncate">{title}</span>
        {badge && <span className="ml-auto shrink-0">{badge}</span>}
      </div>

      <div className="flex flex-col flex-1 gap-3 p-3.5">{children}</div>

      {footer && (
        <div
          className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/70 dark:bg-white/[0.02] mt-auto"
          style={{ borderTopColor: hexAlpha(accent, 0.2) }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/* ── StatTile ───────────────────────────────────────────────────────────── */
export function StatTile({
  label, value, accent, sub, animateOnMount,
}: {
  label: string;
  value: ReactNode;
  accent: string;
  sub?: string;
  animateOnMount?: boolean;
}) {
  const [shown, setShown] = useState(!animateOnMount);
  useEffect(() => {
    if (!animateOnMount) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [animateOnMount]);

  return (
    <div
      className="rounded-xl border px-2.5 py-2 transition-all duration-500"
      style={{
        borderColor: hexAlpha(accent, 0.28),
        background: hexAlpha(accent, 0.08),
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(6px)',
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-60 truncate">{label}</p>
      <p className="text-base sm:text-lg font-bold tabular-nums truncate" style={{ color: accent }}>
        {value}
      </p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export function StatGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div className={`grid gap-2 ${cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {children}
    </div>
  );
}

/* ── PanelSection ───────────────────────────────────────────────────────── */
export function PanelSection({
  title, accent, children, tint,
}: {
  title?: string;
  accent?: string;
  tint?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{
        borderColor: tint && accent ? hexAlpha(accent, 0.2) : 'rgba(148,163,184,0.18)',
        background:  tint && accent ? hexAlpha(accent, 0.06) : 'rgba(148,163,184,0.04)',
      }}
    >
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-55 mb-1.5">{title}</p>
      )}
      {children}
    </div>
  );
}

/* ── KeyValueRow ────────────────────────────────────────────────────────── */
export function KeyValueRow({
  label, value, accent, bold, last,
}: {
  label: ReactNode;
  value: ReactNode;
  accent?: string;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-xs py-1 ${last ? '' : 'border-b border-slate-200/60 dark:border-white/5'}`}
    >
      <span className={`${bold ? 'font-semibold text-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'} truncate`}>
        {label}
      </span>
      <span
        className={`tabular-nums shrink-0 ${bold ? 'font-bold' : 'font-medium'}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/* ── BracketBar ─────────────────────────────────────────────────────────── */
export function BracketBar({
  rate, width, base, tax, accent,
}: {
  rate: string;
  width: number;        // 0–100
  base: string;
  tax: string;
  accent: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(width));
    return () => cancelAnimationFrame(id);
  }, [width]);
  return (
    <div className="flex items-center gap-2 py-1 border-b border-slate-200/60 dark:border-white/5 last:border-0">
      <span className="text-[11px] font-mono opacity-60 w-12 shrink-0 tabular-nums">{rate}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${w}%`, background: accent }}
        />
      </div>
      <span className="text-[11px] opacity-60 tabular-nums w-14 text-right shrink-0">{base}</span>
      <span className="text-[11px] font-semibold tabular-nums w-14 text-right shrink-0" style={{ color: accent }}>
        {tax}
      </span>
    </div>
  );
}

/* ── ProgressBar (animated, hover-aware) ────────────────────────────────── */
export function ProgressBar({
  pct, accent, label,
}: {
  pct: number;        // 0–100
  accent: string;
  label?: string;
}) {
  const target = Math.min(100, Math.max(0, pct));
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">{label}</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: accent }}>{target.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10 relative">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{
            width: `${w}%`,
            background: target >= 100
              ? 'linear-gradient(90deg,#10b981,#059669)'
              : `linear-gradient(90deg, ${hexAlpha(accent, 0.7)}, ${accent})`,
            boxShadow: `0 0 12px ${hexAlpha(accent, 0.45)}`,
          }}
        />
      </div>
    </div>
  );
}

/* ── ResultBar (bottom of a PanelCard) ──────────────────────────────────── */
export function ResultBar({
  label, value, accent, suffix,
}: {
  label: string;
  value: ReactNode;
  accent: string;
  suffix?: string;
}) {
  return (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: accent }}>
        {value}
        {suffix && <small className="text-[0.45em] font-bold opacity-70 ml-0.5">{suffix}</small>}
      </span>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  InteractiveAreaChart — animated SVG line+area with hover-scrub.
 *
 *  - Stroke draws itself once (stroke-dashoffset animation)
 *  - Hover reveals a vertical crosshair and a tooltip showing y at that x
 *  - Target line (e.g. FIRE drempel) optional
 *  - Works on dark or light bg via translucent grid lines
 * ──────────────────────────────────────────────────────────────────────────── */
export interface ChartPoint { x: number; y: number; label?: string }

export function InteractiveAreaChart({
  points,
  accent,
  target,
  targetLabel,
  formatY,
  height = 140,
  ariaLabel,
}: {
  points: ChartPoint[];
  accent: string;
  target?: number;
  targetLabel?: string;
  formatY?: (v: number) => string;
  height?: number;
  ariaLabel?: string;
}) {
  const W = 320;
  const padL = 4;
  const padR = 4;
  const padT = 8;
  const padB = 14;
  const chartW = W - padL - padR;
  const chartH = height - padT - padB;
  const fmt = formatY ?? ((v: number) => v.toFixed(0));
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);

  const { yMin, yMax, xy, path, area, pathLen } = useMemo(() => {
    if (!points.length) return { yMin: 0, yMax: 1, xy: [], path: '', area: '', pathLen: 0 };
    let mn = Infinity, mx = -Infinity;
    for (const p of points) { if (p.y < mn) mn = p.y; if (p.y > mx) mx = p.y; }
    if (target !== undefined) { if (target < mn) mn = target; if (target > mx) mx = target; }
    const pad = (mx - mn) * 0.08 || Math.max(1, Math.abs(mx) * 0.1);
    const yMin = mn - pad;
    const yMax = mx + pad;
    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    const xy: [number, number][] = points.map(p => [
      padL + ((p.x - xMin) / (xMax - xMin || 1)) * chartW,
      padT + chartH - ((p.y - yMin) / (yMax - yMin || 1)) * chartH,
    ]);
    let d = `M ${xy[0][0].toFixed(2)} ${xy[0][1].toFixed(2)}`;
    for (let i = 1; i < xy.length; i++) {
      const [x0, y0] = xy[i - 1];
      const [x1, y1] = xy[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx.toFixed(2)} ${y0.toFixed(2)}, ${cx.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }
    const baseY = padT + chartH;
    const area = `${d} L ${xy[xy.length - 1][0].toFixed(2)} ${baseY.toFixed(2)} L ${xy[0][0].toFixed(2)} ${baseY.toFixed(2)} Z`;
    // Crude curve length estimator — good enough for stroke-dash animation
    let len = 0;
    for (let i = 1; i < xy.length; i++) {
      const dx = xy[i][0] - xy[i - 1][0];
      const dy = xy[i][1] - xy[i - 1][1];
      len += Math.hypot(dx, dy) * 1.05;
    }
    return { yMin, yMax, xy, path: d, area, pathLen: len };
  }, [points, chartW, chartH, target]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [path]);

  if (!points.length) return null;

  const yTargetPx = target !== undefined
    ? padT + chartH - ((target - yMin) / (yMax - yMin || 1)) * chartH
    : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < xy.length; i++) {
      const d = Math.abs(xy[i][0] - svgX);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHoverIdx(best);
  };

  const gradId = `chart-grad-${Math.abs(points.length * 31 + points[0].x).toString(36)}`;
  const hp = hoverIdx !== null ? points[hoverIdx] : null;
  const hxy = hoverIdx !== null ? xy[hoverIdx] : null;

  // Tooltip placement — flip to the left if near right edge
  const tipW = 92, tipH = 38;
  const flipLeft = hxy ? hxy[0] > W - tipW - 8 : false;
  const tipX = hxy ? (flipLeft ? hxy[0] - tipW - 8 : hxy[0] + 8) : 0;
  const tipY = hxy ? Math.max(padT, Math.min(padT + chartH - tipH, hxy[1] - tipH / 2)) : 0;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', cursor: 'crosshair' } as CSSProperties}
      onMouseMove={onMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1={padT} x2="0" y2={padT + chartH} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft grid */}
      {[0.25, 0.5, 0.75].map(f => (
        <line
          key={f} x1={padL} x2={W - padR}
          y1={padT + chartH * f} y2={padT + chartH * f}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
        />
      ))}

      {/* Target line */}
      {yTargetPx !== null && (
        <g>
          <line
            x1={padL} x2={W - padR} y1={yTargetPx} y2={yTargetPx}
            stroke={accent} strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="5 3"
          />
          {targetLabel && (
            <text
              x={W - padR - 4} y={yTargetPx - 4} textAnchor="end"
              fontSize={9} fill={accent} fillOpacity={0.85} fontWeight="700"
              fontFamily="system-ui, sans-serif"
            >
              {targetLabel} · {fmt(target!)}
            </text>
          )}
        </g>
      )}

      {/* Area fill */}
      <path
        d={area} fill={`url(#${gradId})`}
        style={{
          opacity: drawn ? 1 : 0,
          transition: 'opacity 600ms ease 400ms',
        }}
      />

      {/* Stroke — self-drawing */}
      <path
        d={path} fill="none" stroke={accent} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"
        style={{
          strokeDasharray: pathLen,
          strokeDashoffset: drawn ? 0 : pathLen,
          transition: 'stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1)',
          filter: `drop-shadow(0 0 6px ${hexAlpha(accent, 0.45)})`,
        }}
      />

      {/* Hover crosshair + dot + tooltip */}
      {hxy && hp && (
        <g>
          <line
            x1={hxy[0]} x2={hxy[0]} y1={padT} y2={padT + chartH}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 3"
          />
          <circle cx={hxy[0]} cy={hxy[1]} r={6} fill={accent} fillOpacity={0.2} />
          <circle cx={hxy[0]} cy={hxy[1]} r={3.2} fill={accent} />

          <g transform={`translate(${tipX},${tipY})`}>
            <rect
              width={tipW} height={tipH} rx={6} ry={6}
              fill="rgba(15,23,42,0.92)" stroke={hexAlpha(accent, 0.5)} strokeWidth={1}
            />
            <text x={8} y={15} fontSize={10} fill="rgba(255,255,255,0.55)" fontFamily="system-ui, sans-serif">
              {hp.label ?? hp.x.toString()}
            </text>
            <text x={8} y={30} fontSize={13} fontWeight="800" fill={accent} fontFamily="system-ui, sans-serif">
              {fmt(hp.y)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
