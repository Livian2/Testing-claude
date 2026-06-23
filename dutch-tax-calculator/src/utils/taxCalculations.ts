import type {
  TaxFormData, TaxResult, Box1Result, Box3Result, Toeslagen,
  Holding, Transaction, Position, AssetType,
  SchenkingItem,
} from '../types';
import { berekenHypotheek } from './hypotheek';
import { berekenDuoJaarbetaling } from './duo';
import { jaarDeposit, gereserveerdTotDatum } from './afschrijvingen';

// ─── Schenkbelasting ──────────────────────────────────────────────────────
// Tarieven en vrijstellingen: Belastingdienst 2025 (Successiewet 1956 art. 24/33)
// 2026 values are indexed to CPI; exact published values used where available.

interface SchenkVrijstellingen {
  kind: number;          // jaarlijkse vrijstelling ouder→kind
  overig: number;        // jaarlijkse vrijstelling overige verkrijgers
  eenmaligVrij: number;  // eenmalig verhoogde vrijstelling, vrij besteedbaar (kind 18-40)
  eenmaligStudie: number;// eenmalig verhoogde vrijstelling, dure studie (kind 18-40)
  schijfgrens: number;   // schijfgrens eerste/tweede schijf
}

function getSchenkVrijstellingen(taxYear: number): SchenkVrijstellingen {
  // Exact values per year (Belastingdienst tabel schenkbelasting)
  if (taxYear >= 2026) return { kind: 6908, overig: 2784, eenmaligVrij: 33241, eenmaligStudie: 69225, schijfgrens: 144948 };
  if (taxYear === 2025) return { kind: 6633, overig: 2658, eenmaligVrij: 31813, eenmaligStudie: 66268, schijfgrens: 138642 };
  return { kind: 6633, overig: 2658, eenmaligVrij: 31813, eenmaligStudie: 66268, schijfgrens: 138642 };
}

export interface SchenkingCalc {
  bedrag: number;
  vrijgesteld: number;
  belastbaar: number;
  belasting: number;
  effectiefTarief: number;
  netOntvangen: number;
}

export function berekenSchenking(item: SchenkingItem, taxYear: number): SchenkingCalc {
  const v = getSchenkVrijstellingen(taxYear);

  let vrijgesteld = 0;
  if (item.relatie === 'ouder') {
    if      (item.vrijstelling === 'jaarlijks')        vrijgesteld = v.kind;
    else if (item.vrijstelling === 'eenmalig_vrij')    vrijgesteld = v.eenmaligVrij;
    else if (item.vrijstelling === 'eenmalig_studie')  vrijgesteld = v.eenmaligStudie;
  } else {
    if (item.vrijstelling === 'jaarlijks') vrijgesteld = v.overig;
  }

  vrijgesteld = Math.min(vrijgesteld, item.bedrag);
  const belastbaar = Math.max(0, item.bedrag - vrijgesteld);

  let belasting = 0;
  if (item.relatie === 'ouder') {
    // Tariefgroep I: kind ontvangt van ouder — 10% t/m schijfgrens, 20% daarboven
    belasting = Math.min(belastbaar, v.schijfgrens) * 0.10
              + Math.max(0, belastbaar - v.schijfgrens) * 0.20;
  } else {
    // Tariefgroep IA/II: overige verkrijgers — 18% t/m schijfgrens, 36% daarboven
    belasting = Math.min(belastbaar, v.schijfgrens) * 0.18
              + Math.max(0, belastbaar - v.schijfgrens) * 0.36;
  }

  const netOntvangen = item.bedrag - belasting;
  const effectiefTarief = item.bedrag > 0 ? belasting / item.bedrag : 0;

  return { bedrag: item.bedrag, vrijgesteld, belastbaar, belasting, effectiefTarief, netOntvangen };
}

// ─── Eigenwoningforfait (EWF) ──────────────────────────────────────────────
// 2026: 0% ≤ €12.500; 0,35% up to €1.310.000; 2,35% on excess (villatarief)
// Bron: Ministerie van Financiën / belastingdienst.nl 2026

const EWF_MIN      = 12500;
const EWF_CAP      = 1310000;
const EWF_RATE     = 0.0035;
const EWF_VILLA    = 0.0235;

