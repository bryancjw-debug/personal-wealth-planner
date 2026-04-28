import { describe, expect, it } from "vitest";
import { defaultInvestments, defaultSettings } from "../data";
import { annualizedIrrFromMonthly } from "./irr";
import { calculateProjection } from "./projection";

describe("IRR", () => {
  it("annualizes monthly cash flows", () => {
    const irr = annualizedIrrFromMonthly([-1000, 0, 0, 1100]);
    expect(irr).toBeGreaterThan(0.4);
    expect(irr).toBeLessThan(0.5);
  });

  it("returns null when cash flows do not change sign", () => {
    expect(annualizedIrrFromMonthly([100, 200, 300])).toBeNull();
  });
});

describe("projection", () => {
  it("calculates month-by-month rows and ending value", () => {
    const result = calculateProjection(
      { ...defaultSettings, startDate: "2026-01-01", endDate: "2026-12-01" },
      [defaultInvestments[0]]
    );

    expect(result.monthly).toHaveLength(12);
    expect(result.summary.totalContributed).toBeGreaterThan(0);
    expect(result.summary.endingValue).toBeGreaterThan(result.summary.totalContributed * 0.9);
  });

  it("handles a negative return without producing invalid values", () => {
    const result = calculateProjection(
      { ...defaultSettings, startDate: "2026-01-01", endDate: "2028-01-01" },
      [{ ...defaultInvestments[0], annualReturn: -12 }]
    );

    expect(Number.isFinite(result.summary.endingValue)).toBe(true);
    expect(result.summary.endingValue).toBeGreaterThanOrEqual(0);
  });

  it("supports one-time investments", () => {
    const result = calculateProjection(
      { ...defaultSettings, startDate: "2026-01-01", endDate: "2026-03-01" },
      [{ ...defaultInvestments[2], amount: 10000 }]
    );

    expect(result.monthly[0].contributions).toBe(10000);
    expect(result.monthly[1].contributions).toBe(0);
  });
});
