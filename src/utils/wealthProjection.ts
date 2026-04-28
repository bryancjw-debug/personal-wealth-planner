export type CashFlowMode = "generic" | "breakdown";

export interface NamedAmount {
  id: string;
  label: string;
  amount: number;
}

export interface WealthAsset {
  id: string;
  label: string;
  type: string;
  currentValue: number;
  expectedReturn: number;
  contributionAmount: number;
  contributionFrequency: "None" | "Monthly" | "Annually";
  contributionStartAge: number;
  contributionEndAge: number;
  dividendYield: number;
  dividendTreatment: "Reinvest dividends" | "Take dividends as cash";
  drawdownEnabled: boolean;
  color: string;
}

export interface CashFlowEvent {
  id: string;
  label: string;
  type: "Custom" | "Car" | "House" | "Wedding" | "Retirement";
  age: number;
  oneTimeCost: number;
  monthlyIncomeChange: number;
  monthlyExpenseChange: number;
  setIncomeToZero: boolean;
}

export interface AssetShiftEvent {
  id: string;
  label: string;
  age: number;
  fromAssetId: string;
  toAssetId: string;
  percentage: number;
}

export interface WealthProfile {
  name: string;
  age: number;
  projectionEndAge: number;
  incomeInflationRate: number;
  expenseInflationRate: number;
  incomeMode: CashFlowMode;
  expenseMode: CashFlowMode;
  monthlyIncome: number;
  monthlyExpenses: number;
  incomeItems: NamedAmount[];
  expenseItems: NamedAmount[];
  cashFlowEvents: CashFlowEvent[];
  assetShiftEvents: AssetShiftEvent[];
  assets: WealthAsset[];
  darkMode: boolean;
}

export interface AgeProjection {
  age: number;
  yearIndex: number;
  investmentValue: number;
  freeCash: number;
  cpfTotal?: number;
  totalAssets: number;
  annualIncome: number;
  annualExpenses: number;
  annualDividendIncome: number;
  annualLifeEventCosts: number;
  annualCashOutflows: number;
  annualExcessCash: number;
  annualInvestmentContributions: number;
  annualDividendsPaidOut: number;
  annualDrawdown: number;
  netCashFlow: number;
  triggeredLifeEvents: Array<{
    id: string;
    label: string;
    type: CashFlowEvent["type"];
    oneTimeCost: number;
    monthlyIncomeChange: number;
    monthlyExpenseChange: number;
    setIncomeToZero: boolean;
  }>;
  assetBreakdown: Array<{
    id: string;
    label: string;
    type: string;
    value: number;
    growth: number;
    contribution: number;
    dividends: number;
    color: string;
  }>;
}

export const assetTypeDefaults: Record<string, number> = {
  Equities: 7,
  "Funds / ETFs": 6,
  Bonds: 3.5,
  "Cash holdings": 2,
  Crypto: 10,
  Commodities: 4,
  Endowments: 3.5,
  Other: 5
};

export const wealthColors = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4f46e5"];

export const defaultWealthProfile: WealthProfile = {
  name: "Bryan",
  age: 35,
  projectionEndAge: 100,
  darkMode: false,
  incomeInflationRate: 3,
  expenseInflationRate: 2.5,
  incomeMode: "breakdown",
  expenseMode: "breakdown",
  monthlyIncome: 9000,
  monthlyExpenses: 5200,
  incomeItems: [
    { id: "salary", label: "Salary", amount: 8500 },
    { id: "side", label: "Side income", amount: 500 }
  ],
  expenseItems: [
    { id: "home", label: "Housing", amount: 2400 },
    { id: "food", label: "Food and lifestyle", amount: 1400 },
    { id: "insurance", label: "Insurance", amount: 700 },
    { id: "other", label: "Other expenses", amount: 700 }
  ],
  cashFlowEvents: [
    {
      id: "bonus",
      label: "Promotion",
      type: "Custom",
      age: 40,
      oneTimeCost: 0,
      monthlyIncomeChange: 1500,
      monthlyExpenseChange: 0,
      setIncomeToZero: false
    },
    {
      id: "retirement",
      label: "Retirement",
      type: "Retirement",
      age: 62,
      oneTimeCost: 0,
      monthlyIncomeChange: 0,
      monthlyExpenseChange: -1200,
      setIncomeToZero: true
    }
  ],
  assetShiftEvents: [
    {
      id: "derisk",
      label: "Shift equities into bonds",
      age: 55,
      fromAssetId: "equity",
      toAssetId: "bond",
      percentage: 40
    }
  ],
  assets: [
    {
      id: "etf",
      label: "First investment",
      type: "Funds / ETFs",
      currentValue: 85000,
      expectedReturn: 6,
      contributionAmount: 1200,
      contributionFrequency: "Monthly",
      contributionStartAge: 35,
      contributionEndAge: 65,
      dividendYield: 2,
      dividendTreatment: "Reinvest dividends",
      drawdownEnabled: true,
      color: wealthColors[0]
    }
  ]
};

