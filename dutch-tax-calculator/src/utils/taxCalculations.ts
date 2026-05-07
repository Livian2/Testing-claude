import type {
  TaxFormData, TaxResult, Box1Result, Box3Result, Toeslagen,
  Holding, Transaction, Position, AssetType,
} from '../types';
import { berekenHypotheek } from './hypotheek';

// ─── 2026 Tax Parameters ───────────────────────────────────────────────────

const BOX1_BRACKETS_2026 = [
  { limit: 40021,    rate: 0.3582 },
  { limit: 77536,    rate: 0.3748 },
  { limit: Infinity, rate: 0.4950 },
];

function calcAlgemeneHeffingskorting(taxableIncome: number): number {
  if (taxableIncome <= 25268) return 3428;
  if (taxableIncome <= 76817)
    return Math.max(0, 3428 - (taxableIncome - 25268) * (3428 / (76817 - 25268)));
  return 0;
}

function calcArbeidskorting(employmentIncome: number): number {
  if (employmentIncome <= 0)      return 0;
  if (employmentIncome <= 11491)  return Math.round(employmentIncome * 0.08231);
  if (employmentIncome <= 25000)  return 945  + Math.round((employmentIncome - 11491) * 0.29861);
  if (employmentIncome <= 40821)  return 3986 + Math.round((employmentIncome - 25000) * 0.03085);
  if (employmentIncome <= 126834) return 4474 - Math.round((employmentIncome - 40821) * 0.06510);
  return 0;
}

// ─── Box 1 ─────────────────────────────────────────────────────────────────

