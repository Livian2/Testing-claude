import type {
  TaxFormData, TaxResult, Box1Result, Box3Result, Toeslagen,
  Holding, Transaction, Position, AssetType,
} from '../types';
import { berekenHypotheek } from './hypotheek';
import { totalAfschrijvingenGereserveerd, gereserveerdTotNu } from './afschrijvingen';

// ─── 2026 Tax Parameters ───────────────────────────────────────────────────
// Source: Belastingdienst.nl tabellen 2026 (vastgesteld)

const BOX1_BRACKETS_2026 = [
  { limit: 38441,    rate: 0.3582 },
  { limit: 78426,    rate: 0.3748 },
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

// verzamelinkomen is passed in from calculateTaxes (box1 + box3 fictitious return)
// so the AHK afbouw uses the correct grondslag. Falls back to box1 taxableIncome if omitted.
export function calculateBox1(data: TaxFormData, verzamelinkomen?: number): Box1Result {
  const { income, woon, personal } = data;

  // Sum mortgage interest deduction from all hypotheken
  let mortgageInterestDeduction = 0;
  if (woon.woningType === 'hypotheek') {
    for (const hyp of woon.hypotheken) {
      if (hyp.leningBedrag > 0) {
        const b = berekenHypotheek(hyp, personal.taxYear);
        mortgageInterestDeduction += b.jaarRente;
      }
    }
  }

  const totalGrossIncome =
    income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;
  const deductions    = mortgageInterestDeduction + income.pensionContributions;
  const taxableIncome = Math.max(0, totalGrossIncome - deductions);

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

  return { taxableIncome, grossTax, algemeneHeffingskorting, arbeidskorting, netTax, effectiveRate, brackets };
}

// ─── Box 3 ─────────────────────────────────────────────────────────────────

const BOX3_RATES_2026 = { savings: 0.0103, investments: 0.0588, debtRate: 0.0262 };
const BOX3_TAX_RATE          = 0.36;
const BOX3_DEBT_THRESHOLD    = 3700;
const BOX3_EXEMPTION_SINGLE  = 57684;
const BOX3_EXEMPTION_PARTNER = 115368;

export function calculateBox3(data: TaxFormData): Box3Result {
  const { waardes, schulden, personal, afschrijvingen } = data;
  const bankData = data.bankData ?? { spaarrekeningen: [], betaalrekeningen: [] };
  const isPartner = personal.filingStatus === 'partner';
  const exemption = isPartner ? BOX3_EXEMPTION_PARTNER : BOX3_EXEMPTION_SINGLE;
  const threshold = isPartner ? BOX3_DEBT_THRESHOLD * 2 : BOX3_DEBT_THRESHOLD;

  // Savings = bankData current balances + beleggingen of type 'savings' (from Waardes 1 jan)
  const totalSavings =
    bankData.spaarrekeningen.reduce((s, a) => s + a.saldoHuidig, 0) +
    bankData.betaalrekeningen.reduce((s, a) => s + a.saldoHuidig, 0) +
    waardes.beleggingen.filter(b => b.type === 'savings').reduce((s, b) => s + b.waardeJan1, 0);

  const totalInvestments =
    waardes.beleggingen.filter(b => b.type !== 'savings').reduce((s, b) => s + b.waardeJan1, 0);

  const totalAssets = totalSavings + totalInvestments;

  // Afschrijvingen gereserveerd: earmarked replacement savings (Box 3 peildatum = Jan 1)
  const afschrijvingenGereserveerd = Math.min(
    totalAfschrijvingenGereserveerd(afschrijvingen, personal.taxYear),
    totalAssets,
  );

  const rawDebts   = [...schulden.duo, ...schulden.beleggingen].reduce((s, d) => s + d.bedrag, 0);
  const totalDebts = Math.max(0, rawDebts - threshold);

  // Subtract earmarked reserves from the Box 3 grondslag
  const adjustedAssets = Math.max(0, totalAssets - afschrijvingenGereserveerd);
  const netWealth      = Math.max(0, adjustedAssets - totalDebts);
  const taxableWealth  = Math.max(0, netWealth - exemption);

  if (taxableWealth === 0) {
    return {
      totalAssets, totalDebts, afschrijvingenGereserveerd, netWealth, exemption, taxableWealth,
      fictitiousReturn: 0, grossTax: 0, heffingskortingBox3: 0, netTax: 0,
      breakdown: {
        savings: totalSavings, investments: totalInvestments, debts: totalDebts,
        savingsFictitious: 0, investmentsFictitious: 0, debtsFictitious: 0,
      },
    };
  }

  const savingsShare = adjustedAssets > 0 ? Math.max(0, totalSavings - afschrijvingenGereserveerd) / adjustedAssets : 0;
  const investShare  = adjustedAssets > 0 ? totalInvestments / adjustedAssets : 0;

  const taxableSavings     = taxableWealth * savingsShare;
  const taxableInvestments = taxableWealth * investShare;

  const savingsFictitious     = taxableSavings     * BOX3_RATES_2026.savings;
  const investmentsFictitious = taxableInvestments * BOX3_RATES_2026.investments;
  const debtsFictitious       = totalDebts         * BOX3_RATES_2026.debtRate;

  const fictitiousReturn = savingsFictitious + investmentsFictitious - debtsFictitious;
  const grossTax         = Math.max(0, fictitiousReturn * BOX3_TAX_RATE);

  return {
    totalAssets, totalDebts, afschrijvingenGereserveerd, netWealth, exemption, taxableWealth,
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
  // Max per persoon €1.912/jr; partners ontvangen elk hun eigen toeslag (≈2×).
  // Lineaire afbouw vanaf drempelinkomen tot inkomensgrens.
  // 2026 zorgtoeslag: max €129/mnd (€1.548/jr) single, €258/mnd (€3.096/jr) partners
  // Lineair afgebouwd vanaf het eerste euro inkomen
  const ZORG_DREMPEL       = 0;
  const ZORG_MAX_SINGLE    = 1548;   // 129 × 12
  const ZORG_MAX_PARTNER   = 3096;   // 2 × 1548
  const ZORG_LIMIT_SINGLE  = 38441;
  const ZORG_LIMIT_PARTNER = 49000;

  let zorgtoeslag = 0;
  const zorgMax   = isPartner ? ZORG_MAX_PARTNER : ZORG_MAX_SINGLE;
  const zorgLimit = isPartner ? ZORG_LIMIT_PARTNER : ZORG_LIMIT_SINGLE;

  if (toetsingsinkomen < zorgLimit) {
    const afbouw = Math.max(0, toetsingsinkomen - ZORG_DREMPEL);
    const rate   = zorgMax / (zorgLimit - ZORG_DREMPEL);
    zorgtoeslag  = Math.max(0, zorgMax - afbouw * rate);
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

  return {
    zorgtoeslag: Math.round(zorgtoeslag),
    huurtoeslag: Math.round(huurtoeslag),
    total:        Math.round(zorgtoeslag + huurtoeslag),
  };
}

// ─── Portfolio positions ────────────────────────────────────────────────────

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
      quantity: h.quantity, avgCost: h.pricePerUnit, currentPrice: h.currentPrice,
    });
    if (!nameToId.has(h.name)) nameToId.set(h.name, key);
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const key = nameToId.get(tx.holdingName) ?? tx.holdingName;
    const pos = byId.get(key) ?? { name: tx.holdingName, type: 'other' as AssetType, broker: tx.broker, ticker: '', quantity: 0, avgCost: 0, currentPrice: 0 };
    if (tx.type === 'buy') {
      const totalQty  = pos.quantity + tx.quantity;
      const totalCost = pos.quantity * pos.avgCost + tx.quantity * tx.pricePerUnit;
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
  // Box 3 must be computed first: the AHK afbouw is based on verzamelinkomen (box1+box3)
  const box3 = calculateBox3(data);

  // Compute box1 taxable income early so we can form the verzamelinkomen for AHK
  const { income: _inc, woon: _woon, personal: _pers } = data;
  let _mortgageDeduction = 0;
  if (_woon.woningType === 'hypotheek') {
    for (const hyp of _woon.hypotheken) {
      if (hyp.leningBedrag > 0) _mortgageDeduction += berekenHypotheek(hyp, _pers.taxYear).jaarRente;
    }
  }
  const _grossInc       = _inc.grossSalary + _inc.freelanceIncome + _inc.rentalIncome + _inc.otherBox1Income;
  const _box1Taxable    = Math.max(0, _grossInc - _mortgageDeduction - _inc.pensionContributions);
  // Verzamelinkomen = box1 belastbaar inkomen + box3 fictief rendement (box2 = €0 in this app)
  const verzamelinkomen = _box1Taxable + Math.max(0, box3.fictitiousReturn);

  const box1      = calculateBox1(data, verzamelinkomen);
  const toeslagen = calculateToeslagen(data, box1, box3);
  const totalTax  = Math.max(0, box1.netTax + box3.netTax);

  const { expenses, savings, income, woon, personal, waardes, portfolio, schulden } = data;

  let maandWoonlast = 0;
  if (woon.woningType === 'hypotheek') {
    for (const hyp of woon.hypotheken) {
      if (hyp.leningBedrag > 0) {
        maandWoonlast += berekenHypotheek(hyp, personal.taxYear).maandlast;
      }
    }
  } else if (woon.woningType === 'huur') {
    maandWoonlast = woon.maandhuur;
  }
  const totalWoonlasten = (maandWoonlast + woon.gwe + woon.vve + woon.overig) * 12;

  const totalExpenses =
    (expenses.groceries + expenses.transport + expenses.insurance +
     expenses.healthcare + expenses.education + expenses.leisure +
     expenses.other) * 12 + totalWoonlasten;

  const annualSavings = savings.monthlySavingsContribution * 12;

  const grossIncome =
    income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;
  const netDisposableIncome = grossIncome - totalTax + toeslagen.total - totalExpenses;

  const positions = computePositions(portfolio.holdings, portfolio.transactions);

  const portfolioCurrentValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const portfolioJan1Value    = waardes.beleggingen.reduce((s, b) => s + b.waardeJan1, 0);

  const gainLoss = calcRealisedGain(portfolio.holdings, portfolio.transactions);

  const bankData = data.bankData ?? { spaarrekeningen: [], betaalrekeningen: [] };

  const actualSavingsInterest = bankData.spaarrekeningen.reduce(
    (s, a) => s + a.saldoHuidig * (a.rentePercentage / 100), 0,
  );

  const totalSavingsBalance =
    bankData.spaarrekeningen.reduce((s, a) => s + a.saldoHuidig, 0) +
    bankData.betaalrekeningen.reduce((s, a) => s + a.saldoHuidig, 0);

  const hypotheekRestschuld = woon.hypotheken.reduce(
    (s, hyp) => s + berekenHypotheek(hyp, personal.taxYear).restschuldBegin, 0,
  );

  // Current-year reserved amount (deposits through taxYear, not taxYear-1)
  const rate = data.afschrijvingen.rentePercentage / 100;
  const afschrijvingenActueel = data.afschrijvingen.categorieen
    .flatMap(c => c.items)
    .reduce((sum, item) => sum + gereserveerdTotNu(item, rate, personal.taxYear), 0);

  const currentNetWorth =
    totalSavingsBalance +
    portfolioCurrentValue -
    [...schulden.duo, ...schulden.beleggingen].reduce((s, d) => s + d.bedrag, 0) -
    hypotheekRestschuld;

  return {
    box1, box3, toeslagen, totalTax, netDisposableIncome, totalExpenses,
    annualSavings, portfolioCurrentValue, portfolioJan1Value,
    portfolioGainLoss: gainLoss, actualSavingsInterest, currentNetWorth, afschrijvingenActueel,
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
