import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import type { AfschrijvingenData, AfschrijvingCategorie, AfschrijvingItem } from '../types';

interface Props {
  data: AfschrijvingenData;
  taxYear: number;
  onChange: (d: AfschrijvingenData) => void;
}

const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function uid() { return Math.random().toString(36).slice(2); }

// Sinking fund: annual deposit to accumulate FV in n years at rate r
function sinkingFundPMT(fv: number, r: number, n: number): number {
  if (n <= 0 || fv <= 0) return 0;
  if (r === 0) return fv / n;
  return fv * r / (Math.pow(1 + r, n) - 1);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getReplacementDate(item: AfschrijvingItem): Date | null {
  const d = parseDate(item.aankoopdatum);
  if (!d) return null;
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + item.looptijdJaren);
  return r;
}

// Amount to deposit in a specific calendar year toward this item's replacement
function jaarDeposit(item: AfschrijvingItem, rate: number, year: number): number {
  const purchase = parseDate(item.aankoopdatum);
  const replace  = getReplacementDate(item);
  if (!purchase || !replace || !item.aankoopprijs || !item.looptijdJaren) return 0;

  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year + 1, 0, 1);

  const effectiveStart = purchase > yearStart ? purchase : yearStart;
  const effectiveEnd   = replace  < yearEnd   ? replace  : yearEnd;
  if (effectiveEnd <= effectiveStart) return 0;

  const replacementCost = item.aankoopprijs * Math.pow(1 + rate, item.looptijdJaren);
  const pmt      = sinkingFundPMT(replacementCost, rate, item.looptijdJaren);
  const MS_YEAR  = 365.25 * 24 * 3600 * 1000;
  const fraction = (effectiveEnd.getTime() - effectiveStart.getTime()) / MS_YEAR;
  return pmt * fraction;
}

// Total deposited so far (from purchase date up to and including today's date)
function gereserveerdTotNu(item: AfschrijvingItem, rate: number, upToYear: number): number {
  const purchase = parseDate(item.aankoopdatum);
  if (!purchase) return 0;
  const startYear = purchase.getFullYear();
  let total = 0;
  for (let y = startYear; y <= upToYear; y++) {
    total += jaarDeposit(item, rate, y);
  }
  return total;
}

// ─── Category row component ──────────────────────────────────────────────────

interface CatRowProps {
  cat: AfschrijvingCategorie;
  rate: number;
  taxYear: number;
  years: number[];
  onUpdate: (c: AfschrijvingCategorie) => void;
  onRemove: () => void;
}