export function calculateBox1(data: TaxFormData): Box1Result {
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

  const algemeneHeffingskorting = calcAlgemeneHeffingskorting(taxableIncome);
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
  const { waardes, portfolio, personal } = data;
  const isPartner = personal.filingStatus === 'partner';
  const exemption = isPartner ? BOX3_EXEMPTION_PARTNER : BOX3_EXEMPTION_SINGLE;
  const threshold = isPartner ? BOX3_DEBT_THRESHOLD * 2 : BOX3_DEBT_THRESHOLD;

  // Savings = spaarrekeningen + betaalrekeningen + beleggingen of type 'savings'
  const totalSavings =
    waardes.spaarrekeningen.reduce((s, a) => s + a.saldoJan1, 0) +
    waardes.betaalrekeningen.reduce((s, a) => s + a.saldoJan1, 0) +
    waardes.beleggingen.filter(b => b.type === 'savings').reduce((s, b) => s + b.waardeJan1, 0);

  const totalInvestments =
    waardes.beleggingen.filter(b => b.type !== 'savings').reduce((s, b) => s + b.waardeJan1, 0);

  const totalAssets = totalSavings + totalInvestments;

  const rawDebts   = portfolio.investmentDebts + portfolio.duoDebt;
  const totalDebts = Math.max(0, rawDebts - threshold);

  const netWealth     = Math.max(0, totalAssets - totalDebts);
  const taxableWealth = Math.max(0, netWealth - exemption);

  if (taxableWealth === 0) {
    return {
      totalAssets, totalDebts, netWealth, exemption, taxableWealth,
      fictitiousReturn: 0, grossTax: 0, heffingskortingBox3: 0, netTax: 0,
      breakdown: {
        savings: totalSavings, investments: totalInvestments, debts: totalDebts,
        savingsFictitious: 0, investmentsFictitious: 0, debtsFictitious: 0,
      },
    };
  }

  const savingsShare = totalAssets > 0 ? totalSavings / totalAssets : 0;
  const investShare  = totalAssets > 0 ? totalInvestments / totalAssets : 0;

  const taxableSavings     = taxableWealth * savingsShare;
  const taxableInvestments = taxableWealth * investShare;

  const savingsFictitious     = taxableSavings     * BOX3_RATES_2026.savings;
  const investmentsFictitious = taxableInvestments * BOX3_RATES_2026.investments;
  const debtsFictitious       = totalDebts         * BOX3_RATES_2026.debtRate;

  const fictitiousReturn = savingsFictitious + investmentsFictitious - debtsFictitious;
  const grossTax         = Math.max(0, fictitiousReturn * BOX3_TAX_RATE);

  return {
    totalAssets, totalDebts, netWealth, exemption, taxableWealth,
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

  const toetsingsinkomen = box1.taxableIncome + Math.max(0, box3.fictitiousReturn);

  const ZORG_DREMPEL       = 24213;
  const ZORG_MAX_SINGLE    = 1912;
  const ZORG_MAX_PARTNER   = 3261;
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

  const NORM_HUUR      = 652 * 12;
  const AFTOPPING_HUUR = 662 * 12;
  const MAX_HUUR       = 900 * 12;
  const HUUR_LIMIT     = isPartner ? 48_000 : 32_000;
  const HUUR_DREMPEL   = 17_500;

  let huurtoeslag = 0;
  const jaarHuur  = woon.woningType === 'huur' ? woon.maandhuur * 12 : 0;

  if (woon.woningType === 'huur' && jaarHuur > 0 && jaarHuur <= MAX_HUUR && toetsingsinkomen <= HUUR_LIMIT) {
    const effectiefHuur = Math.min(jaarHuur, AFTOPPING_HUUR);
    const baseToeslag   = Math.max(0, effectiefHuur - NORM_HUUR);
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
  type Pos = { type: AssetType; broker: string; ticker: string; quantity: number; avgCost: number; currentPrice: number };
  const map = new Map<string, Pos>();

  for (const h of holdings) {
    map.set(h.name, {
      type: h.type, broker: h.broker, ticker: h.ticker,
      quantity: h.quantity, avgCost: h.pricePerUnit,
      currentPrice: h.currentPrice,
    });
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const pos = map.get(tx.holdingName) ?? { type: 'other' as AssetType, broker: tx.broker, ticker: '', quantity: 0, avgCost: 0, currentPrice: 0 };
    if (tx.type === 'buy') {
      const totalQty  = pos.quantity + tx.quantity;
      const totalCost = pos.quantity * pos.avgCost + tx.quantity * tx.pricePerUnit;
      map.set(tx.holdingName, { ...pos, broker: tx.broker || pos.broker, quantity: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 });
    } else {
      map.set(tx.holdingName, { ...pos, broker: tx.broker || pos.broker, quantity: Math.max(0, pos.quantity - tx.quantity) });
    }
  }

  return Array.from(map.entries())
    .filter(([, p]) => p.quantity > 0)
    .map(([name, p]) => {
      const price        = p.currentPrice > 0 ? p.currentPrice : p.avgCost;
      const currentValue = p.quantity * price;
      return { name, type: p.type, broker: p.broker, ticker: p.ticker, quantity: p.quantity, avgCost: p.avgCost, currentPrice: p.currentPrice, currentValue };
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
  const box1      = calculateBox1(data);
  const box3      = calculateBox3(data);
  const toeslagen = calculateToeslagen(data, box1, box3);
  const totalTax  = Math.max(0, box1.netTax + box3.netTax);

  const { expenses, savings, income, woon, personal, waardes, portfolio } = data;

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

  const actualSavingsInterest = waardes.spaarrekeningen.reduce(
    (s, a) => s + a.saldoJan1 * (a.rentePercentage / 100), 0,
  );

  const totalSavingsBalance =
    waardes.spaarrekeningen.reduce((s, a) => s + a.saldoJan1, 0) +
    waardes.betaalrekeningen.reduce((s, a) => s + a.saldoJan1, 0);

  const currentNetWorth =
    totalSavingsBalance +
    (portfolioCurrentValue > 0 ? portfolioCurrentValue : portfolioJan1Value) -
    portfolio.investmentDebts - portfolio.duoDebt;

  return {
    box1, box3, toeslagen, totalTax, netDisposableIncome, totalExpenses,
    annualSavings, portfolioCurrentValue, portfolioJan1Value,
    portfolioGainLoss: gainLoss, actualSavingsInterest, currentNetWorth,
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
