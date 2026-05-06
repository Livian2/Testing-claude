import type {
  TaxFormData, TaxResult, Box1Result, Box3Result, Holding, Transaction,
} from '../types';

// ─── 2025 Tax Parameters ───────────────────────────────────────────────────

const BOX1_BRACKETS_2025 = [
  { limit: 38441,  rate: 0.3582 },
  { limit: 76817,  rate: 0.3748 },
  { limit: Infinity, rate: 0.4950 },
];

// Algemene heffingskorting 2025
function calcAlgemeneHeffingskorting(taxableIncome: number): number {
  if (taxableIncome <= 24813)  return 3362;
  if (taxableIncome <= 75518)  return Math.max(0, 3362 - ((taxableIncome - 24813) * (3362 / (75518 - 24813))));
  return 0;
}

// Arbeidskorting 2025 (employment tax credit, only for employment income)
function calcArbeidskorting(employmentIncome: number): number {
  if (employmentIncome <= 0)     return 0;
  if (employmentIncome <= 11490) return Math.round(employmentIncome * 0.08231);
  if (employmentIncome <= 24820) return 945 + Math.round((employmentIncome - 11490) * 0.29861);
  if (employmentIncome <= 39957) return 3927 + Math.round((employmentIncome - 24820) * 0.03085);
  if (employmentIncome <= 124935) return 4394 - Math.round((employmentIncome - 39957) * 0.06510);
  return 0;
}

// ─── Box 1 ─────────────────────────────────────────────────────────────────

export function calculateBox1(data: TaxFormData): Box1Result {
  const { income } = data;

  const totalGrossIncome =
    income.grossSalary +
    income.freelanceIncome +
    income.rentalIncome +
    income.otherBox1Income;

  const deductions =
    income.mortgageInterestDeduction +
    income.pensionContributions;

  const taxableIncome = Math.max(0, totalGrossIncome - deductions);

  // Progressive tax calculation
  let grossTax = 0;
  let remaining = taxableIncome;
  const brackets: Box1Result['brackets'] = [];
  let previousLimit = 0;

  for (const bracket of BOX1_BRACKETS_2025) {
    const bracketSize = bracket.limit - previousLimit;
    const base = Math.min(remaining, bracketSize);
    const tax = base * bracket.rate;
    if (base > 0) brackets.push({ rate: bracket.rate, base, tax });
    grossTax += tax;
    remaining -= base;
    previousLimit = bracket.limit;
    if (remaining <= 0) break;
  }

  const algemeneHeffingskorting = calcAlgemeneHeffingskorting(taxableIncome);
  const arbeidskorting = calcArbeidskorting(income.grossSalary + income.freelanceIncome);

  const netTax = Math.max(0, grossTax - algemeneHeffingskorting - arbeidskorting);
  const effectiveRate = taxableIncome > 0 ? netTax / taxableIncome : 0;

  return { taxableIncome, grossTax, algemeneHeffingskorting, arbeidskorting, netTax, effectiveRate, brackets };
}

// ─── Box 3 ─────────────────────────────────────────────────────────────────

// 2025 fictitious return rates (rechtsherstel/overgangswetgeving)
const BOX3_RATES_2025 = {
  savings:     0.0144,  // bank savings
  investments: 0.0588,  // overige bezittingen (stocks, ETF, real estate, crypto, etc.)
  debtRate:    0.0262,  // schulden (deductible at this rate)
};

const BOX3_TAX_RATE = 0.36;
const BOX3_EXEMPTION_SINGLE  = 57000;
const BOX3_EXEMPTION_PARTNER = 114000;

function holdingIsSavings(h: Holding): boolean {
  return h.type === 'savings';
}

