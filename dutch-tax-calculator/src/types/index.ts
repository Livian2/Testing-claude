export type AssetType = 'savings' | 'stocks' | 'etf' | 'bonds' | 'realEstate' | 'crypto' | 'other';
export type TransactionType = 'buy' | 'sell';
export type FilingStatus = 'single' | 'partner';

export interface SavingsAccount {
  id: string;
  name: string;
  balanceJan1: number;
  interestRate: number;   // actual rate %, for informational display
}

export interface Holding {
  id: string;
  name: string;
  type: AssetType;
  valueJan1: number;    // Value on 1 January (Box 3 reference date)
  quantity: number;
  pricePerUnit: number;
  broker: string;
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
  totalAssets: number;
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

export interface TaxResult {
  box1: Box1Result;
  box3: Box3Result;
  totalTax: number;
  netDisposableIncome: number;
  totalExpenses: number;      // annual
  annualSavings: number;
  portfolioCurrentValue: number;
  portfolioGainLoss: number;
  actualSavingsInterest: number;
}

// Computed portfolio position after applying transactions
export interface Position {
  name: string;
  type: AssetType;
  broker: string;
  quantity: number;
  avgCost: number;
  currentValue: number;
}