export function calcEwf(woz: number): number {
  if (woz <= EWF_MIN)  return 0;
  if (woz <= EWF_CAP)  return Math.round(woz * EWF_RATE);
  return Math.round(EWF_CAP * EWF_RATE + (woz - EWF_CAP) * EWF_VILLA);
}

// Wet Hillen phase-out: started 2019, 30 years total.
// In year Y the taxable fraction of (EWF > rente) is (Y-2019)/30.
function hillenTaxableFraction(taxYear: number): number {
  return Math.max(0, Math.min(1, (taxYear - 2019) / 30));
}

// Net eigenwoninginkomen effect on Box 1 taxable income.
// Returns a signed value: negative = deduction, positive = addition.
// Aflossingsvrij hypotheken without overgangsrecht (post-2013) are not deductible.
// Optional hypResults parameter avoids re-running berekenHypotheek when already computed.
function eigenwoningEffect(
  woon: import('../types').WoonData,
  taxYear: number,
  hypResults?: ReturnType<typeof berekenHypotheek>[],
): number {
  if (woon.woningType !== 'hypotheek') return 0;
  let totalRente = 0;
  for (let i = 0; i < woon.hypotheken.length; i++) {
    const hyp = woon.hypotheken[i];
    if (hyp.leningBedrag <= 0) continue;
    const deductible = hyp.type !== 'aflossingsvrijij' || (hyp.overgangsrechtVoor2013 ?? true);
    if (deductible) {
      const r = hypResults ? hypResults[i] : berekenHypotheek(hyp, taxYear);
      totalRente += r.jaarRente;
    }
  }
  const ewf = calcEwf(woon.wozWaarde ?? 0);
  const ewi  = ewf - totalRente; // eigenwoninginkomen
  if (ewi < 0) return ewi;      // rente > EWF → deduction
  // EWF > rente → Wet Hillen (partially phased out)
  return ewi * hillenTaxableFraction(taxYear);
}

// ─── 2026 Tax Parameters ───────────────────────────────────────────────────
// Source: Belastingdienst.nl tabellen 2026 (vastgesteld)
// Schijf 1: t/m €38.883 → 35,75% (gecombineerd IB + premies volksverzekeringen)
// Schijf 2: €38.883 – €78.426 → 37,56% (alleen inkomstenbelasting)
// Schijf 3: boven €78.426 → 49,50% (alleen inkomstenbelasting)

const BOX1_BRACKETS_2026 = [
  { limit: 38883,    rate: 0.3575 },
  { limit: 78426,    rate: 0.3756 },
  { limit: Infinity, rate: 0.4950 },
];

// Algemene heffingskorting 2026: max €3.115, afbouw 6,40% vanaf €29.739 tot €0 bij €78.426
// Bron: belastingdienst.nl/algemene_heffingskorting 2026
// Let op: afbouw is gebaseerd op VERZAMELINKOMEN (box 1+2+3), niet alleen box 1 (geldt sinds 2025)
function calcAlgemeneHeffingskorting(verzamelinkomen: number): number {
  if (verzamelinkomen <= 29739) return 3115;
  if (verzamelinkomen <= 78426)
    return Math.max(0, Math.round(3115 - (verzamelinkomen - 29739) * 0.0640));
  return 0;
}

// Arbeidskorting 2026: max €5.685 bij €45.593, afbouw 6,510% tot €0 bij ~€132.920
// Bron: tabel-arbeidskorting-2026 (belastingdienst.nl)
// Verificatie: AK(€50.000) = €5.685 - (50.000-45.593)×6,51% = €5.398 ≈ €5.399 ✓
function calcArbeidskorting(employmentIncome: number): number {
  if (employmentIncome <= 0) return 0;
  // Opbouwfase 1: 8,324% t/m €11.965  →  max €996
  if (employmentIncome <= 11965)
    return Math.round(employmentIncome * 0.08324);
  // Opbouwfase 2: +31,009% t/m €25.845  →  max €5.300
  if (employmentIncome <= 25845)
    return Math.round(996 + (employmentIncome - 11965) * 0.31009);
  // Opbouwfase 3: +1,950% t/m €45.593  →  max €5.685
  if (employmentIncome <= 45593)
    return Math.round(5300 + (employmentIncome - 25845) * 0.01950);
  // Afbouwfase: −6,510% boven €45.593  →  €0 bij ~€132.920
  if (employmentIncome <= 132920)
    return Math.max(0, Math.round(5685 - (employmentIncome - 45593) * 0.06510));
  return 0;
}

