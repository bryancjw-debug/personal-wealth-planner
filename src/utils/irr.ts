const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

function npv(rate: number, cashFlows: number[]) {
  return cashFlows.reduce((total, cashFlow, index) => total + cashFlow / (1 + rate) ** index, 0);
}

export function monthlyIrr(cashFlows: number[]): number | null {
  const hasPositive = cashFlows.some((flow) => flow > 0);
  const hasNegative = cashFlows.some((flow) => flow < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low, cashFlows);
  let highValue = npv(high, cashFlows);

  while (lowValue * highValue > 0 && high < 1_000_000) {
    high *= 2;
    highValue = npv(high, cashFlows);
  }

  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid, cashFlows);

    if (Math.abs(midValue) < TOLERANCE) return mid;
    if (lowValue * midValue < 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

export function annualizedIrrFromMonthly(cashFlows: number[]): number | null {
  const monthly = monthlyIrr(cashFlows);
  if (monthly === null) return null;
  return (1 + monthly) ** 12 - 1;
}
