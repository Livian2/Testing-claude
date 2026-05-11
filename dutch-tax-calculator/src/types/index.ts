export type AssetType = 'savings' | 'stocks' | 'etf' | 'bonds' | 'realEstate' | 'crypto' | 'other';
export type TransactionType = 'buy' | 'sell';
export type FilingStatus = 'single' | 'partner';
export type WoningType = 'huur' | 'hypotheek';
export type HypotheekType = 'lineair' | 'aflossingsvrijij' | 'annuiteit';
export type DuoType = 'sf15' | 'sf35';

export interface Holding {
  id: string;
  name: string;
  type: AssetType;
  quantity: number;
  pricePerUnit: number;    // purchase price, EUR
  broker: string;
  ticker: string;
  isin?: string;               // ISIN for auto-resolution to Yahoo ticker
  currentPrice: number;        // EUR-equivalent fetched price (0 = not yet fetched)
  currentPriceLocal?: number;  // original currency price from exchange
  currentCurrency?: string;    // original currency (USD, GBP, GBp, …)
  currentRate?: number;        // exchange rate used: 1 local = currentRate EUR
  fetchedAt?: string;          // ISO timestamp of last fetch
  dividendPerShareEur?: number; // annual dividend per share in EUR (undefined = no div)
  dividendYield?: number;       // decimal, e.g. 0.025 = 2.5%
  exDivDate?: string | null;    // ISO date of next/last ex-dividend date
  divPayDate?: string | null;   // ISO date of next/last payment date
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
  extraAflossingMaandelijks?: number;  // extra monthly repayment paid on the 15th
}

export interface WoonData {
  woningType: WoningType;
  maandhuur: number;
  hypotheken: HypotheekData[];
  wozWaarde: number;
  gwe: number;
  vve: number;
  overig: number;
  huurtoeslagEnabled?: boolean;
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
  maandelijksBeleggen: number;
}

// ---- Bank accounts (current balances, for net worth) ----

export interface BankSpaarRekening {
  id: string;
  naam: string;
  instelling: string;
  saldoHuidig: number;
  rentePercentage: number;
}

export interface BankBetaalRekening {
  id: string;
  naam: string;
  instelling: string;
  saldoHuidig: number;
}

export interface BankData {
  spaarrekeningen: BankSpaarRekening[];
  betaalrekeningen: BankBetaalRekening[];
}

export interface PortfolioData {
  holdings: Holding[];
  transactions: Transaction[];
}

export interface SchuldItem {
  id: string;
  label: string;
  bedrag: number;             // restschuld / outstanding balance (Box 3 value)
  rentePercentage: number;    // annual interest rate %
  looptijd: number;           // total loan duration in years
  rentevastePeriode: number;  // fixed-rate period in years
  startJaar: number;          // year interest starts accruing
  leningStartJaar?: number;   // year loan was taken out (before interest, DUO only)
  aflossingsStartJaar?: number; // year repayment starts (DUO grace period support)
  duoType?: DuoType;          // SF15 (≤2015 stelsel, 15 jr) or SF35 (nieuw stelsel, 35 jr)
}

export interface PrognoseConfig {
  rendementBeleggingen: number; // % e.g. 7.0
  spaarrente: number;           // % e.g. 2.0
  jaren: number;                // 10, 20, or 30
  inkomensstijging: number;     // % annual income growth for DUO simulation, e.g. 2.0
}

export interface SchuldenData {
  duo: SchuldItem[];
  beleggingen: SchuldItem[];
}

export interface PersonalData {
  filingStatus: FilingStatus;
  taxYear: number;
  age: number;
}

// ---- Afschrijvingen ----

export interface AfschrijvingItem {
  id: string;
  naam: string;
  aankoopprijs: number;
  aankoopdatum: string;   // YYYY-MM-DD
  looptijdJaren: number;
}

export interface AfschrijvingCategorie {
  id: string;
  naam: string;
  items: AfschrijvingItem[];
}

export interface AfschrijvingenData {
  rentePercentage: number;  // savings rate used for sinking fund, e.g. 4.0
  categorieen: AfschrijvingCategorie[];
}

export interface TaxFormData {
  personal: PersonalData;
  woon: WoonData;
  waardes: WaardesData;
  income: IncomeData;
  expenses: ExpensesData;
  savings: SavingsData;
  bankData: BankData;
  schulden: SchuldenData;
  portfolio: PortfolioData;
  afschrijvingen: AfschrijvingenData;
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
  afschrijvingenGereserveerd: number;
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
  hypotheekrenteaftrek: number;  // tax saving from HRA, not included in total
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
  afschrijvingenActueel: number;
  duoJaarbetaling: number;
  afschrijvingenJaarDeposit: number;
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
