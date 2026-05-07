export type AssetType = 'savings' | 'stocks' | 'etf' | 'bonds' | 'realEstate' | 'crypto' | 'other';
export type TransactionType = 'buy' | 'sell';
export type FilingStatus = 'single' | 'partner';
export type WoningType = 'huur' | 'hypotheek';
export type HypotheekType = 'lineair' | 'aflossingsvrijij' | 'annuiteit';

export interface Holding {
  id: string;
  name: string;
  type: AssetType;
  quantity: number;
  pricePerUnit: number;   // purchase / reference price
  broker: string;
  ticker: string;
  currentPrice: number;   // last fetched market price (0 = not fetched)
}

export interface Transaction {
  id: string;
  holdingName: string;
  type: TransactionType;
  date: string;
  quantity: number;
  pricePerUnit: number;
  broker: string;
  orderId?: string;   // external broker ID for deduplication
}

export interface HypotheekData {
  id: string;
  label: string;
  type: HypotheekType;
  leningBedrag: number;
  rentePercentage: number;
  rentevastePeriode: number;  // years
  looptijd: number;           // years total
  startJaar: number;
}

export interface WoonData {
  woningType: WoningType;
  maandhuur: number;
  hypotheken: HypotheekData[];
  gwe: number;
  vve: number;
  overig: number;
}

// ---- Waardes 1 januari (Box 3 grondslag) ----

export interface BeleggingRekening {
  id: string;
  naam: string;
  broker: string;
  type: AssetType;
  waardeJan1: number;
}

export interface SpaarRekening {
  id: string;
  naam: string;
  instelling: string;
  saldoJan1: number;
  rentePercentage: number;
}

export interface BetaalRekening {
  id: string;
  naam: string;
  instelling: string;
  saldoJan1: number;
}

export interface WaardesData {
  beleggingen: BeleggingRekening[];
  spaarrekeningen: SpaarRekening[];
  betaalrekeningen: BetaalRekening[];
}

export interface IncomeData {
  grossSalary: number;
  freelanceIncome: number;
  rentalIncome: number;
  otherBox1Income: number;
  pensionContributions: number;
}

export interface ExpensesData {
  groceries: number;
  transport: number;
  insurance: number;
  healthcare: number;
  education: number;
  leisure: number;
  other: number;
}

export interface SavingsData {
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
  woon: WoonData;
  waardes: WaardesData;
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
  portfolioCurrentValue: number;
  portfolioJan1Value: number;
  portfolioGainLoss: number;
  actualSavingsInterest: number;
  currentNetWorth: number;
}

export interface Position {
  name: string;
  type: AssetType;
  broker: string;
  ticker: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
}
