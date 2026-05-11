import { useMemo, useState } from 'react';
import { Home, Plus, Trash2, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import type { WoonData, HypotheekData, HypotheekType, WoningType } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import CurrencyInput from './CurrencyInput';
import SectionCard from './SectionCard';
import InfoTooltip from './InfoTooltip';

interface Props {
  data: WoonData;
  taxYear: number;
  onChange: (d: WoonData) => void;
}

function uid() { return Math.random().toString(36).slice(2); }

const nl  = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nl2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HYPOTHEEK_TYPES: { value: HypotheekType; label: string; desc: string; tip: string }[] = [
  { value: 'annuiteit',        label: 'Annuïteit',     desc: 'Vaste maandlast',   tip: 'Vaste maandlast gedurende de hele looptijd. Aan het begin betaalt u vooral rente, aan het einde vooral aflossing.' },
  { value: 'lineair',          label: 'Lineair',        desc: 'Dalende maandlast', tip: 'Elke maand lost u een vast bedrag af. De rente daalt elk jaar, dus uw maandlast wordt steeds lager.' },
  { value: 'aflossingsvrijij', label: 'Aflossingsvrij', desc: 'Alleen rente',      tip: 'U betaalt alleen rente, u lost niets af. De schuld blijft gelijk. Let op: u heeft geen recht op hypotheekrenteaftrek bij nieuw afgesloten aflossingsvrije hypotheken.' },
];

const DEFAULT_HYP: Omit<HypotheekData, 'id' | 'label'> = {
  type: 'annuiteit', leningBedrag: 0, rentePercentage: 0,
  rentevastePeriode: 10, looptijd: 30, startJaar: new Date().getFullYear(),
};

// ── Amortisation SVG chart ──────────────────────────────────────────────────

function MortgageChart({ hyp, taxYear }: { hyp: HypotheekData; taxYear: number }) {
  const W = 520; const H = 140; const PAD = { t: 10, r: 10, b: 28, l: 48 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const data = useMemo(() => {
    const pts: { year: number; balance: number; interest: number; principal: number }[] = [];
    if (hyp.leningBedrag <= 0 || hyp.looptijd <= 0) return pts;
    for (let yr = 0; yr <= hyp.looptijd; yr++) {
      const absYear = hyp.startJaar + yr;
      const b = berekenHypotheek({ ...hyp, startJaar: hyp.startJaar }, absYear);
      // balance at start of this year
      const balStart = berekenHypotheek({ ...hyp }, absYear).restschuldBegin;
      pts.push({ year: absYear, balance: balStart, interest: b.jaarRente, principal: b.jaarAflossing });
    }
    return pts;
  }, [hyp]);

  if (data.length < 2) return null;

  const maxBal  = hyp.leningBedrag;
  const years   = data.length;

  const xScale = (i: number) => PAD.l + (i / (years - 1)) * iW;
  const yBal   = (v: number) => PAD.t + iH - (v / maxBal) * iH;

  // Balance area path
  const balancePts = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yBal(d.balance)}`).join(' ');
  const areaPath   = `${balancePts} L${xScale(years - 1)},${PAD.t + iH} L${xScale(0)},${PAD.t + iH} Z`;

  // Current year marker
  const currentIdx = data.findIndex(d => d.year === taxYear);

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: f * maxBal, y: PAD.t + iH - f * iH }));
  // X-axis ticks (every 5 years)
  const xTicks = data.filter(d => (d.year - hyp.startJaar) % 5 === 0);

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
        <BarChart2 size={12} />Verloop restschuld
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 160 }}>
        <defs>
          <linearGradient id={`bg-${hyp.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.l - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
              {t.val >= 1000 ? `${Math.round(t.val / 1000)}k` : Math.round(t.val)}
            </text>
          </g>
        ))}

        {/* Area */}
        <path d={areaPath} fill={`url(#bg-${hyp.id})`} />

        {/* Balance line */}
        <polyline
          points={data.map((d, i) => `${xScale(i)},${yBal(d.balance)}`).join(' ')}
          fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round"
        />

        {/* Current year marker */}
        {currentIdx >= 0 && (
          <g>
            <line x1={xScale(currentIdx)} y1={PAD.t} x2={xScale(currentIdx)} y2={PAD.t + iH}
              stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2" />
            <circle cx={xScale(currentIdx)} cy={yBal(data[currentIdx].balance)} r="4"
              fill="#f97316" stroke="white" strokeWidth="1.5" />
          </g>
        )}

        {/* X-axis labels */}
        {xTicks.map((d, i) => {
          const idx = data.findIndex(p => p.year === d.year);
          return (
            <text key={i} x={xScale(idx)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {d.year}
            </text>
          );
        })}

        {/* Axes */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + iH} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD.l} y1={PAD.t + iH} x2={W - PAD.r} y2={PAD.t + iH} stroke="#cbd5e1" strokeWidth="1" />
      </svg>
    </div>
  );
}