export function calculateBox3(data: TaxFormData): Box3Result {
  const { savings, portfolio, personal } = data;
  const isPartner = personal.filingStatus === 'partner';
  const exemption = isPartner ? BOX3_EXEMPTION_PARTNER : BOX3_EXEMPTION_SINGLE;

  // Total bank savings (average Jan1 + Dec31 / 2 approximation)
  const bankSavings = (savings.bankSavingsJan1 + savings.bankSavingsDec31) / 2;

  // Portfolio holdings classified by type
  let savingsFromHoldings = 0;
  let investmentsFromHoldings = 0;

  for (const h of portfolio.holdings) {
    if (holdingIsSavings(h)) {
      savingsFromHoldings += h.valueJan1;
    } else {
      investmentsFromHoldings += h.valueJan1;
    }
  }

  const totalSavings = bankSavings + savingsFromHoldings;
  const totalInvestments = investmentsFromHoldings;
  const totalAssets = totalSavings + totalInvestments;
  const totalDebts = Math.min(portfolio.investmentDebts, totalAssets - 3400); // €3,400 debt threshold

  const netWealth = Math.max(0, totalAssets - Math.max(0, totalDebts));
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

  // Proportional split of taxable wealth between savings and investments
  const savingsShare = totalAssets > 0 ? totalSavings / totalAssets : 0;
  const investShare  = totalAssets > 0 ? totalInvestments / totalAssets : 0;

  const taxableSavings     = taxableWealth * savingsShare;
  const taxableInvestments = taxableWealth * investShare;

  const savingsFictitious     = taxableSavings * BOX3_RATES_2025.savings;
  const investmentsFictitious = taxableInvestments * BOX3_RATES_2025.investments;
  const debtsFictitious       = Math.max(0, totalDebts) * BOX3_RATES_2025.debtRate;

  const fictitiousReturn = savingsFictitious + investmentsFictitious - debtsFictitious;
  const grossTax = Math.max(0, fictitiousReturn * BOX3_TAX_RATE);
  const netTax = grossTax; // No separate korting on Box 3

  return {
    totalAssets, totalDebts, netWealth, exemption, taxableWealth,
    fictitiousReturn, grossTax, heffingskortingBox3: 0, netTax,
    breakdown: {
      savings: totalSavings, investments: totalInvestments, debts: totalDebts,
      savingsFictitious, investmentsFictitious, debtsFictitious,
    },
  };
}

// ─── Portfolio value ────────────────────────────────────────────────────────

export function calcPortfolioCurrentValue(
  holdings: Holding[],
  transactions: Transaction[],
): { currentValue: number; costBasis: number; gainLoss: number } {
  type Position = { quantity: number; avgCost: number };
  const positions = new Map<string, Position>();

  for (const h of holdings) {
    if (h.type !== 'savings') {
      positions.set(h.name, { quantity: h.quantity, avgCost: h.pricePerUnit });
    }
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let realisedGain = 0;

  for (const tx of sorted) {
    const pos = positions.get(tx.holdingName) ?? { quantity: 0, avgCost: 0 };
    if (tx.type === 'buy') {
      const totalQty  = pos.quantity + tx.quantity;
      const totalCost = pos.quantity * pos.avgCost + tx.quantity * tx.pricePerUnit;
      positions.set(tx.holdingName, { quantity: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 });
    } else {
      realisedGain += tx.quantity * (tx.pricePerUnit - pos.avgCost);
      positions.set(tx.holdingName, { quantity: Math.max(0, pos.quantity - tx.quantity), avgCost: pos.avgCost });
    }
  }

  let currentValue = 0;
  let costBasis = 0;
  for (const pos of positions.values()) {
    currentValue += pos.quantity * pos.avgCost;
    costBasis    += pos.quantity * pos.avgCost;
  }
  // Approximate current value = cost basis + unrealised (we use cost basis as proxy since no live prices)
  const gainLoss = realisedGain;

  return { currentValue, costBasis, gainLoss };
}

// ─── Full calculation ───────────────────────────────────────────────────────

export function calculateTaxes(data: TaxFormData): TaxResult {
  const box1 = calculateBox1(data);
  const box3 = calculateBox3(data);

  const totalTax = box1.netTax + box3.netTax;

  const { expenses, savings, income } = data;
  const totalExpenses =
    expenses.housing + expenses.groceries + expenses.utilities +
    expenses.transport + expenses.insurance + expenses.healthcare +
    expenses.education + expenses.leisure + expenses.other;

  const annualSavings = savings.monthlySavingsContribution * 12;

  const grossIncome =
    income.grossSalary + income.freelanceIncome + income.rentalIncome + income.otherBox1Income;

  const netDisposableIncome = grossIncome - totalTax - totalExpenses;

  const { currentValue, gainLoss } = calcPortfolioCurrentValue(
    data.portfolio.holdings, data.portfolio.transactions,
  );

  return {
    box1, box3, totalTax, netDisposableIncome, totalExpenses,
    annualSavings, portfolioCurrentValue: currentValue, portfolioGainLoss: gainLoss,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function fmt(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}
