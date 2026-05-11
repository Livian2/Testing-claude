import { CalendarDays, Plus, Trash2, Landmark, PiggyBank, Wallet } from 'lucide-react';
import type { WaardesData, BeleggingRekening, SpaarRekening, BetaalRekening, AssetType } from '../types';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: WaardesData;
  onChange: (d: WaardesData) => void;
}

function uid() { return Math.random().toString(36).slice(2); }

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'etf',        label: 'ETF / Indexfonds' },
  { value: 'stocks',     label: 'Aandelen' },
  { value: 'bonds',      label: 'Obligaties' },
  { value: 'realEstate', label: 'Vastgoed' },
  { value: 'crypto',     label: 'Crypto' },
  { value: 'other',      label: 'Overig' },
];

// ── Section: Beleggingen ──────────────────────────────────────────────────

function BeleggingenSection({ data, onChange }: Props) {
  const add = () => onChange({
    ...data,
    beleggingen: [...data.beleggingen, { id: uid(), naam: '', broker: '', type: 'etf', waardeJan1: 0 }],
  });
  const remove = (id: string) => onChange({ ...data, beleggingen: data.beleggingen.filter(b => b.id !== id) });
  const update = (id: string, p: Partial<BeleggingRekening>) =>
    onChange({ ...data, beleggingen: data.beleggingen.map(b => b.id === id ? { ...b, ...p } : b) });

  // Group by broker for the summary
  const byBroker = data.beleggingen.reduce((acc, b) => {
    const key = b.broker || 'Onbekend';
    acc[key] = (acc[key] ?? 0) + b.waardeJan1;
    return acc;
  }, {} as Record<string, number>);

  const total = data.beleggingen.reduce((s, b) => s + b.waardeJan1, 0);

  return (
    <SectionCard title={<span className="flex items-center gap-1.5">Beleggingsrekeningen <InfoTooltip tip="Voer de waarde in van uw beleggingsportefeuille op 1 januari. ETF's en aandelen vallen onder de 'beleggingen' categorie (fictief rendement 5,88%)." /></span>} icon={<Landmark size={20} />} accent="border-purple-400">
      <p className="text-xs text-slate-500 mb-4">
        Waarde van uw beleggingen op <strong>1 januari</strong> — dit is de Box 3 grondslag.
        Voer in per broker / rekening.
      </p>

      {data.beleggingen.length === 0 ? (
        <div className="text-center py-5 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl mb-3">
          Nog geen beleggingsrekeningen toegevoegd
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {data.beleggingen.map(b => (
            <div key={b.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Naam / omschrijving</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="bijv. VWCE portfolio"
                  value={b.naam}
                  onChange={e => update(b.id, { naam: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Broker</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="DEGIRO"
                  value={b.broker}
                  onChange={e => update(b.id, { broker: e.target.value })}
                />
              </div>
              <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Type</label>
                <select
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400"
                  value={b.type}
                  onChange={e => update(b.id, { type: e.target.value as AssetType })}
                >
                  {ASSET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-span-11 sm:col-span-4">
                <CurrencyInput label="Waarde 1 januari" value={b.waardeJan1}
                  onChange={v => update(b.id, { waardeJan1: v })}
                  tooltip={<InfoTooltip tip="De waarde van deze rekening/portefeuille op exactement 1 januari van het belastingjaar." />}
                />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-0.5">
                <button onClick={() => remove(b.id)}
                  className="text-red-400 hover:text-red-600 p-1 bg-transparent border-0 cursor-pointer">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={add}
        className="flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 cursor-pointer border-0 mb-4">
        <Plus size={13} /> Beleggingsrekening toevoegen
      </button>

      {total > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">Totaal beleggingen</span>
            <span className="text-base font-bold text-purple-700">{nl.format(total)}</span>
          </div>
          {Object.entries(byBroker).length > 1 && (
            <div className="space-y-1 pt-1 border-t border-purple-200">
              {Object.entries(byBroker).map(([broker, val]) => (
                <div key={broker} className="flex justify-between text-xs text-slate-600">
                  <span>{broker}</span>
                  <span className="font-medium">{nl.format(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Section: Spaarrekeningen ──────────────────────────────────────────────

function SpaarSection({ data, onChange }: Props) {
  const add = () => onChange({
    ...data,
    spaarrekeningen: [...data.spaarrekeningen, { id: uid(), naam: '', instelling: '', saldoJan1: 0, rentePercentage: 0 }],
  });
  const remove = (id: string) => onChange({ ...data, spaarrekeningen: data.spaarrekeningen.filter(s => s.id !== id) });
  const update = (id: string, p: Partial<SpaarRekening>) =>
    onChange({ ...data, spaarrekeningen: data.spaarrekeningen.map(s => s.id === id ? { ...s, ...p } : s) });

  const totalSaldo    = data.spaarrekeningen.reduce((s, a) => s + a.saldoJan1, 0);
  const totalRente    = data.spaarrekeningen.reduce((s, a) => s + a.saldoJan1 * (a.rentePercentage / 100), 0);

  return (
    <SectionCard title={<span className="flex items-center gap-1.5">Spaarrekeningen <InfoTooltip tip="Spaargeld valt in Box 3 onder de 'spaargeld' categorie met een lager fictief rendement (1,03% in 2026)." /></span>} icon={<PiggyBank size={20} />} accent="border-green-400">
      <p className="text-xs text-slate-500 mb-4">
        Saldo op <strong>1 januari</strong>. Fictief rendement 2026: <strong>1,03%</strong> (ongeacht werkelijke rente).
      </p>

      {data.spaarrekeningen.length === 0 ? (
        <div className="text-center py-5 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl mb-3">
          Nog geen spaarrekeningen toegevoegd
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {data.spaarrekeningen.map(s => (
            <div key={s.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Naam rekening</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="bijv. ING Spaarrekening"
                  value={s.naam}
                  onChange={e => update(s.id, { naam: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Bank / instelling</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="ING"
                  value={s.instelling}
                  onChange={e => update(s.id, { instelling: e.target.value })}
                />
              </div>
              <div className="col-span-5 sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-slate-500 flex items-center gap-1">Rente % <InfoTooltip tip="Het jaarlijkse rentepercentage dat u ontvangt op deze spaarrekening. Dit wordt gebruikt voor de daadwerkelijke rente-inkomsten berekening." /></label>
                <div className="relative">
                  <input type="number" min="0" max="20" step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm bg-white outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="0.00"
                    value={s.rentePercentage || ''}
                    onChange={e => update(s.id, { rentePercentage: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                </div>
                {s.saldoJan1 > 0 && s.rentePercentage > 0 && (
                  <p className="text-xs text-green-600 font-medium">≈ {nl.format(s.saldoJan1 * s.rentePercentage / 100)}/jr</p>
                )}
              </div>
              <div className="col-span-11 sm:col-span-4">
                <CurrencyInput label="Saldo 1 januari" value={s.saldoJan1}
                  onChange={v => update(s.id, { saldoJan1: v })}
                  tooltip={<InfoTooltip tip="De waarde van deze rekening/portefeuille op exactement 1 januari van het belastingjaar." />}
                />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-0.5">
                <button onClick={() => remove(s.id)}
                  className="text-red-400 hover:text-red-600 p-1 bg-transparent border-0 cursor-pointer">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={add}
        className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 cursor-pointer border-0 mb-4">
        <Plus size={13} /> Spaarrekening toevoegen
      </button>

      {totalSaldo > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-100">
            <p className="text-xs text-slate-500 mb-1">Totaal saldo (Box 3)</p>
            <p className="text-base font-bold text-green-700">{nl.format(totalSaldo)}</p>
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3 border border-green-100">
            <p className="text-xs text-slate-500 mb-1">Werkelijke rente-opbrengst</p>
            <p className="text-base font-bold text-green-700">{nl.format(totalRente)}</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Section: Betaalrekeningen ─────────────────────────────────────────────

function BetaalSection({ data, onChange }: Props) {
  const add = () => onChange({
    ...data,
    betaalrekeningen: [...data.betaalrekeningen, { id: uid(), naam: '', instelling: '', saldoJan1: 0 }],
  });
  const remove = (id: string) => onChange({ ...data, betaalrekeningen: data.betaalrekeningen.filter(b => b.id !== id) });
  const update = (id: string, p: Partial<BetaalRekening>) =>
    onChange({ ...data, betaalrekeningen: data.betaalrekeningen.map(b => b.id === id ? { ...b, ...p } : b) });

  const total = data.betaalrekeningen.reduce((s, b) => s + b.saldoJan1, 0);

  return (
    <SectionCard title={<span className="flex items-center gap-1.5">Betaalrekeningen <InfoTooltip tip="Het saldo op uw betaalrekening op 1 januari telt ook mee voor Box 3. Houd er rekening mee dat dit inclusief evt. buffer is." /></span>} icon={<Wallet size={20} />} accent="border-sky-400">
      <p className="text-xs text-slate-500 mb-4">
        Saldo betaalrekening(en) op <strong>1 januari</strong> — telt mee als spaartegoed in Box 3 (fictief rendement 1,03%).
      </p>

      {data.betaalrekeningen.length === 0 ? (
        <div className="text-center py-5 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl mb-3">
          Nog geen betaalrekeningen toegevoegd
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {data.betaalrekeningen.map(b => (
            <div key={b.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Naam rekening</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="bijv. ABN AMRO betaalrekening"
                  value={b.naam}
                  onChange={e => update(b.id, { naam: e.target.value })}
                />
              </div>
              <div className="col-span-5 sm:col-span-3 flex flex-col gap-1">
                <label className="text-xs text-slate-500">Bank / instelling</label>
                <input
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="ABN AMRO"
                  value={b.instelling}
                  onChange={e => update(b.id, { instelling: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-5">
                <CurrencyInput label="Saldo 1 januari" value={b.saldoJan1}
                  onChange={v => update(b.id, { saldoJan1: v })}
                  tooltip={<InfoTooltip tip="De waarde van deze rekening/portefeuille op exactement 1 januari van het belastingjaar." />}
                />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-0.5">
                <button onClick={() => remove(b.id)}
                  className="text-red-400 hover:text-red-600 p-1 bg-transparent border-0 cursor-pointer">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={add}
        className="flex items-center gap-1.5 text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-700 cursor-pointer border-0 mb-4">
        <Plus size={13} /> Betaalrekening toevoegen
      </button>

      {total > 0 && (
        <div className="bg-sky-50 rounded-xl px-4 py-3 border border-sky-100">
          <p className="text-xs text-slate-500 mb-1">Totaal betaalrekeningen (Box 3)</p>
          <p className="text-base font-bold text-sky-700">{nl.format(total)}</p>
        </div>
      )}
    </SectionCard>
  );
}

// ── Box 3 summary ─────────────────────────────────────────────────────────

function Box3Summary({ data }: { data: WaardesData }) {
  const totalBeleggingen = data.beleggingen.reduce((s, b) => s + b.waardeJan1, 0);
  const totalSpaar       = data.spaarrekeningen.reduce((s, a) => s + a.saldoJan1, 0);
  const totalBetaal      = data.betaalrekeningen.reduce((s, a) => s + a.saldoJan1, 0);
  const grandTotal       = totalBeleggingen + totalSpaar + totalBetaal;
  if (grandTotal === 0) return null;

  const rows = [
    { label: 'Beleggingen',    val: totalBeleggingen, color: 'bg-purple-400' },
    { label: 'Spaarrekeningen', val: totalSpaar,      color: 'bg-green-400' },
    { label: 'Betaalrekeningen', val: totalBetaal,    color: 'bg-sky-400' },
  ].filter(r => r.val > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <CalendarDays size={16} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">Totaal Box 3 vermogen (1 jan) <InfoTooltip tip="De Belastingdienst gebruikt de waarde van uw vermogen op 1 januari van het belastingjaar als grondslag voor Box 3. Dit heet de peildatum." /></span>
        <span className="ml-auto text-lg font-bold text-slate-900">{nl.format(grandTotal)}</span>
      </div>
      {/* Bar visualisation */}
      <div className="h-3 rounded-full overflow-hidden flex gap-px bg-slate-100">
        {rows.map(r => (
          <div
            key={r.label}
            className={`h-full ${r.color} transition-all duration-500`}
            style={{ width: `${(r.val / grandTotal) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
            <span>{r.label}</span>
            <span className="font-semibold text-slate-800">{nl.format(r.val)}</span>
            <span className="text-slate-400">({nl2.format((r.val / grandTotal) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function WaardesSection({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Box3Summary data={data} />
      <BeleggingenSection data={data} onChange={onChange} />
      <SpaarSection data={data} onChange={onChange} />
      <BetaalSection data={data} onChange={onChange} />
    </div>
  );
}