export function monthlyIncome(profile: WealthProfile) {
  return profile.incomeMode === "generic"
    ? profile.monthlyIncome
    : profile.incomeItems.reduce((total, item) => total + safeAmount(item.amount), 0);
}

export function monthlyExpenses(profile: WealthProfile) {
  return profile.expenseMode === "generic"
    ? profile.monthlyExpenses
    : profile.expenseItems.reduce((total, item) => total + safeAmount(item.amount), 0);
}

function safeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function projectWealth(profile: WealthProfile): AgeProjection[] {
  const startAge = Math.max(0, Math.floor(profile.age || 0));
  const endAge = Math.max(startAge, Math.floor(profile.projectionEndAge || startAge));
  let freeCash = 0;
  const assetValues = new Map(profile.assets.map((asset) => [asset.id, safeAmount(asset.currentValue)]));
  const result: AgeProjection[] = [];

  for (let age = startAge; age <= endAge; age += 1) {
    const yearIndex = age - startAge;
    const annualIncome = projectedMonthlyIncome(profile, age) * 12;
    const annualExpenses = projectedMonthlyExpenses(profile, age) * 12;
    const triggeredLifeEvents = eventsAtAge(profile, age);
    const annualLifeEventCosts = lifeEventCosts(profile, age);
    const grossCashBeforeInvesting = annualIncome - annualExpenses - annualLifeEventCosts;
    const annualExcessCash = Math.max(0, grossCashBeforeInvesting);
    let annualInvestmentContributions = 0;
    let annualDividendsPaidOut = 0;
    let annualDrawdown = 0;

    if (yearIndex > 0) {
      applyAssetShifts(profile, assetValues, age);

      profile.assets.forEach((asset) => {
        let value = assetValues.get(asset.id) ?? 0;
        const contribution = annualContribution(asset, age);
        const dividend = value * (asset.dividendYield / 100);
        const growth = value * (asset.expectedReturn / 100);

        annualInvestmentContributions += contribution;
        if (asset.dividendTreatment === "Take dividends as cash") {
          annualDividendsPaidOut += dividend;
          value += contribution + growth;
        } else {
          value += contribution + growth + dividend;
        }

        assetValues.set(asset.id, Math.max(0, value));
      });

      const netCashFlow = grossCashBeforeInvesting + annualDividendsPaidOut - annualInvestmentContributions;
      if (netCashFlow >= 0) {
        freeCash += netCashFlow;
      } else {
        const cashUsed = Math.min(freeCash, Math.abs(netCashFlow));
        freeCash -= cashUsed;
        annualDrawdown = drawdownAssets(profile, assetValues, Math.abs(netCashFlow) - cashUsed);
      }
    }

    const assetBreakdown = profile.assets.map((asset) => {
      const value = assetValues.get(asset.id) ?? 0;
      return {
        id: asset.id,
        label: asset.label,
        type: asset.type,
        value,
        growth: value - safeAmount(asset.currentValue),
        contribution: yearIndex > 0 ? annualContribution(asset, age) : 0,
        dividends: yearIndex > 0 ? value * (asset.dividendYield / 100) : 0,
        color: asset.color
      };
    });

    const investmentValue = assetBreakdown.reduce((total, asset) => total + asset.value, 0);

    result.push({
      age,
      yearIndex,
      investmentValue,
      freeCash,
      totalAssets: investmentValue + freeCash,
      annualIncome,
      annualExpenses,
      annualDividendIncome: annualDividendsPaidOut,
      annualLifeEventCosts,
      annualCashOutflows: annualExpenses + annualLifeEventCosts + annualInvestmentContributions,
      annualExcessCash,
      annualInvestmentContributions,
      annualDividendsPaidOut,
      annualDrawdown,
      netCashFlow: grossCashBeforeInvesting + annualDividendsPaidOut - annualInvestmentContributions,
      triggeredLifeEvents,
      assetBreakdown
    });
  }

  return result;
}

function annualContribution(asset: WealthAsset, age: number) {
  if (age < asset.contributionStartAge || age > asset.contributionEndAge) return 0;
  if (asset.contributionFrequency === "Monthly") return safeAmount(asset.contributionAmount) * 12;
  if (asset.contributionFrequency === "Annually") return safeAmount(asset.contributionAmount);
  return 0;
}

function lifeEventCosts(profile: WealthProfile, age: number) {
  return eventsAtAge(profile, age)
    .reduce((total, event) => total + safeAmount(event.oneTimeCost), 0);
}

function eventsAtAge(profile: WealthProfile, age: number) {
  return profile.cashFlowEvents
    .filter((event) => Number(event.age) === age)
    .map((event) => ({
      id: event.id,
      label: event.label,
      type: event.type,
      oneTimeCost: event.oneTimeCost,
      monthlyIncomeChange: event.monthlyIncomeChange,
      monthlyExpenseChange: event.monthlyExpenseChange,
      setIncomeToZero: event.setIncomeToZero
    }));
}

