import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AfschrijvingenData, AfschrijvingCategorie, AfschrijvingItem } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getReplacementDate,
  jaarDeposit,
  totalVervanging,
  gereserveerdTotNu,
} from '../utils/afschrijvingen';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: AfschrijvingenData;
  taxYear: number;
  onChange: (d: AfschrijvingenData) => void;
}

const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function uid() { return Math.random().toString(36).slice(2); }

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
      <tr className="bg-slate-100 dark:bg-slate-800 border-y border-slate-200 dark:border-slate-700">
        <td colSpan={6} className="px-2 py-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(o => !o)}
              className="text-slate-600 dark:text-slate-300 bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {editingName ? (
              <input
                autoFocus
                className="text-xs font-semibold bg-white dark:bg-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded px-2 py-0.5 outline-none"
                value={cat.naam}
                onChange={e => onUpdate({ ...cat, naam: e.target.value })}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              />
            ) : (
              <span
                className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:text-orange-600"
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
          <td key={y} className="px-2 py-1 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
            {catYearTotals[i] > 0 ? nl2.format(catYearTotals[i]) : ''}
          </td>
        ))}
        <td />
      </tr>

      {/* Item rows */}
      {open && cat.items.map(item => {
        const replDate  = getReplacementDate(item);
        const replYear  = replDate ? replDate.getFullYear() : null;
        const target    = item.aankoopprijs > 0 ? totalVervanging(item, rate) : 0;
        const reserved  = item.aankoopprijs > 0 ? gereserveerdTotNu(item, rate, taxYear) : 0;

        return (
          <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
            {/* Product name */}
            <td className="px-2 py-1.5 pl-6">
              <input
                className="w-full text-xs border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-slate-300 dark:focus:border-slate-500 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-transparent focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100"
                placeholder="Productnaam"
                value={item.naam}
                onChange={e => updateItem(item.id, { naam: e.target.value })}
              />
            </td>
            {/* Purchase price */}
            <td className="px-2 py-1.5">
              <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded overflow-hidden focus-within:ring-1 focus-within:ring-orange-400">
                <span className="px-1.5 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-400 text-xs border-r border-slate-200 dark:border-slate-600 select-none">€</span>
                <input
                  type="number" min={0} step={0.01}
                  className="w-24 text-xs px-2 py-1 outline-none bg-white dark:bg-slate-800 dark:text-slate-100"
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
                className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-white dark:bg-slate-800 dark:text-slate-100"
                value={item.aankoopdatum}
                onChange={e => updateItem(item.id, { aankoopdatum: e.target.value })}
              />
            </td>
            {/* Lifetime */}
            <td className="px-2 py-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1}
                  className="w-14 text-xs text-center border border-slate-200 dark:border-slate-600 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-white dark:bg-slate-800 dark:text-slate-100"
                  value={item.looptijdJaren || ''}
                  onChange={e => updateItem(item.id, { looptijdJaren: parseInt(e.target.value) || 1 })}
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">jr</span>
              </div>
            </td>
            {/* Replacement date */}
            <td className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {replDate
                ? replDate.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—'}
              {replYear !== null && replYear <= taxYear && (
                <span className="ml-1 text-red-500 font-semibold">!</span>
              )}
            </td>
            {/* Reserved so far / total target (sum of all year deposits) */}
            <td className="px-2 py-1.5 text-xs text-right">
              {item.aankoopprijs > 0 ? (
                <span className="text-slate-500 dark:text-slate-400">{nl0.format(reserved)} / {nl0.format(target)}</span>
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
  const { t } = useLanguage();
  const rate = data.rentePercentage / 100;

  // Determine year range: from earliest purchase year, up to max replacement year (or taxYear+8)
  const allPurchaseYears = data.categorieen
    .flatMap(c => c.items)
    .map(it => { const d = getReplacementDate(it); return d ? d.getFullYear() - it.looptijdJaren : 0; })
    .filter(y => y > 0);
  const allReplYears = data.categorieen
    .flatMap(c => c.items)
    .map(it => getReplacementDate(it)?.getFullYear() ?? 0)
    .filter(y => y > 0);
  const minYear = allPurchaseYears.length > 0
    ? Math.min(...allPurchaseYears)
    : taxYear - 2;
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
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap flex items-center gap-1">{t.depreciation.sectionTitle} <InfoTooltip tip="Reserveer maandelijks een bedrag voor toekomstige vervangingen (auto, witgoed, etc.). Dit bedrag wordt van uw Box 3 vermogen afgetrokken als 'gereserveerd'." /> · {t.depreciation.sinkingRate} <InfoTooltip tip={t.depreciation.sinkingRateHint} /></label>
          <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 bg-white dark:bg-slate-700">
            <input
              type="number" step="0.1" min="0" max="20"
              value={data.rentePercentage}
              onChange={e => onChange({ ...data, rentePercentage: parseFloat(e.target.value) || 0 })}
              className="w-16 px-2 py-1.5 text-sm outline-none bg-white dark:bg-slate-700 dark:text-slate-100"
            />
            <span className="px-2 py-1.5 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-sm border-l border-slate-300 dark:border-slate-600 select-none">%</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">Maandelijks sparen ({taxYear}) <InfoTooltip tip="Het bedrag dat u dit jaar moet reserveren om op tijd het vervangingsbedrag bij elkaar te hebben, rekening houdend met inflatie en rente-aangroei." /></p>
            <p className="text-base font-bold text-orange-700">{nl2.format(maandBedrag)}</p>
          </div>
          <button
            onClick={addCategorie}
            className="flex items-center gap-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg border-0 cursor-pointer"
          >
            <Plus size={13} /> {t.depreciation.addCategory}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 900 }}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <th className="text-left px-2 py-2 font-medium text-slate-600 dark:text-slate-300">{t.depreciation.product}</th>
              <th className="text-left px-2 py-2 font-medium text-slate-600 dark:text-slate-300"><span className="flex items-center gap-1">{t.depreciation.purchasePrice} <InfoTooltip tip="De aanschafprijs van het item dat u wilt vervangen. Dit is de huidige aankoopprijs, niet de oorspronkelijke prijs." /></span></th>
              <th className="text-left px-2 py-2 font-medium text-slate-600 dark:text-slate-300"><span className="flex items-center gap-1">{t.depreciation.purchaseDate} <InfoTooltip tip="De datum waarop u het item heeft aangeschaft. Hiermee berekenen we hoever u al in de afschrijvingsperiode zit." /></span></th>
              <th className="text-left px-2 py-2 font-medium text-slate-600 dark:text-slate-300"><span className="flex items-center gap-1">{t.depreciation.lifetimeYears} <InfoTooltip tip="Het aantal jaren dat u verwacht dit item te gebruiken voordat u het vervangt. Na deze periode begint een nieuwe afschrijvingscyclus." /></span></th>
              <th className="text-left px-2 py-2 font-medium text-slate-600 dark:text-slate-300">{t.depreciation.replacementDate}</th>
              <th className="text-right px-2 py-2 font-medium text-slate-600 dark:text-slate-300"><span className="flex items-center justify-end gap-1">{t.depreciation.reserved} <InfoTooltip tip="Het bedrag dat u tot nu toe heeft gereserveerd voor vervanging, als percentage van het totaal benodigde bedrag (inflatie gecorrigeerd)." /></span></th>
              {years.map(y => (
                <th
                  key={y}
                  className={`text-right px-2 py-2 font-medium whitespace-nowrap ${
                    y === taxYear
                      ? 'text-orange-600 bg-amber-50 dark:bg-amber-900/20'
                      : y < taxYear
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-300'
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
                <td colSpan={6 + years.length + 1} className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
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
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold">
                <td colSpan={6} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">Totaal per jaar</td>
                {years.map(y => {
                  const total = allItems.reduce((s, it) => s + jaarDeposit(it, rate, y), 0);
                  const isCurrent = y === taxYear;
                  return (
                    <td
                      key={y}
                      className={`text-right px-2 py-2 text-sm ${isCurrent ? 'text-orange-700 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-600 dark:text-slate-300'}`}
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
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 px-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-100 dark:bg-red-900/40" />Verleden (gespaard)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40" />Huidig jaar</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-100 dark:bg-green-900/40" />Toekomstige jaren</span>
        <span className="ml-2">Inflatie-geïndexeerde jaarinleg: basisbedrag (aankoopprijs ÷ looptijd) × (1 + rente)^jaar. Gereserveerd-doel = som van alle jaarinlagen.</span>
      </div>
    </div>
  );
}
