import type {
  TaxFormData, TaxResult, Box1Result, Box3Result, Toeslagen,
  Holding, Transaction, Position, AssetType,
} from '../types';

// ─── 2025 Tax Parameters ───────────────────────────────────────────────────

const BOX1_BRACKETS_2025 = [
  { limit: 38441,    rate: 0.3582 },
  { limit: 76817,    rate: 0.3748 },
  { limit: Infinity, rate: 0.4950 },
];

function calcAlgemeneHeffingskorting(taxableIncome: number): number {
  if (taxableIncome <= 24813) return 3362;
  if (taxableIncome <= 75518)
    return Math.max(0, 3362 - (taxableIncome - 24813) * (3362 / (75518 - 24813)));
  return 0;
}

function calcArbeidskorting(employmentIncome: number): number {
  if (employmentIncome <= 0)      return 0;
  if (employmentIncome <= 11490)  return Math.round(employmentIncome * 0.08231);
  if (employmentIncome <= 24820)  return 945  + Math.round((employmentIncome - 11490) * 0.29861);
  if (employmentIncome <= 39957)  return 3927 + Math.round((employmentIncome - 24820) * 0.03085);
  if (employmentIncome <= 124935) return 4394 - Math.round((employmentIncome - 39957) * 0.06510);
  return 0;
}

// ─── Box 1 ─────────────────────────────────────────────────────────────────

