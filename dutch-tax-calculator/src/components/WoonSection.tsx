import { useMemo, useState } from 'react';
import { Home, Plus, Trash2, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import type { WoonData, HypotheekData, HypotheekType, WoningType } from '../types';
import { berekenHypotheek } from '../utils/hypotheek';
import { useLanguage } from '../i18n/LanguageContext';
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

// HYPOTHEEK_TYPES is built inside HypotheekCard using t from useLanguage

const DEFAULT_HYP: Omit<HypotheekData, 'id' | 'label'> = {
  type: 'annuiteit', leningBedrag: 0, rentePercentage: 0,
  rentevastePeriode: 10, looptijd: 30, startJaar: new Date().getFullYear(),
};

// ── Amortisation SVG chart ──────────────────────────────────────────────────

function MortgageChart({ hyp, taxYear }: { hyp: HypotheekData; taxYear: number }) {
  const W = 520; const H = 140;
  const PAD_T = 10; const PAD_R = 10; const PAD_B = 28; const PAD_L = 48;
  const iW = W - PAD_L - PAD_R;
  const iH = H - PAD_T - PAD_B;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const pts: { year: number; balance: number; interest: number; principal: number }[] = [];
    if (hyp.leningBedrag <= 0 || hyp.looptijd <= 0) return pts;
    for (let yr = 0; yr <= hyp.looptijd; yr++) {
      const absYear = hyp.startJaar + yr;
      const b = berekenHypotheek(hyp, absYear);
      pts.push({ year: absYear, balance: b.restschuldBegin, interest: b.jaarRente, principal: b.jaarAflossing });
    }
    return pts;
  }, [hyp]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (chartData.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const chartX = (e.clientX - rect.left) - (rect.width * PAD_L / W);
    const chartW = rect.width * iW / W;
    const idx = Math.round((chartX / chartW) * (chartData.length - 1));
    setHoverIdx(Math.max(0, Math.min(chartData.length - 1, idx)));
  }

  if (chartData.length < 2) return null;

  const maxBal = Math.max(hyp.leningBedrag, 1);
  const years  = chartData.length;

  const xScale = (i: number) => PAD_L + (i / (years - 1)) * iW;
  const yBal   = (v: number) => PAD_T + iH - (v / maxBal) * iH;

  const balancePath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yBal(d.balance)}`).join(' ');
  const areaPath    = `${balancePath} L${xScale(years - 1)},${PAD_T + iH} L${xScale(0)},${PAD_T + iH} Z`;

  const currentIdx = chartData.findIndex(d => d.year === taxYear);
  const activeIdx  = hoverIdx !== null ? hoverIdx : currentIdx;
  const activeData = activeIdx >= 0 && activeIdx < chartData.length ? chartData[activeIdx] : null;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: f * maxBal, y: PAD_T + iH - f * iH }));
  const xTicks = chartData.filter(d => (d.year - hyp.startJaar) % 5 === 0);

  // Tooltip: position as % of SVG width so it scales with the element
  const tipPctLeft = activeIdx >= 0 ? xScale(activeIdx) / W * 100 : 0;
  const tipOnRight = tipPctLeft < 65;

  const fmt = (v: number) => v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
        <BarChart2 size={12} />Verloop restschuld
      </p>
      <div className="relative" style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 160, display: 'block' }}>
          <defs>
            <linearGradient id={`mg-${hyp.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                {t.val >= 1000 ? `${Math.round(t.val / 1000)}k` : Math.round(t.val)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill={`url(#mg-${hyp.id})`} />
          <polyline points={chartData.map((d, i) => `${xScale(i)},${yBal(d.balance)}`).join(' ')}
            fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />

          {/* Current-year marker */}
          {currentIdx >= 0 && (
            <g>
              <line x1={xScale(currentIdx)} y1={PAD_T} x2={xScale(currentIdx)} y2={PAD_T + iH}
                stroke="#f97316" strokeWidth="1.5" strokeDasharray="3,2" />
              <circle cx={xScale(currentIdx)} cy={yBal(chartData[currentIdx].balance)} r="4"
                fill="#f97316" stroke="white" strokeWidth="1.5" />
            </g>
          )}

          {/* Hover crosshair */}
          {hoverIdx !== null && activeData && (
            <g>
              <line x1={xScale(hoverIdx)} y1={PAD_T} x2={xScale(hoverIdx)} y2={PAD_T + iH}
                stroke="#6366f1" strokeWidth="1" strokeDasharray="3,2" />
              <circle cx={xScale(hoverIdx)} cy={yBal(activeData.balance)} r="4"
                fill="#6366f1" stroke="white" strokeWidth="1.5" />
            </g>
          )}

          {xTicks.map((d, i) => {
            const idx = chartData.findIndex(p => p.year === d.year);
            return (
              <text key={i} x={xScale(idx)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {d.year}
              </text>
            );
          })}

          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + iH} stroke="#cbd5e1" strokeWidth="1" />
          <line x1={PAD_L} y1={PAD_T + iH} x2={W - PAD_R} y2={PAD_T + iH} stroke="#cbd5e1" strokeWidth="1" />
        </svg>

        {/* HTML tooltip overlay */}
        {hoverIdx !== null && activeData && (
          <div
            className="absolute top-1 pointer-events-none z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-md px-2.5 py-2 text-xs"
            style={{ [tipOnRight ? 'left' : 'right']: `${tipOnRight ? tipPctLeft : 100 - tipPctLeft}%` }}
          >
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{activeData.year}</p>
            <p className="text-slate-500 dark:text-slate-400">Restschuld <span className="font-medium text-slate-700 dark:text-slate-200">{fmt(activeData.balance)}</span></p>
            <p className="text-slate-500 dark:text-slate-400">Rente <span className="font-medium text-blue-600 dark:text-blue-400">{fmt(activeData.interest)}</span></p>
            <p className="text-slate-500 dark:text-slate-400">Aflossing <span className="font-medium text-green-600 dark:text-green-400">{fmt(activeData.principal)}</span></p>
          </div>
        )}
      </div>
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
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  const HYPOTHEEK_TYPES: { value: HypotheekType; label: string; desc: string; tip: string }[] = [
    { value: 'annuiteit',        label: t.housing.annuity,       desc: t.housing.annuityDesc,      tip: 'Vaste maandlast gedurende de hele looptijd. Aan het begin betaalt u vooral rente, aan het einde vooral aflossing.' },
    { value: 'lineair',          label: t.housing.linear,        desc: t.housing.linearDesc,       tip: 'Elke maand lost u een vast bedrag af. De rente daalt elk jaar, dus uw maandlast wordt steeds lager.' },
    { value: 'aflossingsvrijij', label: t.housing.interestOnly,  desc: t.housing.interestOnlyDesc, tip: 'U betaalt alleen rente, u lost niets af. De schuld blijft gelijk. Let op: u heeft geen recht op hypotheekrenteaftrek bij nieuw afgesloten aflossingsvrije hypotheken.' },
  ];

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
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Maandlast',       val: nl2.format(berekening.maandlast) },
                  { label: 'Jaarrente',        val: nl.format(berekening.jaarRente) },
                  { label: 'Restschuld begin', val: nl.format(berekening.restschuldBegin) },
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
  const { t } = useLanguage();
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
      <SectionCard title={<span className="flex items-center gap-1.5">{t.housing.sectionTitle} <InfoTooltip tip="Kies 'Huur' als u een huurwoning heeft. Kies 'Hypotheek' als u een eigen woning bezit met een lening." /></span>} icon={<Home size={20} />} accent="border-teal-400">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['huur', 'hypotheek'] as WoningType[]).map(woningType => (
              <button key={woningType} onClick={() => onChange({ ...data, woningType })}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-colors cursor-pointer ${
                  data.woningType === woningType
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-300'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <span className="text-sm font-semibold">{woningType === 'huur' ? t.housing.rent : t.housing.mortgage}</span>
                <span className="text-xs opacity-75">{woningType === 'huur' ? 'U huurt uw woning' : 'U heeft een eigen woning'}</span>
              </button>
            ))}
          </div>

          {data.woningType === 'huur' && (
            <div className="space-y-3">
              <CurrencyInput label={t.housing.monthlyRent} hint={t.housing.monthlyRentHint}
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
                <span className="text-sm text-teal-800 dark:text-teal-300 font-medium flex items-center gap-1">{t.housing.huurtoeslag} <InfoTooltip tip={t.housing.huurtoeslagHint} /></span>
                <span className="text-xs text-teal-600 dark:text-teal-400 ml-1">— wordt automatisch berekend bij lage inkomens</span>
              </label>
            </div>
          )}

          {data.woningType === 'hypotheek' && (
            <div className="space-y-3">
              <CurrencyInput
                label="WOZ-waarde woning"
                hint="Waarde volgens WOZ-beschikking"
                value={data.wozWaarde ?? 0}
                onChange={v => onChange({ ...data, wozWaarde: v })}
                tooltip={<InfoTooltip tip="De WOZ-waarde staat op uw WOZ-beschikking (jaarlijks van de gemeente). Wordt gebruikt voor het eigenwoningforfait (EWF): 0,35% van de WOZ-waarde die bij uw inkomen wordt opgeteld. De netto aftrekpost = betaalde rente − EWF." />}
              />

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
                <Plus size={13} /> {t.housing.addMortgage}
              </button>

              {/* HRA summary */}
              {(() => {
                const totaalRente = data.hypotheken.reduce((s, h) => {
                  if (h.leningBedrag <= 0) return s;
                  try { return s + berekenHypotheek(h, taxYear).jaarRente; } catch { return s; }
                }, 0);
                if (totaalRente <= 0) return null;
                const woz = data.wozWaarde ?? 0;
                const ewf = woz > 12500 ? (woz <= 1310000 ? Math.round(woz * 0.0035) : Math.round(1310000 * 0.0035 + (woz - 1310000) * 0.0235)) : 0;
                const nettoAftrekpost = Math.max(0, totaalRente - ewf);
                const hraRate = 0.3748;
                const belastingVoordeel = nettoAftrekpost * hraRate;
                return (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">Hypotheekrenteaftrek (HRA) — {taxYear}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Totale jaarrente</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{nl.format(totaalRente)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">betaald aan hypotheekrentes</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Eigenwoningforfait</p>
                        <p className="font-bold text-orange-600 dark:text-orange-400">− {nl.format(ewf)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">0,35% × WOZ {woz > 0 ? `(${nl.format(woz)})` : '(vul WOZ in)'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Netto aftrekpost</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{nl.format(nettoAftrekpost)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">verlaagt Box 1 inkomen</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Belastingvoordeel</p>
                        <p className="font-bold text-green-700 dark:text-green-400">{nl.format(belastingVoordeel)}/jaar</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">≈ {nl.format(Math.round(belastingVoordeel / 12))}/mnd</p>
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
                      Netto aftrekpost = betaalde rente − eigenwoningforfait. Het werkelijke voordeel hangt af van uw marginale tarief (zie Resultaten voor exacte berekening).
                      {ewf > totaalRente && <span className="block mt-1 text-orange-600 dark:text-orange-400">Let op: uw EWF ({nl.format(ewf)}) is hoger dan uw rente ({nl.format(totaalRente)}). Er is geen HRA-voordeel; het positieve eigenwoninginkomen wordt gedeeltelijk belast (Wet Hillen afbouw).</span>}
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
          <CurrencyInput label={t.housing.gasWaterElec} hint={t.housing.gasWaterElecHint}
            value={data.gwe} onChange={v => onChange({ ...data, gwe: v })}
            tooltip={<InfoTooltip tip="Uw gemiddelde maandelijkse energiekosten (gas, elektriciteit, water)." />}
          />
          <CurrencyInput label={t.housing.vve} hint={t.housing.vveHint}
            value={data.vve} onChange={v => onChange({ ...data, vve: v })}
            tooltip={<InfoTooltip tip="Maandelijkse bijdrage aan de Vereniging van Eigenaren. Alleen van toepassing bij een appartement." />}
          />
          <CurrencyInput label={t.housing.other} hint="Onderhoud, gemeentelijke heffingen"
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
