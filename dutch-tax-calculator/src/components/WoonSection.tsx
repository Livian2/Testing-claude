import { useMemo } from 'react';
import { Home } from 'lucide-react';
import type { WoonData, HypotheekType, WoningType } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: WoonData;
  taxYear: number;
  onChange: (d: WoonData) => void;
}

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HYPOTHEEK_TYPES: { value: HypotheekType; label: string; desc: string }[] = [
  { value: 'annuiteit',      label: 'Annuïteit',       desc: 'Vaste maandlast, verschuivende rente/aflossing' },
  { value: 'lineair',        label: 'Lineair',          desc: 'Vaste aflossing, dalende maandlast' },
  { value: 'aflossingsvrijij', label: 'Aflossingsvrij', desc: 'Alleen rente, geen aflossing' },
];

export default function WoonSection({ data, taxYear, onChange }: Props) {
  const set = <K extends keyof WoonData>(key: K) => (val: WoonData[K]) =>
    onChange({ ...data, [key]: val });

  const setHyp = <K extends keyof WoonData['hypotheek']>(key: K) => (val: WoonData['hypotheek'][K]) =>
    onChange({ ...data, hypotheek: { ...data.hypotheek, [key]: val } });

  const setHypNum = (key: keyof WoonData['hypotheek']) => (v: number) =>
    onChange({ ...data, hypotheek: { ...data.hypotheek, [key]: v } });

  const hypBerekening = useMemo(() => {
    if (data.woningType !== 'hypotheek' || data.hypotheek.leningBedrag <= 0) return null;
    return berekenHypotheek(data.hypotheek, taxYear);
  }, [data.woningType, data.hypotheek, taxYear]);

  const maandWoonlast =
    data.woningType === 'huur'
      ? data.maandhuur
      : (hypBerekening?.maandlast ?? 0);

  const maandTotaal = maandWoonlast + data.gwe + data.vve + data.overig;

  return (
    <div className="space-y-4">
      {/* Woningtype */}
      <SectionCard title="Woonsituatie" icon={<Home size={20} />} accent="border-teal-400">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['huur', 'hypotheek'] as WoningType[]).map(t => (
              <button
                key={t}
                onClick={() => set('woningType')(t)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-colors cursor-pointer ${
                  data.woningType === t
                    ? 'border-teal-500 bg-teal-50 text-teal-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-semibold">{t === 'huur' ? 'Huurwoning' : 'Koopwoning'}</span>
                <span className="text-xs opacity-75">{t === 'huur' ? 'U huurt uw woning' : 'U heeft een eigen woning'}</span>
              </button>
            ))}
          </div>

          {/* ── Huur ── */}
          {data.woningType === 'huur' && (
            <div className="space-y-3">
              <CurrencyInput
                label="Maandhuur"
                hint="Uw maandelijkse kale huur (voor huurtoeslag-berekening)"
                value={data.maandhuur}
                onChange={v => onChange({ ...data, maandhuur: v })}
              />
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-teal-800">
                Huurtoeslag wordt automatisch berekend bij lage inkomens (max. huurgrens ≈ €900/maand).
              </div>
            </div>
          )}

          {/* ── Hypotheek ── */}
          {data.woningType === 'hypotheek' && (
            <div className="space-y-4">
              {/* Type selector */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Type hypotheek</p>
                <div className="grid grid-cols-3 gap-2">
                  {HYPOTHEEK_TYPES.map(ht => (
                    <button
                      key={ht.value}
                      onClick={() => setHyp('type')(ht.value)}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-colors cursor-pointer ${
                        data.hypotheek.type === ht.value
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-semibold">{ht.label}</span>
                      <span className="text-xs opacity-70 leading-tight">{ht.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hypotheek inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Leningbedrag"
                  hint="Oorspronkelijke hoofdsom hypotheek"
                  value={data.hypotheek.leningBedrag}
                  onChange={setHypNum('leningBedrag')}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Rentepercentage</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.01"
                      value={data.hypotheek.rentePercentage || ''}
                      onChange={e => setHypNum('rentePercentage')(parseFloat(e.target.value) || 0)}
                      placeholder="bijv. 3.75"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Rentevaste periode</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      value={data.hypotheek.rentevastePeriode || ''}
                      onChange={e => setHypNum('rentevastePeriode')(parseInt(e.target.value) || 0)}
                      placeholder="bijv. 10"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">jaar</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Looptijd lening</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="40"
                      step="1"
                      value={data.hypotheek.looptijd || ''}
                      onChange={e => setHypNum('looptijd')(parseInt(e.target.value) || 0)}
                      placeholder="bijv. 30"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">jaar</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Startjaar hypotheek</label>
                  <input
                    type="number"
                    min="1990"
                    max="2040"
                    step="1"
                    value={data.hypotheek.startJaar || ''}
                    onChange={e => setHypNum('startJaar')(parseInt(e.target.value) || taxYear)}
                    placeholder={String(taxYear)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Computed results */}
              {hypBerekening && data.hypotheek.leningBedrag > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Berekening {taxYear}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-blue-600 mb-0.5">Maandlast</p>
                      <p className="text-sm font-bold text-blue-900">{nl2.format(hypBerekening.maandlast)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-blue-600 mb-0.5">Jaarrente</p>
                      <p className="text-sm font-bold text-blue-900">{nl.format(hypBerekening.jaarRente)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-blue-600 mb-0.5">Restschuld begin</p>
                      <p className="text-sm font-bold text-blue-900">{nl.format(hypBerekening.restschuldBegin)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-blue-600 mb-0.5">Restschuld eind</p>
                      <p className="text-sm font-bold text-blue-900">{nl.format(hypBerekening.restschuldEind)}</p>
                    </div>
                  </div>
                  <div className="border-t border-blue-200 pt-2 text-xs text-blue-700">
                    Jaarrente van <strong>{nl.format(hypBerekening.jaarRente)}</strong> wordt automatisch als Box 1 aftrekpost meegenomen.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Overige woonkosten */}
      <SectionCard title="Overige woonlasten — per maand" icon={<Home size={20} />} accent="border-orange-400">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CurrencyInput
            label="Gas, water & elektra"
            hint="Maandelijkse energiekosten"
            value={data.gwe}
            onChange={v => onChange({ ...data, gwe: v })}
          />
          <CurrencyInput
            label="VVE bijdrage"
            hint="Maandelijkse VVE-bijdrage (indien van toepassing)"
            value={data.vve}
            onChange={v => onChange({ ...data, vve: v })}
          />
          <CurrencyInput
            label="Overige woonkosten"
            hint="Onderhoud, gemeentelijke heffingen, etc."
            value={data.overig}
            onChange={v => onChange({ ...data, overig: v })}
          />
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100 space-y-1">
            <p className="text-xs text-slate-500">Totale woonlast per maand</p>
            <p className="text-base font-bold text-orange-700">{nl.format(maandTotaal)}</p>
          </div>
          <div className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100 space-y-1">
            <p className="text-xs text-slate-500">Totale woonlast per jaar</p>
            <p className="text-base font-bold text-orange-800">{nl.format(maandTotaal * 12)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