// ─── Box 1 ─────────────────────────────────────────────────────────────────

// OLA-style split rates 2026:
// Combined schijf 1 = 35.75% = 8.10% (IB) + 27.65% (premies: AOW 17.9% + ANW 0.1% + WLZ 9.65%)
// Verification: 0.0810 + 0.1790 + 0.0010 + 0.0965 = 0.3575 ✓
// Schijf 2 and 3 are inkomstenbelasting only — premies only apply up to schijf-1 ceiling (€38.883)
const IB_ONLY_RATES_2026  = [0.0810, 0.3756, 0.4950];
const PREMIE_AOW_RATE     = 0.1790;
const PREMIE_ANW_RATE     = 0.0010;
const PREMIE_WLZ_RATE     = 0.0965;
const PREMIE_MAX_BASIS    = 38883; // premies are capped at the schijf-1 ceiling (= BOX1_BRACKETS_2026[0].limit)

// verzamelinkomen is passed in from calculateTaxes (box1 + box3 fictitious return)
// so the AHK afbouw uses the correct grondslag. Falls back to box1 taxableIncome if omitted.
export function calculateBox1(
  data: TaxFormData,
  verzamelinkomen?: number,
  hypResults?: ReturnType<typeof berekenHypotheek>[],
): Box1Result {
  const { income, woon, personal } = data;

  // Net eigenwoninginkomen: negative = deduction (rente > EWF), positive = addition (Wet Hillen phase-out)
  const ewEffect = eigenwoningEffect(woon, personal.taxYear, hypResults);

  const totalGrossIncome =
    income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;
  // ewEffect is negative when there's a deduction, so adding it reduces taxable income
  const taxableIncome = Math.max(0, totalGrossIncome + ewEffect - income.pensionContributions);
  const pensionDeduction = income.pensionContributions;

  let grossTax = 0;
  let remaining = taxableIncome;
  const brackets: Box1Result['brackets'] = [];
  let prev = 0;

  for (const b of BOX1_BRACKETS_2026) {
    const base = Math.min(remaining, b.limit - prev);
    const tax  = base * b.rate;
    if (base > 0) brackets.push({ rate: b.rate, base, tax });
    grossTax  += tax;
    remaining -= base;
    prev       = b.limit;
    if (remaining <= 0) break;
  }

  // AHK uses verzamelinkomen (box1 + box3), not just box1 taxable income (since 2025)
  const ahkBase             = verzamelinkomen ?? taxableIncome;
  const algemeneHeffingskorting = calcAlgemeneHeffingskorting(ahkBase);
  const arbeidskorting          = calcArbeidskorting(income.grossSalary + income.freelanceIncome);
  const netTax                  = Math.max(0, grossTax - algemeneHeffingskorting - arbeidskorting);
  const effectiveRate           = taxableIncome > 0 ? netTax / taxableIncome : 0;

  // OLA-style split: inkomstenbelasting per schijf (IB only, premies excluded)
  const ibSchijven = brackets.map((b, j) => ({
    schijf:  j + 1,
    ibRate:  IB_ONLY_RATES_2026[j] ?? b.rate,
    base:    b.base,
    ibTax:   b.base * (IB_ONLY_RATES_2026[j] ?? b.rate),
  }));
  const ibSubtotaal = ibSchijven.reduce((s, b) => s + b.ibTax, 0);

  // Premie volksverzekeringen — only on income up to PREMIE_MAX_BASIS (= schijf-1 ceiling)
  const premieGrondslag = Math.min(taxableIncome, PREMIE_MAX_BASIS);
  const premieAOW       = Math.round(premieGrondslag * PREMIE_AOW_RATE);
  const premieANW       = Math.round(premieGrondslag * PREMIE_ANW_RATE);
  const premieWLZ       = Math.round(premieGrondslag * PREMIE_WLZ_RATE);
  const premiesSubtotaal = premieAOW + premieANW + premieWLZ;

  return {
    taxableIncome, grossTax, algemeneHeffingskorting, arbeidskorting, netTax, effectiveRate, brackets,
    grossIncomeBeforeDeductions: totalGrossIncome, ewEffect, pensionDeduction,
    ibSchijven, ibSubtotaal, premieGrondslag, premieAOW, premieANW, premieWLZ, premiesSubtotaal,
  };
}

