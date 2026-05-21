import { useState, type ReactNode } from 'react';

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
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

export default function CurrencyInput({
  label, value, onChange, hint, prefix = '€', suffix, decimals = false, tooltip,
}: Props) {
  // null = not editing; string = current edit buffer
  const [editStr, setEditStr] = useState<string | null>(null);

  const display = editStr !== null ? editStr : formatNL(value, decimals);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
          {label}{tooltip}
        </label>
      )}
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 bg-white dark:bg-slate-700">
        {prefix && (
          <span className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm border-r border-slate-300 dark:border-slate-600 select-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={display}
          placeholder="0"
          onFocus={() => setEditStr(value === 0 ? '' : String(value))}
          onKeyDown={e => {
            if (e.code === 'NumpadDecimal') {
              e.preventDefault();
              const input = e.target as HTMLInputElement;
              const start = input.selectionStart ?? (editStr ?? '').length;
              const end   = input.selectionEnd ?? start;
              const cur   = editStr ?? '';
              if (!cur.includes(',')) {
                const next = cur.slice(0, start) + ',' + cur.slice(end);
                setEditStr(next);
                onChange(parseNL(next));
                requestAnimationFrame(() => input.setSelectionRange(start + 1, start + 1));
              }
            }
          }}
          onChange={e => {
            const raw = e.target.value.replace(/[^\d,]/g, '');
            setEditStr(raw);
            onChange(parseNL(raw));
          }}
          onBlur={() => setEditStr(null)}
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