export function calculateBox1(data: TaxFormData): Box1Result {
  const { income } = data;

  const totalGrossIncome =
    income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;
  const deductions      = income.mortgageInterestDeduction + income.pensionContributions;
  const taxableIncome   = Math.max(0, totalGrossIncome - deductions);

  let grossTax = 0;
  let remaining = taxableIncome;
  const brackets: Box1Result['brackets'] = [];
  let prev = 0;

  for (const b of BOX1_BRACKETS_2025) {
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

const BOX3_RATES_2025 = { savings: 0.0144, investments: 0.0588, debtRate: 0.0262 };
const BOX3_TAX_RATE          = 0.36;
const BOX3_DEBT_THRESHOLD    = 3400;
const BOX3_EXEMPTION_SINGLE  = 57000;
const BOX3_EXEMPTION_PARTNER = 114000;

export function calculateBox3(data: TaxFormData): Box3Result {
  const { savings, portfolio, personal } = data;
  const isPartner   = personal.filingStatus === 'partner';
  const exemption   = isPartner ? BOX3_EXEMPTION_PARTNER : BOX3_EXEMPTION_SINGLE;
  const threshold   = isPartner ? BOX3_DEBT_THRESHOLD * 2 : BOX3_DEBT_THRESHOLD;

  const totalBankSavings = savings.accounts.reduce((s, a) => s + a.balanceJan1, 0);

  let savingsFromHoldings = 0;
  let investmentsFromHoldings = 0;
  for (const h of portfolio.holdings) {
    if (h.type === 'savings') savingsFromHoldings  += h.valueJan1;
    else                      investmentsFromHoldings += h.valueJan1;
  }

  const totalSavings     = totalBankSavings + savingsFromHoldings;
  const totalInvestments = investmentsFromHoldings;
  const totalAssets      = totalSavings + totalInvestments;

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

  const savingsFictitious     = taxableSavings     * BOX3_RATES_2025.savings;
  const investmentsFictitious = taxableInvestments * BOX3_RATES_2025.investments;
  const debtsFictitious       = totalDebts         * BOX3_RATES_2025.debtRate;

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

// ─── Toeslagen 2025 (indicatief) ───────────────────────────────────────────
// Zorgtoeslag 2025: max €1.851 (single) / €3.155 (partner)
// Huurtoeslag 2025: alleen huurders, vereenvoudigd

export function calculateToeslagen(data: TaxFormData, box1: Box1Result, box3: Box3Result): Toeslagen {
  const { personal } = data;
  const isPartner = personal.filingStatus === 'partner';

  // Toetsingsinkomen = Box1 verzamelinkomen + Box3 fictief rendement
  const toetsingsinkomen = box1.taxableIncome + Math.max(0, box3.fictitiousReturn);

  // ── Zorgtoeslag ──────────────────────────────────────────────────────────
  // Drempelinkomen 2025 (enkelvoudig)
  const ZORG_DREMPEL        = 23618;
  const ZORG_MAX_SINGLE     = 1851;
  const ZORG_MAX_PARTNER    = 3155;
  const ZORG_LIMIT_SINGLE   = 37355;
  const ZORG_LIMIT_PARTNER  = 47368;

  let zorgtoeslag = 0;
  const zorgMax   = isPartner ? ZORG_MAX_PARTNER : ZORG_MAX_SINGLE;
  const zorgLimit = isPartner ? ZORG_LIMIT_PARTNER : ZORG_LIMIT_SINGLE;

  if (toetsingsinkomen < zorgLimit) {
    const afbouw = Math.max(0, toetsingsinkomen - ZORG_DREMPEL);
    const rate   = zorgMax / (zorgLimit - ZORG_DREMPEL);
    zorgtoeslag  = Math.max(0, zorgMax - afbouw * rate);
  }

  // ── Huurtoeslag ─────────────────────────────────────────────────────────
  // Vereenvoudigd voor eenpersoonshuishouden 30+
  // Aftoppingsgrens 2025: €648.52/maand, normhuur: €635.05/maand
  // Maximale huurgrens: €900/maand (benaderd)
  const NORM_HUUR       = 635.05 * 12;    // 7.620/jaar
  const AFTOPPING_HUUR  = 648.52 * 12;    // 7.782/jaar
  const MAX_HUUR        = 900 * 12;        // 10.800/jaar
  const HUUR_LIMIT      = isPartner ? 47_000 : 31_340;
  const HUUR_DREMPEL    = 17_000;

  let huurtoeslag = 0;
  const jaarHuur = personal.monthlyRent * 12;

  if (
    personal.livingType === 'huur' &&
    jaarHuur > 0 &&
    jaarHuur <= MAX_HUUR &&
    toetsingsinkomen <= HUUR_LIMIT
  ) {
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
    if (h.type === 'savings') continue;
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
      map.set(tx.holdingName, {
        ...pos,
        broker: tx.broker || pos.broker,
        quantity: totalQty,
        avgCost: totalQty > 0 ? totalCost / totalQty : 0,
      });
    } else {
      map.set(tx.holdingName, {
        ...pos,
        broker: tx.broker || pos.broker,
        quantity: Math.max(0, pos.quantity - tx.quantity),
      });
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
  for (const h of holdings) {
    if (h.type !== 'savings') map.set(h.name, { quantity: h.quantity, avgCost: h.pricePerUnit });
  }

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

  const { expenses, savings, income } = data;
  const totalExpenses =
    (expenses.housing + expenses.groceries + expenses.utilities + expenses.transport +
     expenses.insurance + expenses.healthcare + expenses.education + expenses.leisure +
     expenses.other) * 12;

  const annualSavings = savings.monthlySavingsContribution * 12;

  const grossIncome =
    income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;
  const netDisposableIncome = grossIncome - totalTax + toeslagen.total - totalExpenses;

  const positions = computePositions(data.portfolio.holdings, data.portfolio.transactions);

  // Current value uses fetched price; Jan1 value is tax base
  const portfolioCurrentValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const portfolioJan1Value    = data.portfolio.holdings
    .filter(h => h.type !== 'savings')
    .reduce((s, h) => s + h.valueJan1, 0);

  const gainLoss = calcRealisedGain(data.portfolio.holdings, data.portfolio.transactions);

  const actualSavingsInterest = savings.accounts.reduce(
    (s, a) => s + a.balanceJan1 * (a.interestRate / 100), 0,
  );

  const totalSavingsBalance = savings.accounts.reduce((s, a) => s + a.balanceJan1, 0);
  const currentNetWorth     = totalSavingsBalance + portfolioCurrentValue - data.portfolio.investmentDebts - data.portfolio.duoDebt;

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