// ─── Box 3 ─────────────────────────────────────────────────────────────────

const BOX3_RATES_2026 = { savings: 0.0128, investments: 0.0600, debtRate: 0.0270 };
const BOX3_TAX_RATE          = 0.36;
const BOX3_DEBT_THRESHOLD    = 3800;
const BOX3_EXEMPTION_SINGLE  = 59357;
const BOX3_EXEMPTION_PARTNER = 118714;

// Optional precomputed inputs allow calculateTaxes to avoid duplicate work.
export function calculateBox3(
  data: TaxFormData,
  positions?: Position[],
): Box3Result {
  const { schulden, personal } = data;
  const bankData = data.bankData ?? { spaarrekeningen: [], betaalrekeningen: [] };
  const isPartner = personal.filingStatus === 'partner';
  const exemption = isPartner ? BOX3_EXEMPTION_PARTNER : BOX3_EXEMPTION_SINGLE;
  const threshold = isPartner ? BOX3_DEBT_THRESHOLD * 2 : BOX3_DEBT_THRESHOLD;

  // Savings = Jan-1 balances for Box 3 peildatum; fall back to current balance when Jan-1 not entered
  const totalSavings =
    bankData.spaarrekeningen.reduce((s, a) => s + (a.saldoJan1 ?? a.saldoHuidig), 0) +
    bankData.betaalrekeningen.reduce((s, a) => s + (a.saldoJan1 ?? a.saldoHuidig), 0);

  // Investments = portfolio current value
  const pos = positions ?? computePositions(data.portfolio.holdings, data.portfolio.transactions);
  const totalInvestments = pos.reduce((s, p) => s + p.currentValue, 0);

  const totalAssets = totalSavings + totalInvestments;

  const afschrijvingenGereserveerd = 0; // not deductible in Box 3

  const rawDebts   = [...schulden.duo, ...schulden.beleggingen].reduce((s, d) => s + d.bedrag, 0);
  const totalDebts = Math.max(0, rawDebts - threshold);

  const netWealth     = Math.max(0, totalAssets - totalDebts);
  const taxableWealth = Math.max(0, netWealth - exemption);

  const drempelschuld = rawDebts - totalDebts;

  if (taxableWealth === 0) {
    return {
      totalAssets, totalDebts, rawDebts, drempelschuld,
      afschrijvingenGereserveerd, netWealth, exemption, taxableWealth,
      fictitiousReturn: 0, grossTax: 0, heffingskortingBox3: 0, netTax: 0,
      breakdown: {
        savings: totalSavings, investments: totalInvestments, debts: totalDebts,
        savingsFictitious: 0, investmentsFictitious: 0, debtsFictitious: 0,
      },
    };
  }

  // Belastingdienst formula: scale ALL categories by grondslag/rendementsgrondslag.
  // rendementsgrondslag (netWealth) = bezittingen − schulden (after drempel).
  // taxableWealth (grondslag) = netWealth − heffingsvrijdom.
  // The same scale factor applies to savings, investments AND debts.
  const scale = netWealth > 0 ? taxableWealth / netWealth : 0;

  const taxableSavings     = totalSavings     * scale;
  const taxableInvestments = totalInvestments * scale;
  const taxableDebts       = totalDebts       * scale;

  const savingsFictitious     = taxableSavings     * BOX3_RATES_2026.savings;
  const investmentsFictitious = taxableInvestments * BOX3_RATES_2026.investments;
  const debtsFictitious       = taxableDebts       * BOX3_RATES_2026.debtRate;

  const fictitiousReturn = savingsFictitious + investmentsFictitious - debtsFictitious;
  const grossTax         = Math.max(0, fictitiousReturn * BOX3_TAX_RATE);

  return {
    totalAssets, totalDebts, rawDebts, drempelschuld,
    afschrijvingenGereserveerd, netWealth, exemption, taxableWealth,
    fictitiousReturn, grossTax, heffingskortingBox3: 0, netTax: grossTax,
    breakdown: {
      savings: totalSavings, investments: totalInvestments, debts: totalDebts,
      savingsFictitious, investmentsFictitious, debtsFictitious,
    },
  };
}

