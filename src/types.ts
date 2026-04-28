export type AssetType =
  | "Equities"
  | "Funds / ETFs"
  | "Bonds"
  | "Cash holdings"
  | "Crypto"
  | "Commodities"
  | "Other";

export type InvestmentFrequency =
  | "One-time"
  | "Monthly"
  | "Quarterly"
  | "Semi-annually"
  | "Annually";

export type DividendTreatment = "Reinvest dividends" | "Take dividends as cash";

export type ScenarioName = "pessimistic" | "base" | "optimistic";

export interface Investment {
  id: string;
  name: string;
  type: AssetType;
  annualReturn: number;
  amount: number;
  frequency: InvestmentFrequency;
  dividendYield: number;
  dividendTreatment: DividendTreatment;
  annualContributionIncrease: number;
  taxRate: number;
  expenseRatio: number;
  volatility: number;
  color: string;
}

export interface ProjectionSettings {
  currentAge: number;
  startDate: string;
  endDate: string;
  inflationRate: number;
  targetAmount: number;
  scenario: ScenarioName;
  viewMode: "nominal" | "inflationAdjusted";
  darkMode: boolean;
}

export interface MonthlyInvestmentSnapshot {
  investmentId: string;
  name: string;
  type: AssetType;
  contribution: number;
  dividend: number;
  fees: number;
  taxes: number;
  value: number;
  inflationAdjustedValue: number;
  cumulativeContributions: number;
  cumulativeDividends: number;
  cumulativeFees: number;
  cumulativeTaxes: number;
  cumulativeGains: number;
}

export interface MonthlyPortfolioSnapshot {
  monthIndex: number;
  date: string;
  age: number;
  contributions: number;
  dividends: number;
  fees: number;
  taxes: number;
  totalValue: number;
  inflationAdjustedValue: number;
  cumulativeContributions: number;
  cumulativeDividends: number;
  cumulativeFees: number;
  cumulativeTaxes: number;
  cumulativeGains: number;
  byInvestment: MonthlyInvestmentSnapshot[];
}

export interface InvestmentSummary {
  investmentId: string;
  name: string;
  type: AssetType;
  endingValue: number;
  inflationAdjustedEndingValue: number;
  totalContributed: number;
  totalDividends: number;
  totalFees: number;
  totalTaxes: number;
  totalGainLoss: number;
  cagr: number | null;
  irr: number | null;
}

export interface PortfolioSummary {
  totalContributed: number;
  endingValue: number;
  inflationAdjustedEndingValue: number;
  totalGainLoss: number;
  totalDividends: number;
  totalFees: number;
  totalTaxes: number;
  cagr: number | null;
  irr: number | null;
  targetMet: boolean;
  targetGap: number;
  investmentSummaries: InvestmentSummary[];
}

export interface ProjectionResult {
  monthly: MonthlyPortfolioSnapshot[];
  summary: PortfolioSummary;
}
