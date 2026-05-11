import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface Props {
  tip: string;
  size?: number;
}

export default function InfoTooltip({ tip, size = 13 }: Props) {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setAbove(rect.bottom + 120 > window.innerHeight);
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
          className={`absolute z-50 left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none leading-relaxed ${
            above ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {tip}
          {/* Arrow */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              above
                ? 'top-full border-t-slate-800'
                : 'bottom-full border-b-slate-800'
            }`}
          />
        </span>
      )}
    </span>
  );
}
