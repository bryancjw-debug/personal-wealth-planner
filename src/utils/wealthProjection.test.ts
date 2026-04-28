import { describe, expect, it } from "vitest";
import { defaultWealthProfile, monthlyExpenses, monthlyIncome, projectWealth } from "./wealthProjection";

describe("wealth projection", () => {
  it("uses breakdown totals when breakdown mode is selected", () => {
    expect(monthlyIncome(defaultWealthProfile)).toBe(9000);
    expect(monthlyExpenses(defaultWealthProfile)).toBe(5200);
  });

  it("projects investments and excess cash by age", () => {
    const result = projectWealth({ ...defaultWealthProfile, age: 40, projectionEndAge: 42 });

    expect(result).toHaveLength(3);
    expect(result[0].freeCash).toBe(0);
    expect(result[1].annualInvestmentContributions).toBeGreaterThan(0);
    expect(result[1].annualDividendsPaidOut).toBeGreaterThan(0);
    expect(result[1].freeCash).toBeGreaterThan(0);
    expect(result[2].totalAssets).toBeGreaterThan(result[0].totalAssets);
  });

  it("does not accumulate negative free cash when expenses exceed income", () => {
    const result = projectWealth({
      ...defaultWealthProfile,
      incomeMode: "generic",
      expenseMode: "generic",
      monthlyIncome: 1000,
      monthlyExpenses: 3000,
      age: 30,
      projectionEndAge: 31
    });

    expect(result[1].freeCash).toBe(0);
  });

  it("draws down enabled investments when post-contribution cash flow is negative", () => {
    const result = projectWealth({
      ...defaultWealthProfile,
      age: 60,
      projectionEndAge: 61,
      incomeMode: "generic",
      expenseMode: "generic",
      monthlyIncome: 0,
      monthlyExpenses: 10000,
      cashFlowEvents: [],
      assets: defaultWealthProfile.assets.map((asset) => ({ ...asset, contributionAmount: 0, drawdownEnabled: true }))
    });

    expect(result[1].annualDrawdown).toBeGreaterThan(0);
    expect(result[1].investmentValue).toBeLessThan(result[0].investmentValue * 1.2);
  });
});
