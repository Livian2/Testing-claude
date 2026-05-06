export type AssetType = 'savings' | 'stocks' | 'etf' | 'bonds' | 'realEstate' | 'crypto' | 'other';
export type TransactionType = 'buy' | 'sell';
export type FilingStatus = 'single' | 'partner';
export type LivingType = 'huur' | 'koop' | 'anders';

export interface SavingsAccount {
  id: string;
  name: string;
  balanceJan1: number;
  interestRate: number;
}

export interface Holding {
  id: string;
  name: string;
  type: AssetType;
  valueJan1: number;      // Value on 1 January — Box 3 tax base
  quantity: number;
  pricePerUnit: number;   // Purchase / reference price
  broker: string;
  ticker: string;         // Yahoo Finance symbol, e.g. VWCE.AS
  currentPrice: number;   // Last fetched market price (0 = not fetched)
}

export interface Transaction {
  id: string;
  holdingName: string;
  type: TransactionType;
  date: string;
  quantity: number;
  pricePerUnit: number;
  broker: string;
}

export interface IncomeData {
  grossSalary: number;
  freelanceIncome: number;
  rentalIncome: number;
  otherBox1Income: number;
  mortgageInterestDeduction: number;
  pensionContributions: number;
}

export interface ExpensesData {
  housing: number;      // per month
  groceries: number;
  utilities: number;
  transport: number;
  insurance: number;
  healthcare: number;
  education: number;
  leisure: number;
  other: number;
}

export interface SavingsData {
  accounts: SavingsAccount[];
  monthlySavingsContribution: number;
}

export interface PortfolioData {
  holdings: Holding[];
  transactions: Transaction[];
  investmentDebts: number;
  duoDebt: number;
}

export interface PersonalData {
  filingStatus: FilingStatus;
  taxYear: number;
  age: number;
  livingType: LivingType;
  monthlyRent: number;    // used when livingType === 'huur'
}

export interface TaxFormData {
  personal: PersonalData;
  income: IncomeData;
  expenses: ExpensesData;
  savings: SavingsData;
  portfolio: PortfolioData;
}

// ---- Results ----
export interface Box1Result {
  taxableIncome: number;
  grossTax: number;
  algemeneHeffingskorting: number;
  arbeidskorting: number;
  netTax: number;
  effectiveRate: number;
  brackets: { rate: number; base: number; tax: number }[];
}

export interface Box3Result {
  totalAssets: number;          // Jan 1 tax base
  totalDebts: number;
  netWealth: number;
  exemption: number;
  taxableWealth: number;
  fictitiousReturn: number;
  grossTax: number;
  heffingskortingBox3: number;
  netTax: number;
  breakdown: {
    savings: number;
    investments: number;
    debts: number;
    savingsFictitious: number;
    investmentsFictitious: number;
    debtsFictitious: number;
  };
}

export interface Toeslagen {
  zorgtoeslag: number;
  huurtoeslag: number;
  total: number;
}

export interface TaxResult {
  box1: Box1Result;
  box3: Box3Result;
  toeslagen: Toeslagen;
  totalTax: number;
  netDisposableIncome: number;
  totalExpenses: number;
  annualSavings: number;
  portfolioCurrentValue: number;  // based on currentPrice when fetched
  portfolioJan1Value: number;     // based on valueJan1 (Box 3 tax base)
  portfolioGainLoss: number;
  actualSavingsInterest: number;
  currentNetWorth: number;        // current market value of all assets
}

export interface Position {
  name: string;
  type: AssetType;
  broker: string;
  ticker: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;   // 0 if not fetched
  currentValue: number;   // quantity × (currentPrice || avgCost)
}
