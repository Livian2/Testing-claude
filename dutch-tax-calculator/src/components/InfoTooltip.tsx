import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface Props {
  tip: string;
  size?: number;
}

interface Pos { above: boolean; left: number; arrowLeft: number }

export default function InfoTooltip({ tip, size = 13 }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Pos>({ above: false, left: 0, arrowLeft: 128 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const TOOLTIP_W = 256; // w-64
    const rect = ref.current.getBoundingClientRect();
    const iconCenterX = rect.left + rect.width / 2;
    const above = rect.bottom + 130 > window.innerHeight;

    // Default: center tooltip on icon
    let left = -TOOLTIP_W / 2;
    // Clamp so it stays 8px from edges
    const minLeft = 8 - rect.left;
    const maxLeft = window.innerWidth - 8 - TOOLTIP_W - rect.left;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    // Arrow points at icon center regardless of tooltip shift
    const arrowLeft = iconCenterX - rect.left - left;

    setPos({ above, left, arrowLeft });
  }, [visible]);

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="button"
      aria-label="Meer informatie"
    >
      <Info
        size={size}
        className="text-slate-400 hover:text-blue-500 cursor-help transition-colors flex-shrink-0"
      />
      {visible && (
        <span
          className={`absolute z-50 w-64 bg-slate-800 text-white text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none leading-relaxed ${
            pos.above ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{ left: pos.left }}
        >
          {tip}
          <span
            className={`absolute border-4 border-transparent ${
              pos.above ? 'top-full border-t-slate-800' : 'bottom-full border-b-slate-800'
            }`}
            style={{ left: pos.arrowLeft }}
          />
        </span>
      )}
    </span>
  );
}
