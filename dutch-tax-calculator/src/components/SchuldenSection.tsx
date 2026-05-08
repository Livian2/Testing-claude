import { useState } from 'react';
import { CreditCard, Plus, Trash2, ChevronDown, ChevronRight, GraduationCap, TrendingDown, BookOpen } from 'lucide-react';
import type { SchuldenData, SchuldItem, DuoType } from '../types';
import { simuleerDuo, berekenDuoJaarbetaling, DUO_DRAAGKRACHT_VRIJ, DUO_DRAAGKRACHT_PARTNER_VRIJ } from '../utils/duo';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';

interface Props {
  data: SchuldenData;
  taxYear: number;
  grossSalary: number;
  isPartner?: boolean;
  onChange: (d: SchuldenData) => void;
}

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function uid() { return Math.random().toString(36).slice(2); }

const DEFAULT_SCHULD: Omit<SchuldItem, 'id' | 'label'> = {
  bedrag: 0, rentePercentage: 0, looptijd: 15, rentevastePeriode: 5, startJaar: 2020,
};

interface SchuldCardProps {
  item: SchuldItem;
  taxYear: number;
  onUpdate: (p: Partial<SchuldItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
  accent: string;
  isDuo?: boolean;
}

function SchuldCard({ item, taxYear, onUpdate, onRemove, canRemove, accent, isDuo }: SchuldCardProps) {
  const [open, setOpen] = useState(true);

  const jaarRente      = item.bedrag * (item.rentePercentage / 100);
  const maandRente     = jaarRente / 12;
  const eindeVast      = item.startJaar + item.rentevastePeriode;
  const eindeLooptijd  = item.startJaar + item.looptijd;
  const jarenResterend = Math.max(0, eindeLooptijd - taxYear);

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${accent}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white bg-opacity-60">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800 bg-transparent border-0 cursor-pointer p-0"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {item.label || 'Schuld'}
          {item.bedrag > 0 && (
            <span className="text-xs font-normal text-slate-500 ml-1">{nl.format(item.bedrag)}</span>
          )}
        </button>
        {canRemove && (
          <button onClick={onRemove}
            className="text-red-400 hover:text-red-600 bg-transparent border-0 cursor-pointer p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Naam / omschrijving</label>
              <input
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="bijv. DUO studieschuld"
                value={item.label}
                onChange={e => onUpdate({ label: e.target.value })}
              />
            </div>
            <CurrencyInput
              label="Restschuld"
              hint={isDuo ? 'Saldo bij start aflossing (aflossingsStartJaar)' : 'Uitstaand saldo op 1 januari'}
              value={item.bedrag}
              onChange={v => onUpdate({ bedrag: v })}
            />
          </div>

          {isDuo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* SF15 / SF35 selector */}
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-500">Stelsel</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  {([
                    { value: 'sf15' as DuoType, label: 'SF15', desc: 'Oud stelsel (vóór sept. 2015) · 15 jaar' },
                    { value: 'sf35' as DuoType, label: 'SF35', desc: 'Nieuw stelsel (vanaf sept. 2015) · 35 jaar' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      title={opt.desc}
                      onClick={() => {
                        const looptijd = opt.value === 'sf15' ? 15 : 35;
                        onUpdate({ duoType: opt.value, looptijd });
                      }}
                      className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-colors border-0 cursor-pointer ${
                        (item.duoType ?? 'sf35') === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  {(item.duoType ?? 'sf35') === 'sf15'
                    ? 'Oud stelsel: looptijd 15 jaar (studenten vóór september 2015)'
                    : 'Nieuw stelsel: looptijd 35 jaar (studenten vanaf september 2015)'}
                </p>
              </div>

              {/* Grace period */}
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-500">Aflossing start (jr) <span className="text-slate-400 font-normal">— optioneel (grace period)</span></label>
                <input
                  type="number" min={1990} max={2100}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={String(item.startJaar)}
                  value={item.aflossingsStartJaar || ''}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    onUpdate({ aflossingsStartJaar: isNaN(v) ? undefined : v });
                  }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Rente (%)</label>
              <input
                type="number" min={0} max={20} step={0.01}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="2.5"
                value={item.rentePercentage || ''}
                onChange={e => onUpdate({ rentePercentage: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Looptijd (jr)</label>
              <input
                type="number" min={1} max={50}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="15"
                value={item.looptijd || ''}
                onChange={e => onUpdate({ looptijd: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Rentevaste periode (jr)</label>
              <input
                type="number" min={1} max={30}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="5"
                value={item.rentevastePeriode || ''}
                onChange={e => onUpdate({ rentevastePeriode: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Startjaar</label>
              <input
                type="number" min={1990} max={2050}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-red-400"
                placeholder="2020"
                value={item.startJaar || ''}
                onChange={e => onUpdate({ startJaar: parseInt(e.target.value) || 2020 })}
              />
            </div>
          </div>

          {/* Summary */}
          {item.bedrag > 0 && item.rentePercentage > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Jaarlijkse rente</p>
                <p className="font-bold text-red-800">{nl2.format(jaarRente)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Maandelijkse rente</p>
                <p className="font-bold text-red-700">{nl2.format(maandRente)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Rente vast t/m</p>
                <p className="font-bold text-slate-700">{eindeVast}</p>
                <p className="text-xs text-slate-400">{Math.max(0, eindeVast - taxYear)} jaar resterend</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Aflossing voltooid</p>
                <p className="font-bold text-slate-700">{eindeLooptijd}</p>
                <p className="text-xs text-slate-400">{jarenResterend} jaar resterend</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DebtGroupProps {
  title: string;
  icon: React.ReactNode;
  items: SchuldItem[];
  taxYear: number;
  accent: string;
  buttonColor: string;
  isDuo?: boolean;
  onAdd: (duoType?: DuoType) => void;
  onUpdate: (id: string, p: Partial<SchuldItem>) => void;
  onRemove: (id: string) => void;
}

function DebtGroup({ title, icon, items, taxYear, accent, buttonColor, isDuo, onAdd, onUpdate, onRemove }: DebtGroupProps) {
  const totaal = items.reduce((s, d) => s + d.bedrag, 0);
  const totaalRente = items.reduce((s, d) => s + d.bedrag * (d.rentePercentage / 100), 0);

  return (
    <SectionCard title={title} icon={icon} accent={accent}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-5 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
            Geen schulden toegevoegd
          </div>
        ) : (
          items.map(item => (
            <SchuldCard
              key={item.id}
              item={item}
              taxYear={taxYear}
              accent="border-red-100"
              isDuo={isDuo}
              onUpdate={p => onUpdate(item.id, p)}
              onRemove={() => onRemove(item.id)}
              canRemove={true}
            />
          ))
        )}

        {isDuo ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAdd('sf15')}
              className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
            >
              <Plus size={13} /> SF15 toevoegen
            </button>
            <button
              onClick={() => onAdd('sf35')}
              className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
            >
              <Plus size={13} /> SF35 toevoegen
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAdd()}
            className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 ${buttonColor}`}
          >
            <Plus size={13} /> Schuld toevoegen
          </button>
        )}

        {items.length > 0 && totaal > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <p className="text-xs text-slate-500">Totale restschuld (Box 3)</p>
              <p className="text-base font-bold text-red-800">{nl.format(totaal)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <p className="text-xs text-slate-500">Totale jaarlijkse rente</p>
              <p className="text-base font-bold text-red-700">{nl2.format(totaalRente)}</p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── DUO Simulation Card ──────────────────────────────────────────────────────

const W = 520, H = 120, PAD = { t: 8, r: 12, b: 28, l: 52 };

function DuoSimulatieCard({
  duo, taxYear, grossSalary, isPartner,
}: { duo: SchuldItem[]; taxYear: number; grossSalary: number; isPartner: boolean }) {
  const [inkomensstijging, setInkomensstijging] = useState(2);

  const drempel = isPartner ? DUO_DRAAGKRACHT_PARTNER_VRIJ : DUO_DRAAGKRACHT_VRIJ;
  const maandBetaling = berekenDuoJaarbetaling(grossSalary, isPartner) / 12;

  // Simulate each DUO item and combine into yearly totals
  const simulations = duo.filter(d => d.bedrag > 0).map(d =>
    simuleerDuo(d, grossSalary, inkomensstijging / 100, taxYear, isPartner)
  );

  // Chart starts at the earliest repayment start year (skip pre-repayment flat period)
  const minAflossStart = duo.reduce((min, d) => {
    const s = d.aflossingsStartJaar ?? d.startJaar;
    return s < min ? s : min;
  }, Infinity as number);
  const chartStart = isFinite(minAflossStart) ? Math.max(taxYear, minAflossStart) : taxYear;

  // maxJaren must cover up to the latest write-off year
  const maxAflossEind = duo.reduce((max, d) => {
    const s = d.aflossingsStartJaar ?? d.startJaar;
    return Math.max(max, s + d.looptijd);
  }, 0);
  const maxJaren = Math.max(maxAflossEind - chartStart + 3, 40);

  const combined: { jaar: number; balans: number }[] = [];
  for (let i = 0; i <= maxJaren; i++) {
    const jaar = chartStart + i;
    const totaalBalans = simulations.reduce((sum, sim) => {
      const pt = sim.punten.find(p => p.jaar === jaar);
      return sum + (pt ? pt.balans : 0);
    }, 0);
    combined.push({ jaar, balans: totaalBalans });
    if (totaalBalans === 0 && i > 0) break;
  }

  const totalStartDebt    = duo.reduce((s, d) => s + d.bedrag, 0);
  const totalKwijtschelding = simulations.reduce((s, sim) => s + sim.kwijtscheldingsBedrag, 0);
  const totalBetaald      = simulations.reduce((s, sim) => s + sim.betaaldTotaal, 0);
  const earliestAfgelost  = simulations.reduce<number | null>((best, sim) => {
    if (!sim.afgelosdJaar) return best;
    return best === null ? sim.afgelosdJaar : Math.max(best, sim.afgelosdJaar);
  }, null);
  const allAfgelost = simulations.every(s => s.afgelosdJaar !== null);

  // SVG chart
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const nPts = combined.length;
  const maxBal = totalStartDebt || 1;
  const xS = (i: number) => PAD.l + (i / Math.max(nPts - 1, 1)) * iW;
  const yS = (v: number) => PAD.t + iH - Math.min(1, v / maxBal) * iH;
  const path = combined.map((p, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(p.balans).toFixed(1)}`).join(' ');
  const area = `${path} L${xS(nPts - 1).toFixed(1)},${PAD.t + iH} L${xS(0).toFixed(1)},${PAD.t + iH} Z`;
  const xTicks = combined.filter((_, i) => i % 5 === 0 || i === nPts - 1);

  const noIncome = grossSalary <= drempel;

  return (
    <SectionCard title="DUO aflossing — simulatie op basis van inkomen" icon={<BookOpen size={20} />} accent="border-blue-400">
      <div className="space-y-4">
        {/* Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500">Bruto-inkomen (huidig)</p>
            <p className="text-base font-bold text-blue-800">{nl.format(grossSalary)}<span className="text-xs font-normal text-slate-400">/jr</span></p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500">DUO-betaling nu</p>
            <p className="text-base font-bold text-blue-700">
              {noIncome ? <span className="text-slate-400 text-sm">€0 — inkomen onder drempel</span> : <>{nl.format(maandBetaling)}<span className="text-xs font-normal text-slate-400">/mnd</span></>}
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-1 col-span-2">
            <label className="text-xs text-slate-500">Verwachte inkomensstijging/jr</label>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-400">
              <input
                type="number" step="0.5" min="0" max="15"
                value={inkomensstijging}
                onChange={e => setInkomensstijging(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white min-w-0"
              />
              <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm border-l border-slate-300 select-none">%</span>
            </div>
          </div>
        </div>

        {/* Rule explanation */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 space-y-1">
          <p>
            <span className="font-semibold text-slate-700">DUO-betalingsregel 2026: </span>
            4% van inkomen boven de draagkrachtvrije voet van <strong>{nl.format(drempel)}</strong>/jr
            {isPartner ? ' (fiscaal partner)' : ' (alleenstaand)'}.
            Restschuld wordt na de looptijd kwijtgescholden.
          </p>
          {duo.some(d => d.duoType === 'sf15') && (
            <p><span className="inline-block bg-blue-100 text-blue-700 font-semibold rounded px-1 mr-1">SF15</span>Oud stelsel · looptijd 15 jaar (studenten vóór september 2015)</p>
          )}
          {duo.some(d => !d.duoType || d.duoType === 'sf35') && (
            <p><span className="inline-block bg-indigo-100 text-indigo-700 font-semibold rounded px-1 mr-1">SF35</span>Nieuw stelsel · looptijd 35 jaar (studenten vanaf september 2015)</p>
          )}
        </div>

        {/* Chart */}
        {nPts > 1 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Verloop DUO-restschuld</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 140 }}>
              <defs>
                <linearGradient id="duo-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#duo-grad)" />
              <path d={path} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
              {/* current year marker */}
              <line x1={xS(0)} y1={PAD.t} x2={xS(0)} y2={PAD.t + iH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 2" />
              {xTicks.map((p, i) => (
                <text key={i} x={xS(combined.indexOf(p))} y={H - PAD.b + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{p.jaar}</text>
              ))}
              {[0, 0.5, 1].map(f => (
                <g key={f}>
                  <line x1={PAD.l} y1={yS(maxBal * f)} x2={PAD.l + iW} y2={yS(maxBal * f)} stroke="#f1f5f9" strokeWidth={1} />
                  <text x={PAD.l - 4} y={yS(maxBal * f) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
                    {f === 0 ? '0' : f === 1 ? nl.format(maxBal) : nl.format(maxBal * f)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500">Startschuld</p>
            <p className="font-bold text-slate-800">{nl.format(totalStartDebt)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500">Totaal betaald</p>
            <p className="font-bold text-blue-700">{nl.format(Math.round(totalBetaald))}</p>
          </div>
          <div className={`border rounded-xl px-3 py-2.5 ${totalKwijtschelding > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
            <p className="text-xs text-slate-500">{totalKwijtschelding > 0 ? 'Kwijtschelding' : 'Afgelost'}</p>
            <p className={`font-bold ${totalKwijtschelding > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {totalKwijtschelding > 0 ? nl.format(Math.round(totalKwijtschelding)) : (allAfgelost && earliestAfgelost ? String(earliestAfgelost) : '—')}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-500">{allAfgelost ? 'Afgelost in' : 'Kwijtschelding in'}</p>
            <p className="font-bold text-slate-700">
              {allAfgelost && earliestAfgelost
                ? `${earliestAfgelost} (${earliestAfgelost - taxYear} jr)`
                : duo.map(d => `${(d.aflossingsStartJaar ?? d.startJaar) + d.looptijd}`).join(', ')}
            </p>
          </div>
        </div>

        {noIncome && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Uw inkomen ({nl.format(grossSalary)}) ligt onder de draagkrachtvrije voet ({nl.format(drempel)}).
            U betaalt momenteel niets aan DUO. Pas uw inkomen aan op het Inkomen-tabblad om de simulatie te zien.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

export default function SchuldenSection({ data, taxYear, grossSalary, isPartner, onChange }: Props) {
  const totalDebts = [...data.duo, ...data.beleggingen].reduce((s, d) => s + d.bedrag, 0);
  const totalRente = [...data.duo, ...data.beleggingen].reduce((s, d) => s + d.bedrag * (d.rentePercentage / 100), 0);
  const box3Debts  = Math.max(0, totalDebts - 3700);

  return (
    <div className="space-y-4">
      <DebtGroup
        title="DUO studieschuld"
        icon={<GraduationCap size={20} />}
        items={data.duo}
        taxYear={taxYear}
        accent="border-blue-400"
        buttonColor="bg-blue-600 hover:bg-blue-700"
        isDuo={true}
        onAdd={(duoType = 'sf35') => onChange({
          ...data,
          duo: [...data.duo, {
            ...DEFAULT_SCHULD,
            id: uid(),
            label: `DUO schuld ${data.duo.length + 1} (${duoType.toUpperCase()})`,
            rentePercentage: 2.56,
            looptijd: duoType === 'sf15' ? 15 : 35,
            duoType,
          }],
        })}
        onUpdate={(id, p) => onChange({ ...data, duo: data.duo.map(d => d.id === id ? { ...d, ...p } : d) })}
        onRemove={id => onChange({ ...data, duo: data.duo.filter(d => d.id !== id) })}
      />

      <DebtGroup
        title="Beleggingsschulden"
        icon={<TrendingDown size={20} />}
        items={data.beleggingen}
        taxYear={taxYear}
        accent="border-orange-400"
        buttonColor="bg-orange-600 hover:bg-orange-700"
        onAdd={() => onChange({
          ...data,
          beleggingen: [...data.beleggingen, {
            ...DEFAULT_SCHULD,
            id: uid(),
            label: `Beleggingsschuld ${data.beleggingen.length + 1}`,
          }],
        })}
        onUpdate={(id, p) => onChange({ ...data, beleggingen: data.beleggingen.map(d => d.id === id ? { ...d, ...p } : d) })}
        onRemove={id => onChange({ ...data, beleggingen: data.beleggingen.filter(d => d.id !== id) })}
      />

      {/* DUO aflossing simulatie */}
      {data.duo.length > 0 && data.duo.some(d => d.bedrag > 0) && (
        <DuoSimulatieCard
          duo={data.duo}
          taxYear={taxYear}
          grossSalary={grossSalary}
          isPartner={isPartner ?? false}
        />
      )}

      {/* Box 3 summary */}
      {totalDebts > 0 && (
        <SectionCard title="Schulden samenvatting — Box 3" icon={<CreditCard size={20} />} accent="border-red-400">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Totale schulden</p>
              <p className="text-base font-bold text-slate-800">{nl.format(totalDebts)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Drempel Box 3</p>
              <p className="text-base font-bold text-slate-500">– {nl.format(3700)}</p>
            </div>
            <div className="bg-red-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Aftrekbaar Box 3</p>
              <p className="text-base font-bold text-red-700">{nl.format(box3Debts)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Totale jaarrente</p>
              <p className="text-base font-bold text-orange-700">{nl2.format(totalRente)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Schulden verlagen uw Box 3 vermogen. De eerste €3.700 per persoon is niet aftrekbaar (drempel).
            Fictief rendement op schulden: <strong>2,62%</strong> (2026).
          </p>
        </SectionCard>
      )}
    </div>
  );
}