function applyAssetShifts(profile: WealthProfile, assetValues: Map<string, number>, age: number) {
  profile.assetShiftEvents
    .filter((event) => event.age === age)
    .forEach((event) => {
      const fromValue = assetValues.get(event.fromAssetId) ?? 0;
      const shift = fromValue * Math.min(100, Math.max(0, event.percentage)) / 100;
      assetValues.set(event.fromAssetId, fromValue - shift);
      assetValues.set(event.toAssetId, (assetValues.get(event.toAssetId) ?? 0) + shift);
    });
}

function drawdownAssets(profile: WealthProfile, assetValues: Map<string, number>, requiredAmount: number) {
  if (requiredAmount <= 0) return 0;
  const drawable = profile.assets.filter((asset) => asset.drawdownEnabled && (assetValues.get(asset.id) ?? 0) > 0);
  const totalDrawable = drawable.reduce((total, asset) => total + (assetValues.get(asset.id) ?? 0), 0);
  if (totalDrawable <= 0) return 0;

  let remaining = requiredAmount;
  drawable.forEach((asset, index) => {
    const current = assetValues.get(asset.id) ?? 0;
    const proportional = index === drawable.length - 1 ? remaining : requiredAmount * (current / totalDrawable);
    const amount = Math.min(current, proportional);
    assetValues.set(asset.id, current - amount);
    remaining -= amount;
  });

  return requiredAmount - Math.max(0, remaining);
}

function projectedMonthlyIncome(profile: WealthProfile, age: number) {
  const retired = profile.cashFlowEvents.some((event) => event.type === "Retirement" && event.setIncomeToZero && age >= event.age);
  const base = retired ? 0 : monthlyIncome(profile) * (1 + profile.incomeInflationRate / 100) ** Math.max(0, age - profile.age);
  const events = profile.cashFlowEvents
    .filter((event) => age >= event.age && !event.setIncomeToZero)
    .reduce((total, event) => total + event.monthlyIncomeChange * (1 + profile.incomeInflationRate / 100) ** Math.max(0, age - event.age), 0);
  return Math.max(0, base + events);
}

function projectedMonthlyExpenses(profile: WealthProfile, age: number) {
  const base = monthlyExpenses(profile) * (1 + profile.expenseInflationRate / 100) ** Math.max(0, age - profile.age);
  const events = profile.cashFlowEvents
    .filter((event) => age >= event.age)
    .reduce((total, event) => total + event.monthlyExpenseChange * (1 + profile.expenseInflationRate / 100) ** Math.max(0, age - event.age), 0);
  return Math.max(0, base + events);
}

export function validateWealthProfile(profile: WealthProfile) {
  const errors: string[] = [];
  if (!profile.name.trim()) errors.push("Enter your name to continue.");
  if (!Number.isFinite(profile.age) || profile.age < 0 || profile.age > 120) errors.push("Age must be between 0 and 120.");
  if (profile.projectionEndAge < profile.age) errors.push("Projection end age must be greater than or equal to current age.");
  if (monthlyIncome(profile) < monthlyExpenses(profile)) errors.push("Expenses are higher than income, so free cash will not grow.");
  if (!profile.assets.length) errors.push("Add at least one investment asset.");
  profile.assets.forEach((asset) => {
    if (!asset.label.trim()) errors.push("Each investment needs a label.");
    if (asset.currentValue < 0) errors.push(`${asset.label || "Investment"} cannot have a negative current value.`);
    if (asset.expectedReturn <= -100) errors.push(`${asset.label || "Investment"} return must be above -100%.`);
    if (asset.contributionAmount < 0) errors.push(`${asset.label || "Investment"} contribution cannot be negative.`);
    if (asset.contributionEndAge < asset.contributionStartAge) errors.push(`${asset.label || "Investment"} contribution end age must be at or after the start age.`);
    if (asset.dividendYield < 0) errors.push(`${asset.label || "Investment"} dividend yield cannot be negative.`);
  });
  profile.cashFlowEvents.forEach((event) => {
    if (event.age < profile.age) errors.push(`${event.label || "Cash-flow event"} must happen at or after the current age.`);
    if (event.oneTimeCost < 0) errors.push(`${event.label || "Cash-flow event"} one-time cost cannot be negative.`);
  });
  profile.assetShiftEvents.forEach((event) => {
    if (event.age < profile.age) errors.push(`${event.label || "Asset shift"} must happen at or after the current age.`);
    if (event.fromAssetId === event.toAssetId) errors.push(`${event.label || "Asset shift"} must move value between two different assets.`);
    if (event.percentage < 0 || event.percentage > 100) errors.push(`${event.label || "Asset shift"} percentage must be between 0% and 100%.`);
  });
  return [...new Set(errors)];
}
