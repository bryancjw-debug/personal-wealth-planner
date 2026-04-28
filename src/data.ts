import type { Investment, ProjectionSettings } from "./types";
import { DEFAULT_RETURNS, DEFAULT_VOLATILITY, INVESTMENT_COLORS } from "./utils/projection";

export const defaultSettings: ProjectionSettings = {
  currentAge: 35,
  startDate: "2026-05-01",
  endDate: "2056-05-01",
  inflationRate: 2.5,
  targetAmount: 1_500_000,
  scenario: "base",
  viewMode: "nominal",
  darkMode: false
};

export const defaultInvestments: Investment[] = [
  {
    id: "core-etf",
    name: "Global ETF Core",
    type: "Funds / ETFs",
    annualReturn: DEFAULT_RETURNS["Funds / ETFs"],
    amount: 1200,
    frequency: "Monthly",
    dividendYield: 2,
    dividendTreatment: "Reinvest dividends",
    annualContributionIncrease: 3,
    taxRate: 10,
    expenseRatio: 0.2,
    volatility: DEFAULT_VOLATILITY["Funds / ETFs"],
    color: INVESTMENT_COLORS[0]
  },
  {
    id: "bond-income",
    name: "Bond Income",
    type: "Bonds",
    annualReturn: DEFAULT_RETURNS.Bonds,
    amount: 8000,
    frequency: "Annually",
    dividendYield: 3,
    dividendTreatment: "Take dividends as cash",
    annualContributionIncrease: 1,
    taxRate: 8,
    expenseRatio: 0.15,
    volatility: DEFAULT_VOLATILITY.Bonds,
    color: INVESTMENT_COLORS[1]
  },
  {
    id: "cash-buffer",
    name: "Cash Buffer",
    type: "Cash holdings",
    annualReturn: DEFAULT_RETURNS["Cash holdings"],
    amount: 15000,
    frequency: "One-time",
    dividendYield: 0,
    dividendTreatment: "Take dividends as cash",
    annualContributionIncrease: 0,
    taxRate: 0,
    expenseRatio: 0,
    volatility: DEFAULT_VOLATILITY["Cash holdings"],
    color: INVESTMENT_COLORS[2]
  }
];
