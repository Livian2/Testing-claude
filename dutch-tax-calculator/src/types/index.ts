export type AssetType = 'savings' | 'stocks' | 'etf' | 'bonds' | 'realEstate' | 'crypto' | 'other';
export type TransactionType = 'buy' | 'sell';
export type FilingStatus = 'single' | 'partner';

export interface Holding {
  id: string;
  name: string;
  type: AssetType;
  valueJan1: number;   // Value on 1 January (Box 3 reference date)
  quantity: number;
  pricePerUnit: number;
}

export interface Transaction {
  id: string;
  holdingName: string;
  type: TransactionType;
  date: string;
  quantity: number;
  pricePerUnit: number;
}

export interface IncomeData {
  grossSalary: number;
  freelanceIncome: number;
  rentalIncome: number;            // Box 1 rental (not Box 3 investment property)
  otherBox1Income: number;
  mortgageInterestDeduction: number;
  pensionContributions: number;    // aftrekbare lijfrentepremies
}

export interface ExpensesData {
  housing: number;         // rent or mortgage payment (not deductible in Box 1 unless mortgage interest)
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
  bankSavingsJan1: number;       // Bank savings balance on 1 Jan
  bankSavingsDec31: number;      // Bank savings balance on 31 Dec
  monthlySavingsContribution: number;
}

export interface PortfolioData {
  holdings: Holding[];
  transactions: Transaction[];
  investmentDebts: number;       // Schulden Box 3 (loans for investments)
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
  totalExpenses: number;
  annualSavings: number;
  portfolioCurrentValue: number;
  portfolioGainLoss: number;
}
