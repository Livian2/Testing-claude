import { useState } from 'react';
import { Landmark, Info, TrendingDown, Calculator } from 'lucide-react';
import type { TaxFormData } from '../types';
import SectionCard from './SectionCard';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  data: TaxFormData;
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nlDec = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 2026 constants
const AOW_FRANCHISE = 19_172;
const MAX_INKOMEN = 137_800;
const MAX_RESERVERINGSRUIMTE = 40_248;
const BRACKET2_RATE = 0.3748;  // 37.48%
const BRACKET3_RATE = 0.495;   // 49.50%
const BRACKET3_THRESHOLD = 78_426;

function calcMarginaalTarief(inkomen: number): number {
  return inkomen > BRACKET3_THRESHOLD ? BRACKET3_RATE : BRACKET2_RATE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function JaarruimteSection({ data }: Props) {
  const { t } = useLanguage();
  const [factorA, setFactorA] = useState<number>(0);
  const [reserveringsruimte, setReserveringsruimte] = useState<number>(0);

  // Inkomen = grossSalary + freelanceIncome, capped at MAX_INKOMEN
  const rawInkomen = (data.income.grossSalary ?? 0) + (data.income.freelanceIncome ?? 0);
  const inkomen = clamp(rawInkomen, 0, MAX_INKOMEN);

  const inkomstenBasis = Math.max(0, inkomen - AOW_FRANCHISE);
  const dertigProcent = inkomstenBasis * 0.30;
  const jaarruimteBruto = dertigProcent - factorA;
  const jaarruimte = Math.max(0, jaarruimteBruto);

  // Reserveringsruimte is capped at min(MAX_RESERVERINGSRUIMTE, 17% of inkomen)
  const maxReservering = Math.min(MAX_RESERVERINGSRUIMTE, inkomen * 0.17);
  const effectieveReserveringsruimte = clamp(reserveringsruimte, 0, maxReservering);

  const totaleInlegmogelijkheid = jaarruimte + effectieveReserveringsruimte;

  // Pension contributions already in data.income.pensionContributions count against jaarruimte
  const reedsGebruikt = data.income.pensionContributions ?? 0;
  const beschikbareRuimte = Math.max(0, totaleInlegmogelijkheid - reedsGebruikt);

  const marginaalTarief = calcMarginaalTarief(inkomen);
  const belastingteruggave = beschikbareRuimte * marginaalTarief;
  const effectiefNettoInleg = beschikbareRuimte - belastingteruggave;

  const inkomenCapped = rawInkomen > MAX_INKOMEN;

  return (
    <div className="space-y-4">
      {/* Inputs card */}
      <SectionCard
        title={t.jaarruimte.inputTitle}
        icon={<Calculator size={18} />}
        accent="border-amber-400"
      >
        <div className="space-y-5">
          {/* Factor A */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Factor A <span className="text-slate-400 dark:text-slate-500 font-normal">{t.jaarruimte.fromUpo}</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={factorA === 0 ? '' : factorA}
              placeholder="0"
              onChange={e => setFactorA(Math.max(0, Number(e.target.value) || 0))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.jaarruimte.factorADesc}
            </p>
          </div>

          {/* Reserveringsruimte */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.jaarruimte.unusedPrev}
              <span className="ml-1 text-slate-400 dark:text-slate-500 font-normal">{t.jaarruimte.maxTenYears}</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={reserveringsruimte === 0 ? '' : reserveringsruimte}
              placeholder="0"
              onChange={e => setReserveringsruimte(Math.max(0, Number(e.target.value) || 0))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.jaarruimte.unusedPrevHint} Maximum 2026:{' '}
              <strong className="text-slate-600 dark:text-slate-300">{nl.format(MAX_RESERVERINGSRUIMTE)}</strong>
              {' '}{t.jaarruimte.reservationHint.replace('17%', `17% (${nl.format(maxReservering)})`)}
            </p>
          </div>

          {/* Pension contributions already used */}
          {reedsGebruikt > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-800 dark:text-blue-300">
              <span className="font-semibold">{t.jaarruimte.alreadyDeposited}</span>{' '}
              {nl.format(reedsGebruikt)} {t.jaarruimte.alreadyDepositedSuffix}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Calculation breakdown card */}
      <SectionCard
        title={t.jaarruimte.calcTitle}
        icon={<Landmark size={18} />}
        accent="border-amber-400"
      >
        <div className="space-y-1">
          {inkomenCapped && (
            <div className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {t.jaarruimte.incomeCapped} {nl.format(MAX_INKOMEN)} ({nl.format(rawInkomen)}). {t.jaarruimte.incomeCappedUsing} {nl.format(MAX_INKOMEN)}.
            </div>
          )}

          <CalcRow label={t.jaarruimte.incomeBox1} value={nl.format(inkomen)} />
          <CalcRow label={t.jaarruimte.minusAow} value={`− ${nl.format(AOW_FRANCHISE)}`} indent />
          <CalcRow label={t.jaarruimte.basis} value={nl.format(inkomstenBasis)} separator />
          <CalcRow label={t.jaarruimte.times30pct} value={nl.format(dertigProcent)} indent />
          {factorA > 0 && (
            <CalcRow label={t.jaarruimte.minusFactorA} value={`− ${nl.format(factorA)}`} indent />
          )}
          <CalcRow
            label={t.jaarruimte.annualSpaceThis}
            value={nl.format(jaarruimte)}
            highlight={jaarruimte > 0}
            separator
          />
          {effectieveReserveringsruimte > 0 && (
            <>
              <CalcRow label={t.jaarruimte.plusReservation} value={`+ ${nl.format(effectieveReserveringsruimte)}`} indent />
              <CalcRow
                label={t.jaarruimte.totalContrib}
                value={nl.format(totaleInlegmogelijkheid)}
                highlight={totaleInlegmogelijkheid > 0}
                separator
              />
            </>
          )}
          {reedsGebruikt > 0 && (
            <>
              <CalcRow label={t.jaarruimte.minusDeposited} value={`− ${nl.format(reedsGebruikt)}`} indent />
              <CalcRow
                label={t.jaarruimte.remainingSpace}
                value={nl.format(beschikbareRuimte)}
                highlight={beschikbareRuimte > 0}
                separator
              />
            </>
          )}

          {jaarruimte === 0 && factorA === 0 && inkomen <= AOW_FRANCHISE && (
            <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              {t.jaarruimte.belowFranchise}
            </p>
          )}
          {jaarruimte === 0 && factorA > 0 && (
            <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              {t.jaarruimte.factorAFull}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Tax benefit card */}
      {beschikbareRuimte > 0 && (
        <SectionCard
          title={t.jaarruimte.taxBenefitTitle}
          icon={<TrendingDown size={18} />}
          accent="border-emerald-400"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <BenefitTile
                label={t.jaarruimte.maxContrib}
                value={nl.format(beschikbareRuimte)}
                sub={t.jaarruimte.availableSpace}
                color="amber"
              />
              <BenefitTile
                label={t.jaarruimte.taxRefund}
                value={nl.format(belastingteruggave)}
                sub={`${(marginaalTarief * 100).toFixed(2)}% ${t.jaarruimte.marginalRate}`}
                color="emerald"
              />
              <BenefitTile
                label={t.jaarruimte.effectiveNet}
                value={nl.format(effectiefNettoInleg)}
                sub={t.jaarruimte.afterRefund}
                color="blue"
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <p className="font-semibold">{t.jaarruimte.howItWorks}</p>
              <p>
                {t.jaarruimte.depositExplain1} {nl.format(beschikbareRuimte)} {t.jaarruimte.depositExplain2} <strong>{nlDec.format(belastingteruggave)}</strong>.
              </p>
              <p>
                {t.jaarruimte.effectiveDeposit}{' '}
                <strong>{nlDec.format(effectiefNettoInleg)}</strong>.
              </p>
              <p className="text-amber-700 dark:text-amber-400">
                {t.jaarruimte.pensionNote}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Info card */}
      <SectionCard
        title={t.jaarruimte.whatToDo}
        icon={<Info size={18} />}
        accent="border-slate-300"
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile emoji="🏦" title={t.jaarruimte.bankSavingsTitle} body={t.jaarruimte.bankSavingsBody} />
            <InfoTile emoji="📈" title={t.jaarruimte.investTitle}       body={t.jaarruimte.investBody} />
            <InfoTile emoji="📅" title={t.jaarruimte.deadlineTitle}     body={t.jaarruimte.deadlineBody} />
            <InfoTile emoji="📄" title={t.jaarruimte.keepProofTitle}    body={t.jaarruimte.keepProofBody} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
            {t.jaarruimte.disclaimer}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Sub-components ---

interface CalcRowProps {
  label: string;
  value: string;
  indent?: boolean;
  separator?: boolean;
  highlight?: boolean;
}

function CalcRow({ label, value, indent, separator, highlight }: CalcRowProps) {
  return (
    <div
      className={[
        'flex justify-between items-center py-1.5 text-sm',
        indent ? 'pl-4' : '',
        separator ? 'border-t border-slate-200 dark:border-slate-700 mt-1 pt-2' : '',
        highlight
          ? 'font-semibold text-amber-700 dark:text-amber-400'
          : 'text-slate-600 dark:text-slate-300',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={highlight ? 'tabular-nums' : 'tabular-nums text-slate-800 dark:text-slate-100'}>
        {value}
      </span>
    </div>
  );
}

interface BenefitTileProps {
  label: string;
  value: string;
  sub: string;
  color: 'amber' | 'emerald' | 'blue';
}

const colorMap = {
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
};

function BenefitTile({ label, value, sub, color }: BenefitTileProps) {
  return (
    <div className={`border rounded-xl px-4 py-3 ${colorMap[color]}`}>
      <p className="text-[11px] uppercase tracking-wide font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] mt-0.5 opacity-70">{sub}</p>
    </div>
  );
}

interface InfoTileProps {
  emoji: string;
  title: string;
  body: string;
}

function InfoTile({ emoji, title, body }: InfoTileProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <div>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-0.5">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
