import type {
  AssetType,
  Investment,
  InvestmentFrequency,
  InvestmentSummary,
  MonthlyInvestmentSnapshot,
  MonthlyPortfolioSnapshot,
  ProjectionResult,
  ProjectionSettings
} from "../types";
import { annualizedIrrFromMonthly } from "./irr";
import { toCsvValue } from "./formatters";

export const DEFAULT_RETURNS: Record<AssetType, number> = {
  Equities: 7,
  "Funds / ETFs": 6,
  Bonds: 3.5,
  "Cash holdings": 2,
  Crypto: 10,
  Commodities: 4,
  Other: 5
};

export const DEFAULT_VOLATILITY: Record<AssetType, number> = {
  Equities: 16,
  "Funds / ETFs": 12,
  Bonds: 5,
  "Cash holdings": 1,
  Crypto: 45,
  Commodities: 18,
  Other: 10
};

export const INVESTMENT_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#4f46e5",
  "#be123c"
];

const frequencyMonths: Record<InvestmentFrequency, number | null> = {
  "One-time": null,
  Monthly: 1,
  Quarterly: 3,
  "Semi-annually": 6,
  Annually: 12
};

export function monthsBetweenInclusive(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

export function parseProjectionDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthlyRate(annualPercent: number) {
  return (1 + annualPercent / 100) ** (1 / 12) - 1;
}

function contributionDue(frequency: InvestmentFrequency, monthIndex: number) {
  if (frequency === "One-time") return monthIndex === 0;
  const interval = frequencyMonths[frequency] ?? 1;
  return monthIndex % interval === 0;
}

function adjustedContribution(investment: Investment, monthIndex: number) {
  const yearsElapsed = Math.floor(monthIndex / 12);
  return investment.amount * (1 + investment.annualContributionIncrease / 100) ** yearsElapsed;
}

function scenarioReturn(annualReturn: number, scenario: ProjectionSettings["scenario"], volatility: number) {
  if (scenario === "optimistic") return annualReturn + Math.max(1, volatility * 0.25);
  if (scenario === "pessimistic") return annualReturn - Math.max(1, volatility * 0.25);
  return annualReturn;
}

export function validateInputs(settings: ProjectionSettings, investments: Investment[]) {
  const errors: string[] = [];
  const start = parseProjectionDate(settings.startDate);
  const end = parseProjectionDate(settings.endDate);

  if (!start) errors.push("Investment start date is required.");
  if (!end) errors.push("Investment end date is required.");
  if (start && end && end < start) errors.push("Investment end date must be after the start date.");
  if (!Number.isFinite(settings.currentAge) || settings.currentAge < 0 || settings.currentAge > 120) {
    errors.push("Current age must be between 0 and 120.");
  }
  if (investments.length === 0) errors.push("Add at least one investment.");

  investments.forEach((investment) => {
    if (!investment.name.trim()) errors.push("Each investment needs a name.");
    if (!Number.isFinite(investment.amount) || investment.amount < 0) {
      errors.push(`${investment.name || "Investment"} amount must be zero or greater.`);
    }
    if (investment.annualReturn <= -100) errors.push(`${investment.name} return must be above -100%.`);
    if (investment.dividendYield < 0) errors.push(`${investment.name} dividend yield cannot be negative.`);
    if (investment.taxRate < 0 || investment.taxRate > 100) errors.push(`${investment.name} tax rate must be 0% to 100%.`);
    if (investment.expenseRatio < 0) errors.push(`${investment.name} fee cannot be negative.`);
  });

  return [...new Set(errors)];
}

export function calculateProjection(settings: ProjectionSettings, investments: Investment[]): ProjectionResult {
  const start = parseProjectionDate(settings.startDate);
  const end = parseProjectionDate(settings.endDate);

  if (!start || !end || end < start || investments.length === 0) {
    return emptyProjection(investments);
  }

  const totalMonths = Math.min(monthsBetweenInclusive(start, end), 1200);
  const inflationMonthly = monthlyRate(settings.inflationRate);
  const state = investments.map((investment) => ({
    investment,
    value: 0,
    totalContributed: 0,
    totalDividends: 0,
    totalFees: 0,
    totalTaxes: 0,
    cashFlows: [] as number[]
  }));

  const monthly: MonthlyPortfolioSnapshot[] = [];
  const portfolioCashFlows: number[] = [];

  for (let monthIndex = 0; monthIndex < totalMonths; monthIndex += 1) {
    const currentDate = addMonths(start, monthIndex);
    const byInvestment: MonthlyInvestmentSnapshot[] = [];
    let contributions = 0;
    let dividends = 0;
    let fees = 0;
    let taxes = 0;
    let totalValue = 0;
    let cumulativeContributions = 0;
    let cumulativeDividends = 0;
    let cumulativeFees = 0;
    let cumulativeTaxes = 0;

    state.forEach((item) => {
      const investment = item.investment;
      const due = contributionDue(investment.frequency, monthIndex);
      const contribution = due ? adjustedContribution(investment, monthIndex) : 0;
      item.value += contribution;
      item.totalContributed += contribution;

      const grossReturn = item.value * monthlyRate(scenarioReturn(investment.annualReturn, settings.scenario, investment.volatility));
      const dividend = item.value * monthlyRate(investment.dividendYield);
      const fee = item.value * monthlyRate(investment.expenseRatio);
      const taxableGain = Math.max(0, grossReturn + dividend);
      const tax = taxableGain * (investment.taxRate / 100);

      item.value += grossReturn - fee - tax;
      if (investment.dividendTreatment === "Reinvest dividends") {
        item.value += dividend;
      }

      item.totalDividends += dividend;
      item.totalFees += fee;
      item.totalTaxes += tax;

      const investmentCashFlow = -contribution + (investment.dividendTreatment === "Take dividends as cash" ? dividend : 0);
      item.cashFlows.push(investmentCashFlow);

      const inflationFactor = (1 + inflationMonthly) ** monthIndex;
      const adjustedValue = item.value / inflationFactor;
      const cumulativeGain = item.value + item.totalDividends - item.totalContributed;

      contributions += contribution;
      dividends += dividend;
      fees += fee;
      taxes += tax;
      totalValue += item.value;
      cumulativeContributions += item.totalContributed;
      cumulativeDividends += item.totalDividends;
      cumulativeFees += item.totalFees;
      cumulativeTaxes += item.totalTaxes;

      byInvestment.push({
        investmentId: investment.id,
        name: investment.name,
        type: investment.type,
        contribution,
        dividend,
        fees: fee,
        taxes: tax,
        value: item.value,
        inflationAdjustedValue: adjustedValue,
        cumulativeContributions: item.totalContributed,
        cumulativeDividends: item.totalDividends,
        cumulativeFees: item.totalFees,
        cumulativeTaxes: item.totalTaxes,
        cumulativeGains: cumulativeGain
      });
    });

    portfolioCashFlows.push(-contributions + dividends);
    const inflationFactor = (1 + inflationMonthly) ** monthIndex;

    monthly.push({
      monthIndex,
      date: currentDate.toISOString(),
      age: settings.currentAge + monthIndex / 12,
      contributions,
      dividends,
      fees,
      taxes,
      totalValue,
      inflationAdjustedValue: totalValue / inflationFactor,
      cumulativeContributions,
      cumulativeDividends,
      cumulativeFees,
      cumulativeTaxes,
      cumulativeGains: totalValue + cumulativeDividends - cumulativeContributions,
      byInvestment
    });
  }

  state.forEach((item) => {
    item.cashFlows[item.cashFlows.length - 1] += item.value;
  });
  portfolioCashFlows[portfolioCashFlows.length - 1] += monthly.at(-1)?.totalValue ?? 0;

  const last = monthly.at(-1);
  const firstContributionMonth = monthly.find((row) => row.cumulativeContributions > 0);
  const years = totalMonths / 12;

  const investmentSummaries: InvestmentSummary[] = state.map((item) => {
    const lastSnapshot = last?.byInvestment.find((snapshot) => snapshot.investmentId === item.investment.id);
    const beginning = firstContributionMonth?.byInvestment.find((snapshot) => snapshot.investmentId === item.investment.id)?.cumulativeContributions ?? 0;
    const endingValue = lastSnapshot?.value ?? 0;
    return {
      investmentId: item.investment.id,
      name: item.investment.name,
      type: item.investment.type,
      endingValue,
      inflationAdjustedEndingValue: lastSnapshot?.inflationAdjustedValue ?? 0,
      totalContributed: item.totalContributed,
      totalDividends: item.totalDividends,
      totalFees: item.totalFees,
      totalTaxes: item.totalTaxes,
      totalGainLoss: endingValue + item.totalDividends - item.totalContributed,
      cagr: beginning > 0 && endingValue > 0 ? (endingValue / beginning) ** (1 / years) - 1 : null,
      irr: annualizedIrrFromMonthly(item.cashFlows)
    };
  });

  const beginningPortfolio = firstContributionMonth?.cumulativeContributions ?? 0;
  const endingValue = last?.totalValue ?? 0;

  return {
    monthly,
    summary: {
      totalContributed: last?.cumulativeContributions ?? 0,
      endingValue,
      inflationAdjustedEndingValue: last?.inflationAdjustedValue ?? 0,
      totalGainLoss: (last?.cumulativeGains ?? 0),
      totalDividends: last?.cumulativeDividends ?? 0,
      totalFees: last?.cumulativeFees ?? 0,
      totalTaxes: last?.cumulativeTaxes ?? 0,
      cagr: beginningPortfolio > 0 && endingValue > 0 ? (endingValue / beginningPortfolio) ** (1 / years) - 1 : null,
      irr: annualizedIrrFromMonthly(portfolioCashFlows),
      targetMet: endingValue >= settings.targetAmount,
      targetGap: Math.max(0, settings.targetAmount - endingValue),
      investmentSummaries
    }
  };
}

function emptyProjection(investments: Investment[]): ProjectionResult {
  return {
    monthly: [],
    summary: {
      totalContributed: 0,
      endingValue: 0,
      inflationAdjustedEndingValue: 0,
      totalGainLoss: 0,
      totalDividends: 0,
      totalFees: 0,
      totalTaxes: 0,
      cagr: null,
      irr: null,
      targetMet: false,
      targetGap: 0,
      investmentSummaries: investments.map((investment) => ({
        investmentId: investment.id,
        name: investment.name,
        type: investment.type,
        endingValue: 0,
        inflationAdjustedEndingValue: 0,
        totalContributed: 0,
        totalDividends: 0,
        totalFees: 0,
        totalTaxes: 0,
        totalGainLoss: 0,
        cagr: null,
        irr: null
      }))
    }
  };
}

export function exportProjectionCsv(result: ProjectionResult, investments: Investment[]) {
  const investmentHeaders = investments.map((investment) => `${investment.name} Value`);
  const headers = [
    "Month",
    "Age",
    "Contributions",
    "Dividends",
    ...investmentHeaders,
    "Total Portfolio Value",
    "Inflation Adjusted Value",
    "Cumulative Contributions",
    "Cumulative Gains",
    "Fees",
    "Taxes"
  ];

  const rows = result.monthly.map((row) => {
    const valuesByInvestment = investments.map((investment) => {
      const match = row.byInvestment.find((snapshot) => snapshot.investmentId === investment.id);
      return Math.round(match?.value ?? 0);
    });

    return [
      row.date.slice(0, 10),
      row.age.toFixed(2),
      row.contributions.toFixed(2),
      row.dividends.toFixed(2),
      ...valuesByInvestment,
      row.totalValue.toFixed(2),
      row.inflationAdjustedValue.toFixed(2),
      row.cumulativeContributions.toFixed(2),
      row.cumulativeGains.toFixed(2),
      row.cumulativeFees.toFixed(2),
      row.cumulativeTaxes.toFixed(2)
    ];
  });

  return [headers, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
}