// ─── Toeslagen 2026 (indicatief) ───────────────────────────────────────────

export function calculateToeslagen(data: TaxFormData, box1: Box1Result, box3: Box3Result): Toeslagen {
  const { personal, woon } = data;
  const isPartner = personal.filingStatus === 'partner';

  // Verzamelinkomen = Box 1 belastbaar inkomen + Box 3 voordeel (fictitiousReturn ≥ 0)
  const toetsingsinkomen = box1.taxableIncome + Math.max(0, box3.fictitiousReturn);

  // ── Zorgtoeslag 2026 ──────────────────────────────────────────────────────
  // Formule belastingdienst: zorgtoeslag = normPremie − drempelpercentage × inkomen
  // normPremie (gestandaardiseerde premie) is de referentiepremie per persoon (2026: ≈€2.210/jr).
  // Drempelpercentage 2026: 5,75%. Toeslag is max € 129/mnd (single) en min €0.
  // Bij laag inkomen (bijv. €6.400) geeft de formule normPremie − 5,75% × 6.400 = €1.842 →
  // begrensd op het maximum → volledige toeslag. Pas bij inkomen boven ~€11.500 daalt de toeslag.
  const ZORG_DREMPEL_PCT    = 0.0575;           // drempelpercentage 2026
  const ZORG_NORM_SINGLE    = 38883 * 0.0575;   // ≈ 2236, afgeleid zodat toeslag = 0 op inkomensgrens (schijf-1 ceiling)
  const ZORG_NORM_PARTNER   = ZORG_NORM_SINGLE * 2;
  const ZORG_MAX_SINGLE     = 1548;             // 129 × 12
  const ZORG_MAX_PARTNER    = 3096;             // 2 × 1548
  const ZORG_LIMIT_SINGLE   = 38883;
  const ZORG_LIMIT_PARTNER  = ZORG_NORM_PARTNER / ZORG_DREMPEL_PCT; // ≈ 76.882
  // Vermogensgrens zorgtoeslag 2026: grondslag sparen en beleggen (bezittingen − schulden, vóór heffingsvrijdom)
  const ZORG_VERM_SINGLE    = 140_250;
  const ZORG_VERM_PARTNER   = 177_363;

  let zorgtoeslag = 0;
  const zorgNorm  = isPartner ? ZORG_NORM_PARTNER  : ZORG_NORM_SINGLE;
  const zorgMax   = isPartner ? ZORG_MAX_PARTNER   : ZORG_MAX_SINGLE;
  const zorgLimit = isPartner ? ZORG_LIMIT_PARTNER : ZORG_LIMIT_SINGLE;
  const zorgVermGrens = isPartner ? ZORG_VERM_PARTNER : ZORG_VERM_SINGLE;
  // box3.netWealth = rendementsgrondslag (bezittingen − schulden na drempel, vóór heffingsvrijdom)
  const box3Vermogen = box3.netWealth;

  if (toetsingsinkomen < zorgLimit && box3Vermogen <= zorgVermGrens) {
    const raw = zorgNorm - ZORG_DREMPEL_PCT * toetsingsinkomen;
    zorgtoeslag = Math.max(0, Math.min(zorgMax, raw));
  }

  // ── Huurtoeslag 2026 ──────────────────────────────────────────────────────
  // Aftoppingsgrens 1-2 pers €660/mnd; liberalisatiegrens €900/mnd.
  // Vereenvoudigde formule: toeslag = max(0, effectiefJaarHuur − basishuur) × inkomensafbouw
  // De basishuur (normhuur) is het deel dat de huurder zelf draagt (~€290/mnd indicatief).
  const HUUR_AFTOP   = 660 * 12;   // aftoppingsgrens 1-2 pers
  const HUUR_MAX     = 900 * 12;   // liberalisatiegrens (max toelaatbare huur)
  const HUUR_NORM    = 290 * 12;   // basishuur (indicatief gemiddeld)
  const HUUR_DREMPEL = 17_500;
  const HUUR_LIMIT   = isPartner ? 43_000 : 32_005;

  let huurtoeslag = 0;
  const jaarHuur  = woon.woningType === 'huur' ? woon.maandhuur * 12 : 0;

  if (woon.woningType === 'huur' && woon.huurtoeslagEnabled !== false && jaarHuur > 0 && jaarHuur <= HUUR_MAX && toetsingsinkomen <= HUUR_LIMIT) {
    const effectiefHuur = Math.min(jaarHuur, HUUR_AFTOP);
    const baseToeslag   = Math.max(0, effectiefHuur - HUUR_NORM);
    const incomeFactor  = Math.max(0, 1 - Math.max(0, toetsingsinkomen - HUUR_DREMPEL) / (HUUR_LIMIT - HUUR_DREMPEL));
    huurtoeslag = baseToeslag * incomeFactor;
  }

  // ── Hypotheekrenteaftrek (HRA) ────────────────────────────────────────────
  // Tax saving = bracketTax(income without eigenwoningEffect) − bracketTax(income with it)
  // eigenwoningEffect is negative (deduction) when rente > EWF, which is the normal HRA scenario.
  const ewEffect = eigenwoningEffect(woon, personal.taxYear);

  function bracketTax(income: number): number {
    let tax = 0;
    let rem = Math.max(0, income);
    if (rem > 78426)  { tax += (rem - 78426) * 0.4950; rem = 78426; }
    if (rem > 38883)  { tax += (rem - 38883) * 0.3756; rem = 38883; }
    tax += rem * 0.3575;
    return tax;
  }

  const incomeWithHRA    = box1.taxableIncome;
  const incomeWithoutHRA = box1.taxableIncome - ewEffect; // remove eigenwoninginkomen effect
  // HRA only yields a benefit when rente > EWF (ewEffect < 0, incomeWithoutHRA > incomeWithHRA)
  const hypotheekrenteaftrek = Math.max(0, Math.round(bracketTax(incomeWithoutHRA) - bracketTax(incomeWithHRA)));

  return {
    zorgtoeslag:          Math.round(zorgtoeslag),
    huurtoeslag:          Math.round(huurtoeslag),
    hypotheekrenteaftrek,
    total:                Math.round(zorgtoeslag + huurtoeslag),
  };
}