function CatRow({ cat, rate, taxYear, years, onUpdate, onRemove }: CatRowProps) {
  const [open, setOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);

  const addItem = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newItem: AfschrijvingItem = {
      id: uid(), naam: '', aankoopprijs: 0, aankoopdatum: today, looptijdJaren: 3,
    };
    onUpdate({ ...cat, items: [...cat.items, newItem] });
  };

  const updateItem = (id: string, patch: Partial<AfschrijvingItem>) =>
    onUpdate({ ...cat, items: cat.items.map(it => it.id === id ? { ...it, ...patch } : it) });

  const removeItem = (id: string) =>
    onUpdate({ ...cat, items: cat.items.filter(it => it.id !== id) });

  // Category-level year totals
  const catYearTotals = years.map(y =>
    cat.items.reduce((s, it) => s + jaarDeposit(it, rate, y), 0)
  );

  return (
    <tbody>
      {/* Category header row */}
      <tr className="bg-slate-100 border-y border-slate-200">
        <td colSpan={6} className="px-2 py-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(o => !o)}
              className="text-slate-600 bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {editingName ? (
              <input
                autoFocus
                className="text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-0.5 outline-none"
                value={cat.naam}
                onChange={e => onUpdate({ ...cat, naam: e.target.value })}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              />
            ) : (
              <span
                className="text-xs font-semibold text-slate-700 cursor-pointer hover:text-orange-600"
                onClick={() => setEditingName(true)}
              >
                {cat.naam || 'Categorie'}
              </span>
            )}
            <button
              onClick={addItem}
              className="ml-2 flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 bg-transparent border-0 cursor-pointer p-0"
            >
              <Plus size={12} /> product
            </button>
            <button
              onClick={onRemove}
              className="ml-auto text-red-300 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
        {years.map((y, i) => (
          <td key={y} className="px-2 py-1 text-right text-xs font-semibold text-slate-600">
            {catYearTotals[i] > 0 ? nl2.format(catYearTotals[i]) : ''}
          </td>
        ))}
        <td />
      </tr>

      {/* Item rows */}
      {open && cat.items.map(item => {
        const replDate       = getReplacementDate(item);
        const replYear       = replDate ? replDate.getFullYear() : null;
        const replacementCost = item.aankoopprijs > 0
          ? item.aankoopprijs * Math.pow(1 + rate, item.looptijdJaren)
          : 0;
        const reserved       = item.aankoopprijs > 0 ? gereserveerdTotNu(item, rate, taxYear) : 0;

        return (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            {/* Product name */}
            <td className="px-2 py-1.5 pl-6">
              <input
                className="w-full text-xs border border-transparent hover:border-slate-200 focus:border-slate-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-transparent focus:bg-white"
                placeholder="Productnaam"
                value={item.naam}
                onChange={e => updateItem(item.id, { naam: e.target.value })}
              />
            </td>
            {/* Purchase price */}
            <td className="px-2 py-1.5">
              <div className="flex items-center border border-slate-200 rounded overflow-hidden focus-within:ring-1 focus-within:ring-orange-400">
                <span className="px-1.5 bg-slate-50 text-slate-400 text-xs border-r border-slate-200 select-none">€</span>
                <input
                  type="number" min={0} step={0.01}
                  className="w-24 text-xs px-2 py-1 outline-none bg-white"
                  placeholder="0,00"
                  value={item.aankoopprijs || ''}
                  onChange={e => updateItem(item.id, { aankoopprijs: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </td>
            {/* Purchase date */}
            <td className="px-2 py-1.5">
              <input
                type="date"
                className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400"
                value={item.aankoopdatum}
                onChange={e => updateItem(item.id, { aankoopdatum: e.target.value })}
              />
            </td>
            {/* Lifetime */}
            <td className="px-2 py-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1} max={30}
                  className="w-14 text-xs text-center border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-orange-400"
                  value={item.looptijdJaren || ''}
                  onChange={e => updateItem(item.id, { looptijdJaren: parseInt(e.target.value) || 1 })}
                />
                <span className="text-xs text-slate-400">jr</span>
              </div>
            </td>
            {/* Replacement date */}
            <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap">
              {replDate
                ? replDate.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—'}
              {replYear !== null && replYear <= taxYear && (
                <span className="ml-1 text-red-500 font-semibold">!</span>
              )}
            </td>
            {/* Reserved so far / inflation-adjusted target */}
            <td className="px-2 py-1.5 text-xs text-right">
              {item.aankoopprijs > 0 ? (
                <span className="text-slate-500">{nl0.format(reserved)} / {nl0.format(replacementCost)}</span>
              ) : '—'}
            </td>
            {/* Year cells */}
            {years.map(y => {
              const dep = jaarDeposit(item, rate, y);
              const isOverdue  = replYear !== null && y > replYear;
              const isPast     = y < taxYear;
              const isCurrent  = y === taxYear;
              const isFuture   = y > taxYear;

              let bg = '';
              let textColor = 'text-slate-300';
              if (dep > 0 && !isOverdue) {
                if (isPast)    { bg = 'bg-red-50';    textColor = 'text-red-500'; }
                else if (isCurrent) { bg = 'bg-amber-50'; textColor = 'text-amber-700 font-semibold'; }
                else if (isFuture)  { bg = 'bg-green-50'; textColor = 'text-green-700'; }
              }

              return (
                <td key={y} className={`px-2 py-1.5 text-right text-xs ${bg} ${textColor}`}>
                  {dep > 0 && !isOverdue ? nl2.format(dep) : ''}
                </td>
              );
            })}
            {/* Remove */}
            <td className="px-2 py-1.5 text-center">
              <button
                onClick={() => removeItem(item.id)}
                className="text-red-300 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0.5"
              >
                <Trash2 size={12} />
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

// ─── Main section ────────────────────────────────────────────────────────────

export default function AfschrijvingenSection({ data, taxYear, onChange }: Props) {
  const rate = data.rentePercentage / 100;

  // Determine year range: 2 years back, up to max replacement year (or taxYear+8)
  const allReplYears = data.categorieen
    .flatMap(c => c.items)
    .map(it => getReplacementDate(it)?.getFullYear() ?? 0)
    .filter(y => y > 0);
  const minYear = taxYear - 2;
  const maxYear = allReplYears.length > 0
    ? Math.max(taxYear + 8, Math.max(...allReplYears))
    : taxYear + 8;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const addCategorie = () => {
    const newCat: AfschrijvingCategorie = {
      id: uid(), naam: 'Nieuwe categorie', items: [],
    };
    onChange({ ...data, categorieen: [...data.categorieen, newCat] });
  };

  const updateCat = (id: string, cat: AfschrijvingCategorie) =>
    onChange({ ...data, categorieen: data.categorieen.map(c => c.id === id ? cat : c) });

  const removeCat = (id: string) =>
    onChange({ ...data, categorieen: data.categorieen.filter(c => c.id !== id) });

  // Monthly savings summary for current year
  const allItems = data.categorieen.flatMap(c => c.items);
  const maandBedrag = allItems.reduce((s, it) => s + jaarDeposit(it, rate, taxYear), 0) / 12;

  return (
    <div className="space-y-4">
      {/* Settings bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Spaarrente (sinking fund)</label>
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 bg-white">
            <input
              type="number" step="0.1" min="0" max="20"
              value={data.rentePercentage}
              onChange={e => onChange({ ...data, rentePercentage: parseFloat(e.target.value) || 0 })}
              className="w-16 px-2 py-1.5 text-sm outline-none bg-white"
            />
            <span className="px-2 py-1.5 bg-slate-100 text-slate-500 text-sm border-l border-slate-300 select-none">%</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Maandelijks sparen ({taxYear})</p>
            <p className="text-base font-bold text-orange-700">{nl2.format(maandBedrag)}</p>
          </div>
          <button
            onClick={addCategorie}
            className="flex items-center gap-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg border-0 cursor-pointer"
          >
            <Plus size={13} /> Categorie
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 900 }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-2 py-2 font-medium text-slate-600">Product</th>
              <th className="text-left px-2 py-2 font-medium text-slate-600">Aankoopprijs</th>
              <th className="text-left px-2 py-2 font-medium text-slate-600">Aankoopdatum</th>
              <th className="text-left px-2 py-2 font-medium text-slate-600">Looptijd</th>
              <th className="text-left px-2 py-2 font-medium text-slate-600">Vervangingsdatum</th>
              <th className="text-right px-2 py-2 font-medium text-slate-600">Gereserveerd</th>
              {years.map(y => (
                <th
                  key={y}
                  className={`text-right px-2 py-2 font-medium whitespace-nowrap ${
                    y === taxYear
                      ? 'text-orange-600 bg-amber-50'
                      : y < taxYear
                        ? 'text-slate-400'
                        : 'text-slate-600'
                  }`}
                >
                  {y}
                </th>
              ))}
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>

          {data.categorieen.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={6 + years.length + 1} className="text-center py-10 text-slate-400 text-sm">
                  Geen categorieën. Voeg een categorie toe om te beginnen.
                </td>
              </tr>
            </tbody>
          ) : (
            data.categorieen.map(cat => (
              <CatRow
                key={cat.id}
                cat={cat}
                rate={rate}
                taxYear={taxYear}
                years={years}
                onUpdate={updated => updateCat(cat.id, updated)}
                onRemove={() => removeCat(cat.id)}
              />
            ))
          )}

          {/* Grand total row */}
          {data.categorieen.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={6} className="px-2 py-2 text-sm text-slate-700">Totaal per jaar</td>
                {years.map(y => {
                  const total = allItems.reduce((s, it) => s + jaarDeposit(it, rate, y), 0);
                  const isCurrent = y === taxYear;
                  return (
                    <td
                      key={y}
                      className={`text-right px-2 py-2 text-sm ${isCurrent ? 'text-orange-700 bg-amber-50' : 'text-slate-600'}`}
                    >
                      {total > 0 ? nl2.format(total) : ''}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-100" />Verleden (gespaard)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-100" />Huidig jaar</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-100" />Toekomstige jaren</span>
        <span className="ml-2">Sinking fund: gelijke jaarlijkse inleg om de inflatie-gecorrigeerde vervangingskosten te sparen o.b.v. spaarrente.</span>
      </div>
    </div>
  );
}
