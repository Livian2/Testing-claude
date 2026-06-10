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
  label, value, onChange, hint, prefix = '€', suffix, min = 0, max, decimals = false, tooltip,
}: Props) {
  // null = not editing; string = current edit buffer
  const [editStr, setEditStr] = useState<string | null>(null);

  const display = editStr !== null ? editStr : formatNL(value, decimals);

  const clamp = (v: number) => {
    let r = v;
    if (min !== undefined) r = Math.max(min, r);
    if (max !== undefined) r = Math.min(max, r);
    return decimals ? Math.round(r * 100) / 100 : Math.round(r);
  };

  // ↑/↓ steps the value; Shift = ×10. Buffer is reset so the formatted
  // value re-renders from the new number.
  const step = (dir: 1 | -1, shift: boolean) => {
    const base = decimals ? 1 : 100;
    const next = clamp(value + dir * base * (shift ? 10 : 1));
    setEditStr(null);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[13px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
          {label}{tooltip}
        </label>
      )}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      <div className="group flex items-baseline gap-1.5 border-b border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 focus-within:border-amber-500 dark:focus-within:border-amber-500 transition-colors pb-1">
        {prefix && (
          <span className="text-sm text-slate-400 dark:text-slate-500 select-none">{prefix}</span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={display}
          placeholder="0"
          title="↑/↓: ±100 · Shift: ±1.000"
          onFocus={() => setEditStr(value === 0 ? '' : String(value))}
          onKeyDown={e => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
              return;
            }
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
          className="flex-1 text-[15px] outline-none bg-transparent dark:text-slate-100 min-w-0 font-mono tabular-nums text-right border-0 p-0"
        />
        {suffix && (
          <span className="text-xs text-slate-400 dark:text-slate-500 select-none shrink-0">{suffix}</span>
        )}
        {/* Stepper — appears on hover/focus so the field stays quiet otherwise */}
        <span className="flex flex-col -my-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity select-none shrink-0">
          <button
            type="button" tabIndex={-1} aria-label="+"
            onMouseDown={e => { e.preventDefault(); step(1, e.shiftKey); }}
            className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 bg-transparent border-0 cursor-pointer p-0 leading-none text-[9px]"
          >▲</button>
          <button
            type="button" tabIndex={-1} aria-label="−"
            onMouseDown={e => { e.preventDefault(); step(-1, e.shiftKey); }}
            className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 bg-transparent border-0 cursor-pointer p-0 leading-none text-[9px]"
          >▼</button>
        </span>
      </div>
    </div>
  );
}