// ─── Portfolio positions ────────────────────────────────────────────────────

// 1 unit of `currency` = `fxRate` EUR. EUR (or unset currency) always converts 1:1.
export function toEurPrice(pricePerUnit: number, currency: string | undefined, fxRate: number | undefined): number {
  if (!currency || currency === 'EUR') return pricePerUnit;
  return pricePerUnit * (fxRate || 1);
}

export function computePositions(holdings: Holding[], transactions: Transaction[]): Position[] {
  type InternalPos = { name: string; type: AssetType; broker: string; ticker: string; quantity: number; avgCost: number; currentPrice: number };

  // Key by holding id (not name) so same-name holdings at different brokers are tracked separately
  const byId = new Map<string, InternalPos>();
  // name → first matching id (for transaction assignment)
  const nameToId = new Map<string, string>();

  for (const h of holdings) {
    const key = h.id || h.name;
    byId.set(key, {
      name: h.name, type: h.type, broker: h.broker, ticker: h.ticker,
      quantity: h.quantity, avgCost: toEurPrice(h.pricePerUnit, h.currency, h.fxRate), currentPrice: h.currentPrice,
    });
    if (!nameToId.has(h.name)) nameToId.set(h.name, key);
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const key = nameToId.get(tx.holdingName) ?? tx.holdingName;
    const pos = byId.get(key) ?? { name: tx.holdingName, type: 'other' as AssetType, broker: tx.broker, ticker: '', quantity: 0, avgCost: 0, currentPrice: 0 };
    const txPriceEur = toEurPrice(tx.pricePerUnit, tx.currency, tx.fxRate);
    if (tx.type === 'buy') {
      const totalQty  = pos.quantity + tx.quantity;
      const totalCost = pos.quantity * pos.avgCost + tx.quantity * txPriceEur;
      byId.set(key, { ...pos, broker: tx.broker || pos.broker, quantity: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 });
    } else {
      byId.set(key, { ...pos, broker: tx.broker || pos.broker, quantity: Math.max(0, pos.quantity - tx.quantity) });
    }
  }

  // Merge positions with the same display key (ticker || name) so the same stock at
  // multiple brokers appears as one row with combined quantity and "DEGIRO + IBKR" broker.
  const merged = new Map<string, InternalPos & { brokers: string[] }>();
  for (const pos of byId.values()) {
    if (pos.quantity <= 0) continue;
    const displayKey = pos.ticker || pos.name;
    const existing = merged.get(displayKey);
    if (existing) {
      const totalQty  = existing.quantity + pos.quantity;
      const totalCost = existing.quantity * existing.avgCost + pos.quantity * pos.avgCost;
      existing.quantity    = totalQty;
      existing.avgCost     = totalQty > 0 ? totalCost / totalQty : 0;
      existing.currentPrice = pos.currentPrice > 0 ? pos.currentPrice : existing.currentPrice;
      if (pos.broker && !existing.brokers.includes(pos.broker)) existing.brokers.push(pos.broker);
    } else {
      merged.set(displayKey, { ...pos, brokers: pos.broker ? [pos.broker] : [] });
    }
  }

  return Array.from(merged.values()).map(p => {
    const price        = p.currentPrice > 0 ? p.currentPrice : p.avgCost;
    const currentValue = p.quantity * price;
    return {
      name: p.name, type: p.type,
      broker: p.brokers.filter(Boolean).join(' + '),
      ticker: p.ticker, quantity: p.quantity, avgCost: p.avgCost,
      currentPrice: p.currentPrice, currentValue,
    };
  });
}

