interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  prefix?: string;
  min?: number;
  max?: number;
}

export default function CurrencyInput({ label, value, onChange, hint, prefix = '€', min = 0, max }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 bg-white">
        <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm border-r border-slate-300 select-none">{prefix}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
        />
      </div>
    </div>
  );
}
