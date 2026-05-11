import { useState, useEffect, useRef, type ReactNode } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  decimals?: boolean;
  tooltip?: ReactNode;
}

function formatNL(n: number, decimals = false): string {
  if (n === 0) return '';
  return new Intl.NumberFormat('nl-NL', {
    maximumFractionDigits: decimals ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(n);
}

function parseNL(s: string): number {
  // Strip everything except digits and comma (decimal separator in nl-NL)
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

export default function CurrencyInput({
  label, value, onChange, hint, prefix = '€', suffix, min = 0, decimals = false, tooltip,
}: Props) {
  const [display, setDisplay] = useState(formatNL(value, decimals));
  const focused = useRef(false);

  // Sync display when value changes externally (e.g. reset)
  useEffect(() => {
    if (!focused.current) {
      setDisplay(formatNL(value, decimals));
    }
  }, [value, decimals]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">{label}{tooltip}</label>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 bg-white dark:bg-slate-700">
        {prefix && (
          <span className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm border-r border-slate-300 dark:border-slate-600 select-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="numeric"
          value={display}
          placeholder="0"
          min={min}
          onFocus={() => {
            focused.current = true;
            // Show raw number while editing
            setDisplay(value === 0 ? '' : String(value));
          }}
          onChange={e => {
            const raw = e.target.value.replace(/[^\d,]/g, '');
            setDisplay(raw);
            onChange(parseNL(raw));
          }}
          onBlur={() => {
            focused.current = false;
            setDisplay(formatNL(value, decimals));
          }}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 dark:text-slate-100 min-w-0"
        />
        {suffix && (
          <span className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm border-l border-slate-300 dark:border-slate-600 select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