export function calcRealisedGain(holdings: Holding[], transactions: Transaction[]): number {
  type Pos = { quantity: number; avgCost: number };
  const map = new Map<string, Pos>();
  for (const h of holdings) map.set(h.name, { quantity: h.quantity, avgCost: h.pricePerUnit });

  let gain = 0;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const pos = map.get(tx.holdingName) ?? { quantity: 0, avgCost: 0 };
    if (tx.type === 'buy') {
      const totalQty  = pos.quantity + tx.quantity;
      const totalCost = pos.quantity * pos.avgCost + tx.quantity * tx.pricePerUnit;
      map.set(tx.holdingName, { quantity: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 });
    } else {
      gain += tx.quantity * (tx.pricePerUnit - pos.avgCost);
      map.set(tx.holdingName, { quantity: Math.max(0, pos.quantity - tx.quantity), avgCost: pos.avgCost });
    }
  }
  return gain;
}

// ─── Full calculation ───────────────────────────────────────────────────────

export function calculateTaxes(data: TaxFormData): TaxResult {
  const { expenses, savings, income, woon, personal, portfolio, schulden } = data;

  // Compute once and share — was previously called 2× (Box3 + main) and 3× (hypotheek)
  const positions   = computePositions(portfolio.holdings, portfolio.transactions);
  const hypResults  = woon.woningType === 'hypotheek'
    ? woon.hypotheken.map(h => berekenHypotheek(h, personal.taxYear))
    : [];

  // Box 3 must be computed first: the AHK afbouw is based on verzamelinkomen (box1+box3)
  const box3 = calculateBox3(data, positions);

  // Compute box1 taxable income early so we can form the verzamelinkomen for AHK
  const _ewEffect    = eigenwoningEffect(woon, personal.taxYear, hypResults);
  const _grossInc    = income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;
  const _box1Taxable = Math.max(0, _grossInc + _ewEffect - income.pensionContributions);
  // Verzamelinkomen = box1 belastbaar inkomen + box3 fictief rendement (box2 = €0 in this app)
  const verzamelinkomen = _box1Taxable + Math.max(0, box3.fictitiousReturn);

  const box1      = calculateBox1(data, verzamelinkomen, hypResults);
  const toeslagen = calculateToeslagen(data, box1, box3);
  const totalTax  = Math.max(0, box1.netTax + box3.netTax);

  let maandWoonlast = 0;
  if (woon.woningType === 'hypotheek') {
    for (let i = 0; i < woon.hypotheken.length; i++) {
      if (woon.hypotheken[i].leningBedrag > 0) {
        maandWoonlast += hypResults[i].maandlast;
      }
    }
  } else if (woon.woningType === 'huur') {
    maandWoonlast = woon.maandhuur;
  }
  const totalWoonlasten = (maandWoonlast + woon.gwe + woon.vve + woon.overig) * 12;

  const totalExpenses =
    (expenses.groceries + expenses.transport + expenses.insurance +
     expenses.healthcare + expenses.education + expenses.leisure +
     expenses.phone + expenses.other) * 12 + totalWoonlasten;

  const annualSavings      = savings.monthlySavingsContribution * 12;
  const annualInvestments  = savings.maandelijksBeleggen * 12;
  const grossIncome   = _grossInc;

  let portfolioCurrentValue = 0;
  for (const p of positions) portfolioCurrentValue += p.currentValue;
  const portfolioJan1Value = 0;

  const gainLoss = calcRealisedGain(portfolio.holdings, portfolio.transactions);

  const bankData = data.bankData ?? { spaarrekeningen: [], betaalrekeningen: [] };

  let actualSavingsInterest = 0;
  let totalSavingsBalance   = 0;
  for (const a of bankData.spaarrekeningen) {
    actualSavingsInterest += a.saldoHuidig * (a.rentePercentage / 100);
    totalSavingsBalance   += a.saldoHuidig;
  }
  for (const a of bankData.betaalrekeningen) totalSavingsBalance += a.saldoHuidig;

  let hypotheekRestschuld = 0;
  for (const r of hypResults) hypotheekRestschuld += r.restschuldBegin;

  // Single pass over afschrijvingen items — was previously 2× flatMap + 2× reduce
  const rate    = data.afschrijvingen.rentePercentage / 100;
  const today   = new Date();
  let afschrijvingenActueel     = 0;
  let afschrijvingenJaarDeposit = 0;
  for (const cat of data.afschrijvingen.categorieen) {
    for (const item of cat.items) {
      afschrijvingenActueel     += gereserveerdTotDatum(item, rate, today);
      afschrijvingenJaarDeposit += jaarDeposit(item, rate, personal.taxYear);
    }
  }

  // DUO repayment: income-based annual payment, only for loans currently in repayment phase
  const isPartner = personal.filingStatus === 'partner';
  const taxYear   = personal.taxYear;
  const duoInRepayment = schulden.duo.some(d => {
    if (!d.bedrag) return false;
    const aflossStart = d.aflossingsStartJaar ?? d.startJaar;
    return taxYear >= aflossStart && taxYear < aflossStart + d.looptijd;
  });
  const duoJaarbetaling = duoInRepayment
    ? berekenDuoJaarbetaling(grossIncome, isPartner)
    : 0;

  // DUO lending inflow: monthly loan disbursement received (non-taxable cash inflow)
  const duoLeningJaar = (income.duoLening ?? 0) * 12;

  // Schenkbelasting — single pass (must be before netDisposableIncome)
  const schenkItems = data.schenkingen?.schenkingen ?? [];
  let schenkbelasting   = 0;
  let schenkNetOntvangen = 0;
  for (const item of schenkItems) {
    const c = berekenSchenking(item, personal.taxYear);
    schenkbelasting    += c.belasting;
    schenkNetOntvangen += c.netOntvangen;
  }

  const netDisposableIncome =
    grossIncome - totalTax + toeslagen.total - totalExpenses
    - annualSavings - annualInvestments
    - duoJaarbetaling - afschrijvingenJaarDeposit + duoLeningJaar
    + schenkNetOntvangen - schenkbelasting;

  const wozAsset = woon.woningType === 'hypotheek' ? (woon.wozWaarde ?? 0) : 0;

  let totalSchulden = 0;
  for (const d of schulden.duo)         totalSchulden += d.bedrag;
  for (const d of schulden.beleggingen) totalSchulden += d.bedrag;

  const currentNetWorth =
    totalSavingsBalance + portfolioCurrentValue + wozAsset
    - totalSchulden - hypotheekRestschuld - afschrijvingenActueel;

  return {
    box1, box3, toeslagen, totalTax, netDisposableIncome, totalExpenses,
    annualSavings, annualInvestments, portfolioCurrentValue, portfolioJan1Value,
    portfolioGainLoss: gainLoss, actualSavingsInterest, currentNetWorth, wozAsset, hypotheekRestschuld, afschrijvingenActueel,
    duoJaarbetaling, duoLeningJaar, afschrijvingenJaarDeposit,
    schenkbelasting, schenkNetOntvangen,
  };
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function fmt(n: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}
