import { useState, useCallback } from 'react';
import { Plus, Trash2, Info, Gift } from 'lucide-react';
import type {
  SchenkingenData, SchenkingItem,
  SchenkingRelatie, SchenkingVrijstelling,
} from '../types';
import { berekenSchenking } from '../utils/taxCalculations';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: SchenkingenData;
  taxYear: number;
  onChange: (d: SchenkingenData) => void;
}

function uid() { return Math.random().toString(36).slice(2); }

const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nl0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const VRIJSTELLING_LABELS: Record<SchenkingVrijstelling, string> = {
  jaarlijks:       'Jaarlijkse vrijstelling',
  eenmalig_vrij:   'Eenmalig verhoogd (vrij besteedbaar)',
  eenmalig_studie: 'Eenmalig verhoogd (dure studie)',
  geen:            'Geen vrijstelling',
};

// Tarieven 2026
const TARIEVEN = {
  ouder:  [{ tot: 144948, pct: 10 }, { pct: 20 }],
  overig: [{ tot: 144948, pct: 18 }, { pct: 36 }],
};

export default function SchenkingenSection({ data, taxYear, onChange }: Props) {
  const [showTips, setShowTips] = useState(false);

  const addSchenking = useCallback(() => {
    const item: SchenkingItem = {
      id: uid(),
      omschrijving: '',
      bedrag: 0,
      relatie: 'ouder',
      vrijstelling: 'jaarlijks',
    };
    onChange({ ...data, schenkingen: [...data.schenkingen, item] });
  }, [data, onChange]);

  const updateItem = useCallback((id: string, patch: Partial<SchenkingItem>) => {
    onChange({
      ...data,
      schenkingen: data.schenkingen.map(s => s.id === id ? { ...s, ...patch } : s),
    });
  }, [data, onChange]);

  const removeItem = useCallback((id: string) => {
    onChange({ ...data, schenkingen: data.schenkingen.filter(s => s.id !== id) });
  }, [data, onChange]);

  const totals = data.schenkingen.map(s => berekenSchenking(s, taxYear));
  const totalBedrag     = totals.reduce((a, c) => a + c.bedrag,     0);
  const totalVrijgesteld = totals.reduce((a, c) => a + c.vrijgesteld, 0);
  const totalBelasting  = totals.reduce((a, c) => a + c.belasting,  0);
  const totalNetto      = totals.reduce((a, c) => a + c.netOntvangen, 0);

  return (
    <SectionCard title="Schenkingen" icon={<Gift size={16} />} accent="border-purple-400">
      <div className="space-y-4">

        {/* Tax info box */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 text-xs text-purple-800 dark:text-purple-200 space-y-2">
          <button
            className="flex items-center gap-2 font-semibold w-full text-left bg-transparent border-0 cursor-pointer p-0"
            onClick={() => setShowTips(v => !v)}
          >
            <Info size={14} />
            Schenkbelasting {taxYear} — regels &amp; tarieven
            <span className="ml-auto text-purple-500">{showTips ? '▲' : '▼'}</span>
          </button>
          {showTips && (
            <div className="space-y-2 pt-1">
              <p className="font-semibold">Vrijstellingen ({taxYear})</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-300 dark:border-purple-700">
                    <th className="text-left py-1 pr-3">Vrijstelling</th>
                    <th className="text-right py-1 pr-3">Ouder → kind</th>
                    <th className="text-right py-1">Overig</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-0.5 pr-3">Jaarlijks</td>
                    <td className="text-right pr-3">€ 6.908</td>
                    <td className="text-right">€ 2.784</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">Eenmalig vrij (18–40 jr)</td>
                    <td className="text-right pr-3">€ 33.241</td>
                    <td className="text-right text-purple-400">n.v.t.</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">Eenmalig studie (18–40 jr)</td>
                    <td className="text-right pr-3">€ 69.225</td>
                    <td className="text-right text-purple-400">n.v.t.</td>
                  </tr>
                </tbody>
              </table>
              <p className="font-semibold pt-1">Tarieven schenkbelasting</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-medium mb-0.5">Ouder → kind (tariefgroep I)</p>
                  {TARIEVEN.ouder.map((r, i) => (
                    <p key={i}>{r.tot ? `t/m ${nl0.format(r.tot)}` : 'daarboven'}: {r.pct}%</p>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-0.5">Overig (tariefgroep IA/II)</p>
                  {TARIEVEN.overig.map((r, i) => (
                    <p key={i}>{r.tot ? `t/m ${nl0.format(r.tot)}` : 'daarboven'}: {r.pct}%</p>
                  ))}
                </div>
              </div>
              <p className="text-purple-600 dark:text-purple-300 italic pt-1">
                Eenmalig vrijstellingen vervangen (niet optellen bij) de jaarlijkse vrijstelling.
                De jubelton (eigen woning) is per 2024 afgeschaft.
              </p>
            </div>
          )}
        </div>

        {/* Gift rows */}
        {data.schenkingen.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            Geen schenkingen toegevoegd.
          </div>
        ) : (
          <div className="space-y-3">
            {data.schenkingen.map((item, i) => {
              const calc = totals[i];
              return (
                <div key={item.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                  {/* Row 1: description + delete */}
                  <div className="flex items-center gap-3">
                    <input
                      className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-slate-100"
                      placeholder="Omschrijving (bijv. verjaardag, studie…)"
                      value={item.omschrijving}
                      onChange={e => updateItem(item.id, { omschrijving: e.target.value })}
                    />
                    <button onClick={() => removeItem(item.id)}
                      className="text-red-300 hover:text-red-500 bg-transparent border-0 cursor-pointer p-1">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Row 2: controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Bedrag */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Ontvangen bedrag</label>
                      <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-400">
                        <span className="px-2 bg-slate-50 dark:bg-slate-700 text-slate-400 text-sm border-r border-slate-200 dark:border-slate-600 select-none py-2">€</span>
                        <input type="number" min={0} step={100}
                          className="flex-1 text-sm px-2 py-2 outline-none bg-white dark:bg-slate-700 dark:text-slate-100"
                          value={item.bedrag || ''}
                          placeholder="0"
                          onChange={e => updateItem(item.id, { bedrag: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    {/* Relatie */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Van wie</label>
                      <select
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-slate-100"
                        value={item.relatie}
                        onChange={e => {
                          const relatie = e.target.value as SchenkingRelatie;
                          // reset vrijstelling when switching to overig (no eenmalig options)
                          const vrijstelling: SchenkingVrijstelling =
                            relatie === 'overig' && item.vrijstelling !== 'jaarlijks' && item.vrijstelling !== 'geen'
                              ? 'jaarlijks'
                              : item.vrijstelling;
                          updateItem(item.id, { relatie, vrijstelling });
                        }}
                      >
                        <option value="ouder">Ouder(s)</option>
                        <option value="overig">Overig (familie, derden)</option>
                      </select>
                    </div>

                    {/* Vrijstelling */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                        Vrijstelling
                        <InfoTooltip tip="De eenmalig verhoogde vrijstelling kan slechts één keer in uw leven worden gebruikt en vervangt (niet optelt bij) de jaarlijkse vrijstelling. U moet 18–40 jaar zijn." />
                      </label>
                      <select
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-slate-100"
                        value={item.vrijstelling}
                        onChange={e => updateItem(item.id, { vrijstelling: e.target.value as SchenkingVrijstelling })}
                      >
                        <option value="jaarlijks">{VRIJSTELLING_LABELS.jaarlijks}</option>
                        {item.relatie === 'ouder' && (
                          <>
                            <option value="eenmalig_vrij">{VRIJSTELLING_LABELS.eenmalig_vrij}</option>
                            <option value="eenmalig_studie">{VRIJSTELLING_LABELS.eenmalig_studie}</option>
                          </>
                        )}
                        <option value="geen">{VRIJSTELLING_LABELS.geen}</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: calculated breakdown */}
                  {item.bedrag > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Vrijgesteld</p>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">{nl2.format(calc.vrijgesteld)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Belastbaar</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{nl2.format(calc.belastbaar)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Schenkbelasting</p>
                        <p className="text-sm font-medium text-red-500">{nl2.format(calc.belasting)}</p>
                        {calc.effectiefTarief > 0 && (
                          <p className="text-xs text-slate-400">({(calc.effectiefTarief * 100).toFixed(1)}% eff.)</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Netto ontvangen</p>
                        <p className="text-sm font-bold text-purple-700 dark:text-purple-400">{nl2.format(calc.netOntvangen)}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add button */}
        <button onClick={addSchenking}
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 bg-transparent border border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-500 rounded-xl px-4 py-3 w-full cursor-pointer justify-center transition-colors">
          <Plus size={15} /> Schenking toevoegen
        </button>

        {/* Totals */}
        {data.schenkingen.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Totaal</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-slate-400">Ontvangen</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{nl2.format(totalBedrag)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vrijgesteld</p>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">{nl2.format(totalVrijgesteld)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Schenkbelasting</p>
                <p className="text-sm font-semibold text-red-500">{nl2.format(totalBelasting)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Netto ontvangen</p>
                <p className="text-base font-bold text-purple-700 dark:text-purple-400">{nl2.format(totalNetto)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
