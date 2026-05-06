interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start   = polarToCartesian(cx, cy, r, endDeg);
  const end     = polarToCartesian(cx, cy, r, startDeg);
  const large   = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function PieChart({ slices, size = 180 }: Props) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 8;

  let currentAngle = 0;
  const arcs = slices
    .filter(sl => sl.value > 0)
    .map(sl => {
      const sweep = (sl.value / total) * 360;
      const path  = arcPath(cx, cy, r, currentAngle, currentAngle + sweep);
      const mid   = currentAngle + sweep / 2;
      currentAngle += sweep;
      return { ...sl, path, mid, pct: ((sl.value / total) * 100).toFixed(1) };
    });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 drop-shadow-sm">
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill={arc.color} stroke="white" strokeWidth={2}>
            <title>{arc.label}: {nl.format(arc.value)} ({arc.pct}%)</title>
          </path>
        ))}
        {/* Donut hole */}
        <circle cx={cx} cy={cy} r={r * 0.42} fill="white" />
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fontSize="11" fill="#64748b">Totaal</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontWeight="700" fontSize="12" fill="#1e293b">
          {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(total)}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: arc.color }} />
              <span className="text-slate-700 truncate">{arc.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-slate-500">{arc.pct}%</span>
              <span className="font-medium text-slate-800">{nl.format(arc.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
