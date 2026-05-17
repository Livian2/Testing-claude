import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AfschrijvingenData, AfschrijvingCategorie, AfschrijvingItem } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { parseAfschrijvingDate } from '../utils/afschrijvingen';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: AfschrijvingenData;
  taxYear: number;
  onChange: (d: AfschrijvingenData) => void;
}

const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function uid() { return Math.random().toString(36).slice(2); }

interface ItemComputed {
  replDate: Date | null;
  replYear: number | null;
  deposits: Float64Array;
  reserved: number;
  target: number;
}

function calcDeposit(
  purchaseMs: number, replaceMs: number,
  aankoopprijs: number, looptijdJaren: number,
  rate: number, purchaseYear: number,
  L3ms: number, M3ms: number, year: number,
): number {
  if (M3ms <= purchaseMs) return 0;
  const baseDaily = aankoopprijs / (looptijdJaren * 365);
  const daysMD    = (M3ms - purchaseMs) / 86400000;
  if (daysMD < 364) return daysMD * baseDaily * (1 + rate);
  if (M3ms <= replaceMs) {
    const daysLM       = (M3ms - L3ms) / 86400000;
    const yearsElapsed = (year + 1) - purchaseYear;
    return daysLM * baseDaily * Math.pow(1 + rate, yearsElapsed);
  }
  const daysMJ = (M3ms - replaceMs) / 86400000;
  return daysMJ < 364 ? (365 - daysMJ) * baseDaily * (1 + rate) : 0;
}

// Shared row-height class — identical on both panels so rows align
const ROW_CAT  = 'border-y border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800';
const ROW_ITEM = 'border-b border-slate-100 dark:border-slate-700';

