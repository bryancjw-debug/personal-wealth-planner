import type { Investment, ProjectionSettings } from "../types";
import { calculateProjection } from "./projection";

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function runMonteCarlo(settings: ProjectionSettings, investments: Investment[], runs = 250) {
  const random = mulberry32(42);
  const values: number[] = [];

  for (let run = 0; run < runs; run += 1) {
    const sampled = investments.map((investment) => ({
      ...investment,
      annualReturn: investment.annualReturn + normal(random) * investment.volatility * 0.35
    }));
    values.push(calculateProjection({ ...settings, scenario: "base" }, sampled).summary.endingValue);
  }

  values.sort((a, b) => a - b);
  const percentile = (p: number) => values[Math.min(values.length - 1, Math.max(0, Math.floor((p / 100) * values.length)))] ?? 0;

  return {
    p10: percentile(10),
    p50: percentile(50),
    p90: percentile(90),
    successRate: values.filter((value) => value >= settings.targetAmount).length / values.length
  };
}