// ── Single hypotheek editor ─────────────────────────────────────────────────

function HypotheekCard({
  hyp, taxYear, onUpdate, onRemove, canRemove,
}: {
  hyp: HypotheekData; taxYear: number;
  onUpdate: (p: Partial<HypotheekData>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(true);

  const berekening = useMemo(() => {
    if (hyp.leningBedrag <= 0 || hyp.rentePercentage <= 0 || hyp.looptijd <= 0) return null;
    return berekenHypotheek(hyp, taxYear);
  }, [hyp, taxYear]);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 bg-transparent border-0 cursor-pointer text-left"
        >
          {open ? <ChevronDown size={15} className="text-orange-500" /> : <ChevronRight size={15} className="text-slate-400 dark:text-slate-500" />}
          <span>{hyp.label || 'Hypotheek'}</span>
          {berekening && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-normal">
              {nl2.format(berekening.maandlast)}/mnd · rente {nl.format(berekening.jaarRente)}/jr
            </span>
          )}
        </button>
        {canRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1 bg-transparent border-0 cursor-pointer">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="p-4 space-y-4 bg-white dark:bg-slate-800">
          {/* Label */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Naam / omschrijving</label>
            <input
              className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-700 dark:text-slate-100"
              placeholder="bijv. Eerste hypotheek"
              value={hyp.label}
              onChange={e => onUpdate({ label: e.target.value })}
            />
          </div>

          {/* Type */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Type hypotheek</p>
            <div className="grid grid-cols-3 gap-2">
              {HYPOTHEEK_TYPES.map(ht => (
                <button
                  key={ht.value}
                  onClick={() => onUpdate({ type: ht.value })}
                  className={`flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border-2 text-center transition-colors cursor-pointer ${
                    hyp.type === ht.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <span className="text-xs font-semibold flex items-center gap-1">{ht.label} <InfoTooltip tip={ht.tip} /></span>
                  <span className="text-xs opacity-70">{ht.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencyInput
              label="Leningbedrag"
              hint="Oorspronkelijke hoofdsom"
              value={hyp.leningBedrag}
              onChange={v => onUpdate({ leningBedrag: v })}
              tooltip={<InfoTooltip tip="Het oorspronkelijk geleende bedrag van de hypotheek." />}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">Rentepercentage <InfoTooltip tip="Het jaarlijkse rentepercentage dat u betaalt over de hypotheekschuld." /></label>
              <div className="relative">
                <input type="number" min="0" max="20" step="0.01" value={hyp.rentePercentage || ''}
                  onChange={e => onUpdate({ rentePercentage: parseFloat(e.target.value) || 0 })}
                  placeholder="3.75"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-700 dark:text-slate-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">Rentevaste periode <InfoTooltip tip="Het aantal jaren dat uw rente vaststaat. Na deze periode wordt de rente opnieuw vastgesteld op basis van de marktrente." /></label>
              <div className="relative">
                <input type="number" min="1" max="30" step="1" value={hyp.rentevastePeriode || ''}
                  onChange={e => onUpdate({ rentevastePeriode: parseInt(e.target.value) || 0 })}
                  placeholder="10"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-700 dark:text-slate-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">jaar</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">Looptijd lening <InfoTooltip tip="De totale duur van de hypotheek in jaren. Standaard is 30 jaar." /></label>
              <div className="relative">
                <input type="number" min="1" max="40" step="1" value={hyp.looptijd || ''}
                  onChange={e => onUpdate({ looptijd: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-700 dark:text-slate-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">jaar</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Startjaar hypotheek</label>
              <input type="number" min="1990" max="2040" step="1" value={hyp.startJaar || ''}
                onChange={e => onUpdate({ startJaar: parseInt(e.target.value) || taxYear })}
                placeholder={String(taxYear)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <CurrencyInput
              label="Extra aflossing per maand"
              hint="Wordt op de 15de van elke maand betaald (optioneel)"
              value={hyp.extraAflossingMaandelijks ?? 0}
              onChange={v => onUpdate({ extraAflossingMaandelijks: v > 0 ? v : undefined })}
              suffix="/mnd"
              tooltip={<InfoTooltip tip="Een extra bedrag dat u bovenop uw normale maandlast aflost. Dit versnelt de aflossing en bespaart rentekosten." />}
            />
          </div>

          {/* Computed results */}
          {berekening && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Berekening {taxYear}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Maandlast',      val: nl2.format(berekening.maandlast) },
                  { label: 'Jaarrente',       val: nl.format(berekening.jaarRente) },
                  { label: 'Restschuld begin', val: nl.format(berekening.restschuldBegin) },
                  { label: 'Restschuld eind',  val: nl.format(berekening.restschuldEind) },
                ].map(r => (
                  <div key={r.label} className="text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">{r.label}</p>
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{r.val}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 border-t border-blue-200 dark:border-blue-800 pt-2">
                Jaarrente van <strong>{nl.format(berekening.jaarRente)}</strong> wordt automatisch als Box 1 aftrekpost meegenomen.
              </p>
              {hyp.leningBedrag > 0 && hyp.looptijd > 0 && (
                <MortgageChart hyp={hyp} taxYear={taxYear} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function WoonSection({ data, taxYear, onChange }: Props) {
  const addHypotheek = () => {
    const newHyp: HypotheekData = {
      ...DEFAULT_HYP, id: uid(), label: `Hypotheek ${data.hypotheken.length + 1}`,
      startJaar: taxYear,
    };
    onChange({ ...data, hypotheken: [...data.hypotheken, newHyp] });
  };

  const updateHyp = (id: string, patch: Partial<HypotheekData>) =>
    onChange({ ...data, hypotheken: data.hypotheken.map(h => h.id === id ? { ...h, ...patch } : h) });

  const removeHyp = (id: string) =>
    onChange({ ...data, hypotheken: data.hypotheken.filter(h => h.id !== id) });

  const totalMaandlast = data.hypotheken.reduce((s, h) => {
    if (h.leningBedrag <= 0) return s;
    try { return s + berekenHypotheek(h, taxYear).maandlast; } catch { return s; }
  }, 0);

  const maandTotaal = (data.woningType === 'huur' ? data.maandhuur : totalMaandlast) + data.gwe + data.vve + data.overig;

  return (
    <div className="space-y-4">
      {/* Woningtype */}
      <SectionCard title={<span className="flex items-center gap-1.5">Woonsituatie <InfoTooltip tip="Kies 'Huur' als u een huurwoning heeft. Kies 'Hypotheek' als u een eigen woning bezit met een lening." /></span>} icon={<Home size={20} />} accent="border-teal-400">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['huur', 'hypotheek'] as WoningType[]).map(t => (
              <button key={t} onClick={() => onChange({ ...data, woningType: t })}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-colors cursor-pointer ${
                  data.woningType === t
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <span className="text-sm font-semibold">{t === 'huur' ? 'Huurwoning' : 'Koopwoning'}</span>
                <span className="text-xs opacity-75">{t === 'huur' ? 'U huurt uw woning' : 'U heeft een eigen woning'}</span>
              </button>
            ))}
          </div>

          {data.woningType === 'huur' && (
            <div className="space-y-3">
              <CurrencyInput label="Maandhuur" hint="Uw maandelijkse kale huur"
                value={data.maandhuur} onChange={v => onChange({ ...data, maandhuur: v })}
                tooltip={<InfoTooltip tip="De kale huurprijs per maand zonder servicekosten of gas/water/licht." />}
              />
              <label className="flex items-center gap-2.5 cursor-pointer select-none py-2 px-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-teal-600"
                  checked={data.huurtoeslagEnabled !== false}
                  onChange={e => onChange({ ...data, huurtoeslagEnabled: e.target.checked })}
                />
                <span className="text-sm text-teal-800 dark:text-teal-300 font-medium flex items-center gap-1">Huurtoeslag aanvragen <InfoTooltip tip="Huurtoeslag is een maandelijkse bijdrage van de overheid als uw huur en inkomen niet te hoog zijn. U heeft recht op huurtoeslag als uw huur onder de liberalisatiegrens (€900/mnd) ligt." /></span>
                <span className="text-xs text-teal-600 dark:text-teal-400 ml-1">— wordt automatisch berekend bij lage inkomens</span>
              </label>
            </div>
          )}

          {data.woningType === 'hypotheek' && (
            <div className="space-y-3">
              {data.hypotheken.map(h => (
                <HypotheekCard
                  key={h.id} hyp={h} taxYear={taxYear}
                  onUpdate={p => updateHyp(h.id, p)}
                  onRemove={() => removeHyp(h.id)}
                  canRemove={data.hypotheken.length > 1}
                />
              ))}
              <button onClick={addHypotheek}
                className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer border-0"
              >
                <Plus size={13} /> Hypotheek toevoegen
              </button>

              {/* HRA summary */}
              {(() => {
                const totaalRente = data.hypotheken.reduce((s, h) => {
                  if (h.leningBedrag <= 0) return s;
                  try { return s + berekenHypotheek(h, taxYear).jaarRente; } catch { return s; }
                }, 0);
                if (totaalRente <= 0) return null;
                // HRA aftrekvoet 2026: max 37,48% (2e schijf Box 1)
                const hraRate = 0.3748;
                const belastingVoordeel = totaalRente * hraRate;
                return (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">Hypotheekrenteaftrek (HRA) — {taxYear}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Totale jaarrente</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{nl.format(totaalRente)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">aftrekbaar van Box 1 inkomen</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Aftrekvoet (max 2026)</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">37,48%</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">2e schijf Box 1 tarief</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Belastingvoordeel</p>
                        <p className="font-bold text-green-700 dark:text-green-400">{nl.format(belastingVoordeel)}/jaar</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">≈ {nl.format(belastingVoordeel / 12)}/mnd</p>
                      </div>
                    </div>
                    {data.hypotheken.length > 1 && (
                      <div className="border-t border-green-200 dark:border-green-800 pt-2 space-y-1">
                        {data.hypotheken.map(h => {
                          if (h.leningBedrag <= 0) return null;
                          try {
                            const r = berekenHypotheek(h, taxYear).jaarRente;
                            return (
                              <div key={h.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                <span>{h.label}</span>
                                <span className="font-medium">{nl.format(r)}/jaar</span>
                              </div>
                            );
                          } catch { return null; }
                        })}
                      </div>
                    )}
                    <p className="text-xs text-green-700 dark:text-green-300 border-t border-green-200 dark:border-green-800 pt-2">
                      De hypotheekrente verlaagt uw belastbaar Box 1 inkomen. Het werkelijke voordeel hangt af van uw marginale tarief — bij een tarief van 35,82% (1e schijf) is het voordeel {nl.format(totaalRente * 0.3582)}/jaar.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Overige woonkosten */}
      <SectionCard title="Overige woonlasten — per maand" icon={<Home size={20} />} accent="border-orange-400">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CurrencyInput label="Gas, water & elektra" hint="Maandelijkse energiekosten"
            value={data.gwe} onChange={v => onChange({ ...data, gwe: v })}
            tooltip={<InfoTooltip tip="Uw gemiddelde maandelijkse energiekosten (gas, elektriciteit, water)." />}
          />
          <CurrencyInput label="VVE bijdrage" hint="Maandelijkse VVE-bijdrage"
            value={data.vve} onChange={v => onChange({ ...data, vve: v })}
            tooltip={<InfoTooltip tip="Maandelijkse bijdrage aan de Vereniging van Eigenaren. Alleen van toepassing bij een appartement." />}
          />
          <CurrencyInput label="Overige woonkosten" hint="Onderhoud, gemeentelijke heffingen"
            value={data.overig} onChange={v => onChange({ ...data, overig: v })} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-3 border border-orange-100 dark:border-orange-800 space-y-0.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Totale woonlast per maand</p>
            <p className="text-base font-bold text-orange-700">{nl.format(maandTotaal)}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-3 border border-orange-100 dark:border-orange-800 space-y-0.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Totale woonlast per jaar</p>
            <p className="text-base font-bold text-orange-800 dark:text-orange-300">{nl.format(maandTotaal * 12)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