export default function AfschrijvingenSection({ data, taxYear, onChange }: Props) {
  const { t } = useLanguage();

  // Open/editing state — hoisted to parent so both panels stay in sync
  const [openCats,    setOpenCats]    = useState<Set<string>>(() => new Set(data.categorieen.map(c => c.id)));
  const [editingCat,  setEditingCat]  = useState<string | null>(null);

  const toggleOpen = useCallback((id: string) =>
    setOpenCats(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }), []);

  // ── Data mutation helpers ──────────────────────────────────────────────────
  const updateCat = useCallback((updated: AfschrijvingCategorie) =>
    onChange({ ...data, categorieen: data.categorieen.map(c => c.id === updated.id ? updated : c) }),
  [data, onChange]);

  const removeCat = useCallback((id: string) =>
    onChange({ ...data, categorieen: data.categorieen.filter(c => c.id !== id) }),
  [data, onChange]);

  const addCategorie = useCallback(() => {
    const cat: AfschrijvingCategorie = { id: uid(), naam: t.depreciation.defaultCategory, items: [] };
    const s = new Set(openCats); s.add(cat.id);
    setOpenCats(s);
    onChange({ ...data, categorieen: [...data.categorieen, cat] });
  }, [data, onChange, openCats, t]);

  const addItem = useCallback((catId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const item: AfschrijvingItem = { id: uid(), naam: '', aankoopprijs: 0, aankoopdatum: today, looptijdJaren: 3 };
    onChange({ ...data, categorieen: data.categorieen.map(c =>
      c.id === catId ? { ...c, items: [...c.items, item] } : c
    )});
  }, [data, onChange]);

  const updateItem = useCallback((catId: string, itemId: string, patch: Partial<AfschrijvingItem>) =>
    onChange({ ...data, categorieen: data.categorieen.map(c =>
      c.id === catId ? { ...c, items: c.items.map(it => it.id === itemId ? { ...it, ...patch } : it) } : c
    )}),
  [data, onChange]);

  const removeItem = useCallback((catId: string, itemId: string) =>
    onChange({ ...data, categorieen: data.categorieen.map(c =>
      c.id === catId ? { ...c, items: c.items.filter(it => it.id !== itemId) } : c
    )}),
  [data, onChange]);

  // ── Deferred computation (keeps typing responsive) ─────────────────────────
  const deferred     = useDeferredValue(data);
  const deferredYear = useDeferredValue(taxYear);
  const isStale      = deferred !== data || deferredYear !== taxYear;
  const deferredRate = deferred.rentePercentage / 100;

  const years = useMemo<number[]>(() => {
    let minYear = deferredYear - 2, maxYear = deferredYear + 8;
    for (const cat of deferred.categorieen) {
      for (const it of cat.items) {
        if (it.enabled === false) continue;
        const p = parseAfschrijvingDate(it.aankoopdatum);
        if (!p) continue;
        const py = p.getFullYear(), ry = py + (it.looptijdJaren || 0);
        if (py < minYear) minYear = py;
        if (ry > maxYear) maxYear = ry;
      }
    }
    const arr: number[] = [];
    for (let y = minYear; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [deferred.categorieen, deferredYear]);

  const yearBounds = useMemo(
    () => years.map(y => ({ L3ms: Date.UTC(y, 0, 1), M3ms: Date.UTC(y + 1, 0, 1) })),
    [years],
  );

  const { itemComputed, catDeposits, yearTotals, maandBedrag } = useMemo(() => {
    const itemComputed = new Map<string, ItemComputed>();
    const catDeposits  = new Map<string, Float64Array>();
    const yearTotals   = new Float64Array(years.length);
    const zero = () => new Float64Array(years.length);

    for (const cat of deferred.categorieen) {
      const catDeps = new Float64Array(years.length);

      for (const item of cat.items) {
        if (item.enabled === false) {
          const p = parseAfschrijvingDate(item.aankoopdatum);
          const rd = p ? (() => { const d = new Date(p); d.setFullYear(d.getFullYear() + item.looptijdJaren); return d; })() : null;
          itemComputed.set(item.id, { replDate: rd, replYear: rd?.getFullYear() ?? null, deposits: zero(), reserved: 0, target: 0 });
          continue;
        }
        if (!item.aankoopprijs || !item.looptijdJaren || !item.aankoopdatum) {
          itemComputed.set(item.id, { replDate: null, replYear: null, deposits: zero(), reserved: 0, target: 0 });
          continue;
        }
        const purchase = parseAfschrijvingDate(item.aankoopdatum);
        if (!purchase) { itemComputed.set(item.id, { replDate: null, replYear: null, deposits: zero(), reserved: 0, target: 0 }); continue; }

        const replDate   = new Date(purchase);
        replDate.setFullYear(replDate.getFullYear() + item.looptijdJaren);
        const replYear   = replDate.getFullYear();
        const purchaseMs = purchase.getTime();
        const replaceMs  = replDate.getTime();
        const purchaseYr = purchase.getFullYear();
        const deposits   = new Float64Array(years.length);
        let reserved = 0, target = 0;

        for (let i = 0; i < years.length; i++) {
          const { L3ms, M3ms } = yearBounds[i];
          const dep = calcDeposit(purchaseMs, replaceMs, item.aankoopprijs, item.looptijdJaren, deferredRate, purchaseYr, L3ms, M3ms, years[i]);
          deposits[i] = dep; catDeps[i] += dep; yearTotals[i] += dep; target += dep;
          if (years[i] <= deferredYear) reserved += dep;
        }
        itemComputed.set(item.id, { replDate, replYear, deposits, reserved, target });
      }
      catDeposits.set(cat.id, catDeps);
    }

    const idx = years.indexOf(deferredYear);
    return { itemComputed, catDeposits, yearTotals, maandBedrag: idx >= 0 ? yearTotals[idx] / 12 : 0 };
  }, [deferred.categorieen, deferredRate, years, yearBounds, deferredYear]);

  // ── Shared cell classnames ─────────────────────────────────────────────────
  const thFixed = 'text-left px-2 py-2 font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 whitespace-nowrap';
  const tdItem  = 'px-2 py-1.5 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700';
  const tdCat   = 'px-2 py-1 bg-slate-100 dark:bg-slate-800';
  const tdFoot  = 'px-2 py-2 bg-slate-50 dark:bg-slate-900';

  return (
    <div className="space-y-4">
      {/* Settings bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap flex items-center gap-1">
            {t.depreciation.sectionTitle} <InfoTooltip tip={t.depreciationExtra.sinkingFundTip} /> · {t.depreciation.sinkingRate} <InfoTooltip tip={t.depreciation.sinkingRateHint} />
          </label>
          <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 bg-white dark:bg-slate-700">
            <input type="number" step="0.1" min="0" max="20"
              value={data.rentePercentage}
              onChange={e => onChange({ ...data, rentePercentage: parseFloat(e.target.value) || 0 })}
              className="w-16 px-2 py-1.5 text-sm outline-none bg-white dark:bg-slate-700 dark:text-slate-100"
            />
            <span className="px-2 py-1.5 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm border-l border-slate-300 dark:border-slate-600 select-none">%</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
              {t.depreciationExtra.monthlySavingYear} ({taxYear}) <InfoTooltip tip={t.depreciationExtra.sinkingFundTip} />
            </p>
            <p className="text-base font-bold text-orange-700">{nl2.format(maandBedrag)}</p>
          </div>
          <button onClick={addCategorie}
            className="flex items-center gap-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg border-0 cursor-pointer">
            <Plus size={13} /> {t.depreciation.addCategory}
          </button>
        </div>
      </div>

      {/* ── Two-panel table: fixed left + scrollable right ── */}
      <div className={`flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-opacity duration-150 ${isStale ? 'opacity-60' : ''}`}>

        {/* ── Fixed left panel (never scrolls) ── */}
        <div className="flex-shrink-0 z-10" style={{ boxShadow: '3px 0 8px -3px rgba(0,0,0,0.12)' }}>
          <table className="border-collapse text-xs h-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className={thFixed} style={{ minWidth: 160 }}>{t.depreciation.product}</th>
                <th className={thFixed} style={{ minWidth: 130 }}>
                  <span className="flex items-center gap-1">{t.depreciation.purchasePrice} <InfoTooltip tip={t.depreciation.purchasePriceTip} /></span>
                </th>
                <th className={thFixed} style={{ minWidth: 122 }}>
                  <span className="flex items-center gap-1">{t.depreciation.purchaseDate} <InfoTooltip tip={t.depreciation.purchaseDateTip} /></span>
                </th>
                <th className={thFixed} style={{ minWidth: 78 }}>
                  <span className="flex items-center gap-1">{t.depreciation.lifetimeYears} <InfoTooltip tip={t.depreciation.lifetimeTip} /></span>
                </th>
                <th className={thFixed} style={{ minWidth: 128 }}>{t.depreciation.replacementDate}</th>
                <th className={`${thFixed} text-right`} style={{ minWidth: 115 }}>
                  <span className="flex items-center justify-end gap-1">{t.depreciation.reserved} <InfoTooltip tip={t.depreciation.reservedTip} /></span>
                </th>
                <th className="w-8 bg-slate-50 dark:bg-slate-900" />
              </tr>
            </thead>

            {data.categorieen.length === 0 ? (
              <tbody>
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">{t.depreciation.noCategories}</td></tr>
              </tbody>
            ) : data.categorieen.map(cat => {
              const isOpen = openCats.has(cat.id);
              return (
                <tbody key={cat.id}>
                  {/* Category header */}
                  <tr className={ROW_CAT}>
                    <td colSpan={7} className={tdCat}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleOpen(cat.id)}
                          className="text-slate-600 dark:text-slate-300 bg-transparent border-0 cursor-pointer p-0 flex items-center">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        {editingCat === cat.id ? (
                          <input autoFocus
                            className="text-xs font-semibold bg-white dark:bg-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded px-2 py-0.5 outline-none"
                            value={cat.naam}
                            onChange={e => updateCat({ ...cat, naam: e.target.value })}
                            onBlur={() => setEditingCat(null)}
                            onKeyDown={e => e.key === 'Enter' && setEditingCat(null)}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:text-orange-600"
                            onClick={() => setEditingCat(cat.id)}>
                            {cat.naam || t.depreciationExtra.defaultCategoryName}
                          </span>
                        )}
                        <button onClick={() => addItem(cat.id)}
                          className="ml-2 flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 bg-transparent border-0 cursor-pointer p-0">
                          <Plus size={12} /> {t.depreciationExtra.addProductLabel}
                        </button>
                        <button onClick={() => removeCat(cat.id)}
                          className="ml-auto text-red-300 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Item rows */}
                  {isOpen && cat.items.map(item => {
                    const comp    = itemComputed.get(item.id);
                    const replDate = comp?.replDate ?? null;
                    const replYear = comp?.replYear ?? null;
                    const reserved = comp?.reserved ?? 0;
                    const target   = comp?.target   ?? 0;
                    const active   = item.enabled !== false;
                    return (
                      <tr key={item.id} className={`${ROW_ITEM} group ${active ? '' : 'opacity-40'}`}>
                        {/* Product + checkbox */}
                        <td className={`${tdItem} pl-3 pr-2 py-1.5`}>
                          <div className="flex items-center gap-1.5">
                            <input type="checkbox" checked={active}
                              onChange={e => updateItem(cat.id, item.id, { enabled: e.target.checked })}
                              className="w-3.5 h-3.5 accent-orange-500 cursor-pointer flex-shrink-0"
                            />
                            <input
                              className="w-full text-xs border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-slate-300 dark:focus:border-slate-500 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-transparent focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100"
                              placeholder={t.depreciation.productPlaceholder}
                              value={item.naam}
                              onChange={e => updateItem(cat.id, item.id, { naam: e.target.value })}
                            />
                          </div>
                        </td>
                        {/* Purchase price */}
                        <td className={`${tdItem} px-2 py-1.5`}>
                          <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded overflow-hidden focus-within:ring-1 focus-within:ring-orange-400">
                            <span className="px-1.5 bg-slate-50 dark:bg-slate-700 text-slate-400 text-xs border-r border-slate-200 dark:border-slate-600 select-none">€</span>
                            <input type="number" min={0} step={0.01}
                              className="w-20 text-xs px-2 py-1 outline-none bg-white dark:bg-slate-800 dark:text-slate-100"
                              placeholder="0,00"
                              value={item.aankoopprijs || ''}
                              onChange={e => updateItem(cat.id, item.id, { aankoopprijs: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </td>
                        {/* Purchase date */}
                        <td className={`${tdItem} px-2 py-1.5`}>
                          <input type="date"
                            className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-white dark:bg-slate-800 dark:text-slate-100"
                            value={item.aankoopdatum}
                            onChange={e => updateItem(cat.id, item.id, { aankoopdatum: e.target.value })}
                          />
                        </td>
                        {/* Lifetime */}
                        <td className={`${tdItem} px-2 py-1.5`}>
                          <div className="flex items-center gap-1">
                            <input type="number" min={1}
                              className="w-12 text-xs text-center border border-slate-200 dark:border-slate-600 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-white dark:bg-slate-800 dark:text-slate-100"
                              value={item.looptijdJaren || ''}
                              onChange={e => updateItem(cat.id, item.id, { looptijdJaren: parseInt(e.target.value) || 1 })}
                            />
                            <span className="text-xs text-slate-400 dark:text-slate-500">jr</span>
                          </div>
                        </td>
                        {/* Replacement date */}
                        <td className={`${tdItem} px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
                          {replDate ? replDate.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          {replYear !== null && replYear <= taxYear && <span className="ml-1 text-red-500 font-semibold">!</span>}
                        </td>
                        {/* Reserved / target */}
                        <td className={`${tdItem} px-2 py-1.5 text-xs text-right`}>
                          {item.aankoopprijs > 0
                            ? <span className="text-slate-500 dark:text-slate-400">{nl0.format(reserved)} / {nl0.format(target)}</span>
                            : '—'}
                        </td>
                        {/* Delete */}
                        <td className={`${tdItem} px-2 py-1.5 text-center`}>
                          <button onClick={() => removeItem(cat.id, item.id)}
                            className="text-red-300 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0.5">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}

            {data.categorieen.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
                  <td colSpan={6} className={`${tdFoot} text-sm text-slate-700 dark:text-slate-200`}>{t.depreciation.totalPerYear}</td>
                  <td className={tdFoot} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Scrollable right panel (year columns) ── */}
        <div className="overflow-x-auto flex-1">
          <table className="border-collapse text-xs h-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                {years.map(y => (
                  <th key={y} className={`text-right px-2 py-2 font-medium whitespace-nowrap ${
                    y === taxYear   ? 'text-orange-600 bg-amber-50 dark:bg-amber-900/20'
                    : y < taxYear   ? 'text-slate-400 dark:text-slate-500'
                    :                 'text-slate-600 dark:text-slate-300'
                  }`}>{y}</th>
                ))}
              </tr>
            </thead>

            {data.categorieen.length === 0 ? (
              <tbody><tr><td colSpan={years.length} className="py-10" /></tr></tbody>
            ) : data.categorieen.map(cat => {
              const isOpen  = openCats.has(cat.id);
              const catDeps = catDeposits.get(cat.id) ?? new Float64Array(years.length);
              return (
                <tbody key={cat.id}>
                  {/* Category header — year totals */}
                  <tr className={ROW_CAT}>
                    {years.map((y, i) => (
                      <td key={y} className="px-2 py-1 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
                        {(catDeps[i] ?? 0) > 0 ? nl2.format(catDeps[i]) : ''}
                      </td>
                    ))}
                  </tr>

                  {/* Item rows — year deposit cells */}
                  {isOpen && cat.items.map(item => {
                    const comp    = itemComputed.get(item.id);
                    const replYear = comp?.replYear ?? null;
                    const deposits = comp?.deposits;
                    const active   = item.enabled !== false;
                    return (
                      <tr key={item.id} className={`${ROW_ITEM} group ${active ? '' : 'opacity-40'}`}>
                        {years.map((y, i) => {
                          const dep       = deposits?.[i] ?? 0;
                          const isOverdue = replYear !== null && y > replYear;
                          const isPast    = y < taxYear;
                          const isCurrent = y === taxYear;
                          let bg = '', textColor = 'text-slate-300';
                          if (dep > 0 && !isOverdue) {
                            if (isPast)         { bg = 'bg-red-50 dark:bg-red-900/10';   textColor = 'text-red-500'; }
                            else if (isCurrent) { bg = 'bg-amber-50 dark:bg-amber-900/20'; textColor = 'text-amber-700 font-semibold'; }
                            else                { bg = 'bg-green-50 dark:bg-green-900/10'; textColor = 'text-green-700'; }
                          }
                          return (
                            <td key={y} className={`px-2 py-1.5 text-right text-xs ${bg} ${textColor}`}>
                              {dep > 0 && !isOverdue ? nl2.format(dep) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}

            {data.categorieen.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
                  {Array.from(yearTotals).map((total, i) => {
                    const isCurrent = years[i] === taxYear;
                    return (
                      <td key={years[i]} className={`text-right px-2 py-2 text-sm bg-slate-50 dark:bg-slate-900 ${isCurrent ? 'text-orange-700 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-600 dark:text-slate-300'}`}>
                        {total > 0 ? nl2.format(total) : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 px-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-100 dark:bg-red-900/40" />{t.depreciationExtra.legendPast}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40" />{t.depreciationExtra.legendCurrent}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-100 dark:bg-green-900/40" />{t.depreciationExtra.legendFuture}</span>
        <span className="ml-2">{t.depreciationExtra.legendNote}</span>
      </div>
    </div>
  );
}
