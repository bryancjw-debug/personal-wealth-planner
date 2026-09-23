import { CPF_ANNUAL_CAP_2026, createDefaultPartnerProfile, createDefaultProfile, investmentReturnDefaults, retirementEvent } from "./defaults";
import { geHospitalizationPremium } from "./geHospitalization";
import type {
  CarAsset,
  CpfContribution,
  CustomAsset,
  GlidepathAssumption,
  HousingAsset,
  InsurancePolicy,
  InvestmentHolding,
  InvestmentType,
  LifeEvent,
  PortfolioGlidepath,
  ProjectionYear,
  SingaporePlannerProfile
} from "./types";

const currentPolicyYear = 2026;

export function toNumber(value: number | "" | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function positive(value: number | "" | null | undefined) {
  return Math.max(0, toNumber(value));
}

export function normalizeProfile(input: Partial<SingaporePlannerProfile> = {}): SingaporePlannerProfile {
  const base = createDefaultProfile();
  const legacyHealthcare = input.healthcare as Partial<SingaporePlannerProfile["healthcare"]> & {
    includeCareShield?: boolean;
    careShieldEnhancement?: boolean;
    includeMediShield?: boolean;
  } | undefined;
  const merged: SingaporePlannerProfile = {
    ...base,
    ...input,
    planningMode: input.planningMode ?? base.planningMode,
    includePropertyInNetWorth: input.includePropertyInNetWorth ?? base.includePropertyInNetWorth,
    endAge: Math.max(0, Math.floor(Number(input.endAge ?? base.endAge) || base.endAge)),
    cpf: { ...base.cpf, ...(input.cpf ?? {}) },
    healthcare: {
      careShield: {
        ...base.healthcare.careShield,
        ...(legacyHealthcare?.careShield ?? {}),
        enabled: legacyHealthcare?.careShield?.enabled ?? legacyHealthcare?.includeCareShield ?? base.healthcare.careShield.enabled,
        enhancement: legacyHealthcare?.careShield?.enhancement ?? legacyHealthcare?.careShieldEnhancement ?? base.healthcare.careShield.enhancement
      },
      mediShield: {
        ...base.healthcare.mediShield,
        ...(legacyHealthcare?.mediShield ?? {}),
        enabled: legacyHealthcare?.mediShield?.enabled ?? legacyHealthcare?.includeMediShield ?? base.healthcare.mediShield.enabled
      }
    },
    protection: { ...base.protection, ...(input.protection ?? {}), policies: input.protection?.policies ?? base.protection.policies },
    tax: { ...base.tax, ...(input.tax ?? {}), reliefs: { ...base.tax.reliefs, ...(input.tax?.reliefs ?? {}) } },
    srs: { ...base.srs, ...(input.srs ?? {}) },
    income: input.income ?? base.income,
    expenses: input.expenses ?? base.expenses,
    employmentPeriods: input.employmentPeriods ?? base.employmentPeriods,
    homes: input.homes ?? base.homes,
    cars: input.cars ?? base.cars,
    customAssets: (input.customAssets ?? base.customAssets).map((asset) => ({
      ...asset,
      drawdown: asset.drawdown ?? false
    })),
    shifts: (input.shifts ?? base.shifts).map((shift) => ({
      ...shift,
      scope: shift.scope ?? "all",
      pct: Math.min(100, positive(shift.pct || 0)),
      glideYears: positive(shift.glideYears),
      futureContrib: shift.futureContrib ?? true,
      targetAssumptions: shift.targetAssumptions ?? {}
    })),
    assets: (input.assets ?? base.assets).map((asset, index) => ({
      ...base.assets[index % base.assets.length],
      ...asset,
      ret: asset.ret === "" || asset.ret == null ? investmentReturnDefaults[asset.type as InvestmentType] : asset.ret,
      contribStart: asset.contribStart === "" || asset.contribStart == null ? input.age ?? "" : asset.contribStart,
      contribEnd: asset.contribEnd === "" || asset.contribEnd == null ? input.retirementAge ?? 65 : asset.contribEnd,
      divEnabled: asset.divEnabled ?? positive(asset.divYield) > 0
    }))
  };
  merged.events = syncRetirementEvent(input.events ?? base.events, merged.retirementAge).map((event) => ({
    ...event,
    housing: event.type === "House"
      ? {
          purchasePrice: event.housing?.purchasePrice ?? "",
          cashDownpayment: event.housing?.cashDownpayment ?? "",
          cpfOaDownpayment: event.housing?.cpfOaDownpayment ?? "",
          loan: event.housing?.loan ?? "",
          rate: event.housing?.rate ?? 2.6,
          term: event.housing?.term ?? 25,
          appreciation: event.housing?.appreciation ?? 2,
          annualPropertyTax: event.housing?.annualPropertyTax ?? "",
          saleAge: event.housing?.saleAge ?? ""
        }
      : event.housing
  }));
  if (merged.planningMode === "Couple") {
    const partnerInput = input.couple?.partner ?? createDefaultPartnerProfile();
    merged.couple = {
      propertyOwnershipA: input.couple?.propertyOwnershipA ?? 50,
      propertyOwnershipB: input.couple?.propertyOwnershipB ?? 50,
      loanShareA: input.couple?.loanShareA ?? 50,
      loanShareB: input.couple?.loanShareB ?? 50,
      partner: normalizeProfile({
        ...partnerInput,
        planningMode: "Individual",
        couple: undefined,
        welcomed: true,
        dark: merged.dark,
        includePropertyInNetWorth: merged.includePropertyInNetWorth,
        endAge: merged.endAge
      })
    };
  } else {
    merged.couple = undefined;
  }
  return merged;
}

export function syncRetirementEvent(events: LifeEvent[], retirementAge: number | "") {
  const next = events.map((event) => ({ ...event }));
  let retire = next.find((event) => event.type === "Retirement");
  if (!retire) {
    retire = retirementEvent(retirementAge);
    next.push(retire);
  }
  retire.age = retirementAge;
  retire.label = retire.label || "Retirement";
  retire.zeroIncome = retire.zeroIncome ?? true;
  retire.cost = retire.cost ?? 0;
  retire.incomeChange = retire.incomeChange ?? 0;
  retire.expenseChange = retire.expenseChange ?? -1200;
  return next;
}

export function monthlyIncome(profile: SingaporePlannerProfile) {
  return profile.incomeMode === "generic"
    ? positive(profile.monthlyIncome)
    : profile.income.reduce((total, item) => total + positive(item.amount), 0);
}

function activeEmploymentPeriod(profile: SingaporePlannerProfile, age: number) {
  const periods = profile.employmentPeriods ?? [];
  if (!periods.length) return undefined;
  return periods
    .filter((period) => age >= (positive(period.startAge) || positive(profile.age)) && age <= (positive(period.endAge) || positive(profile.retirementAge) || profile.endAge))
    .sort((a, b) => (positive(b.startAge) || 0) - (positive(a.startAge) || 0))[0];
}

function employmentIncome(profile: SingaporePlannerProfile, age: number) {
  const periods = profile.employmentPeriods ?? [];
  if (!periods.length) return undefined;
  const active = activeEmploymentPeriod(profile, age);
  if (!active) return 0;
  const startAge = positive(active.startAge) || positive(profile.age);
  const growth = 1 + toNumber(active.annualGrowth) / 100;
  return positive(active.grossMonthlyIncome) * growth ** Math.max(0, age - startAge);
}

function employmentCpfApplies(profile: SingaporePlannerProfile, age: number) {
  const active = activeEmploymentPeriod(profile, age);
  return active ? active.cpfApplies : true;
}

export function monthlyExpenses(profile: SingaporePlannerProfile) {
  return profile.expenseMode === "generic"
    ? positive(profile.monthlyExpenses)
    : profile.expenses.reduce((total, item) => total + positive(item.amount), 0);
}

export function projectionYear(profile: SingaporePlannerProfile, age: number) {
  return currentPolicyYear + Math.max(0, age - positive(profile.age));
}

export function frsForYear(year: number) {
  const known: Record<number, number> = { 2025: 213_000, 2026: 220_400, 2027: 228_200 };
  if (known[year]) return known[year];
  if (year < 2025) return Math.round((213_000 / 1.035 ** (2025 - year)) / 100) * 100;
  return Math.round((228_200 * 1.035 ** (year - 2027)) / 100) * 100;
}

export function retirementSumsForYear(year: number) {
  const frs = frsForYear(year);
  return { brs: Math.round(frs / 2 / 100) * 100, frs, ers: frs * 2 };
}

export function bhsForYear(year: number) {
  const known: Record<number, number> = {
    2016: 49_800,
    2017: 52_000,
    2018: 54_500,
    2019: 57_200,
    2020: 60_000,
    2021: 63_000,
    2022: 66_000,
    2023: 68_500,
    2024: 71_500,
    2025: 75_500,
    2026: 79_000
  };
  if (known[year]) return known[year];
  if (year < 2016) return 49_800;
  return Math.round((79_000 * 1.046 ** (year - 2026)) / 100) * 100;
}

function bhsForAge(profile: SingaporePlannerProfile, age: number) {
  const year = projectionYear(profile, age);
  const age65Year = projectionYear(profile, 65);
  return age >= 65 ? bhsForYear(age65Year) : bhsForYear(year);
}

type CpfRate = { total: number; employee: number };
type CpfAllocation = { oa: number; sa: number; ma: number };

function cpfAgeBand(age: number) {
  if (age <= 55) return "55";
  if (age <= 60) return "60";
  if (age <= 65) return "65";
  if (age <= 70) return "70";
  return "over70";
}

export function cpfAllocationRates(age: number, year = currentPolicyYear): CpfAllocation {
  if (age <= 35) return { oa: 0.6217, sa: 0.1621, ma: 0.2162 };
  if (age <= 45) return { oa: 0.5677, sa: 0.1891, ma: 0.2432 };
  if (age <= 50) return { oa: 0.5136, sa: 0.2162, ma: 0.2702 };
  if (age <= 55) return { oa: 0.4055, sa: 0.3108, ma: 0.2837 };
  if (year >= 2027 && age <= 60) return { oa: 0.3382, sa: 0.3661, ma: 0.2957 };
  if (year >= 2027 && age <= 65) return { oa: 0.1347, sa: 0.4615, ma: 0.4038 };
  if (age <= 60) return { oa: 0.353, sa: 0.3382, ma: 0.3088 };
  if (age <= 65) return { oa: 0.14, sa: 0.44, ma: 0.42 };
  if (age <= 70) return { oa: 0.0607, sa: 0.303, ma: 0.6363 };
  return { oa: 0.08, sa: 0.08, ma: 0.84 };
}

export function cpfContributionRates(profile: SingaporePlannerProfile, age: number, year = currentPolicyYear): CpfRate {
  const band = cpfAgeBand(age);
  const full: Record<string, CpfRate> = year >= 2027
    ? {
        "55": { total: 0.37, employee: 0.2 },
        "60": { total: 0.355, employee: 0.19 },
        "65": { total: 0.26, employee: 0.13 },
        "70": { total: 0.165, employee: 0.075 },
        over70: { total: 0.125, employee: 0.05 }
      }
    : {
        "55": { total: 0.37, employee: 0.2 },
        "60": { total: 0.34, employee: 0.18 },
        "65": { total: 0.25, employee: 0.125 },
        "70": { total: 0.165, employee: 0.075 },
        over70: { total: 0.125, employee: 0.05 }
      };
  if (profile.cpf.residency !== "Permanent Resident" || profile.cpf.prYear === "Third Year Or Later" || profile.cpf.prRateType === "Full Employer And Employee") {
    return full[band];
  }
  if (profile.cpf.prRateType === "Graduated Employer And Employee") {
    if (profile.cpf.prYear === "First Year") {
      if (band === "55" || band === "60") return { total: 0.09, employee: 0.05 };
      return { total: 0.085, employee: 0.05 };
    }
    if (band === "55") return { total: 0.24, employee: 0.15 };
    if (band === "60") return { total: 0.185, employee: 0.125 };
    if (band === "65") return { total: 0.11, employee: 0.075 };
    return { total: 0.085, employee: 0.05 };
  }
  if (profile.cpf.prYear === "First Year") {
    if (band === "55") return { total: 0.22, employee: 0.05 };
    if (band === "60") return { total: year >= 2027 ? 0.215 : 0.21, employee: 0.05 };
    if (band === "65") return { total: year >= 2027 ? 0.18 : 0.175, employee: 0.05 };
    if (band === "70") return { total: 0.14, employee: 0.05 };
    return { total: 0.125, employee: 0.05 };
  }
  if (band === "55") return { total: 0.32, employee: 0.15 };
  if (band === "60") return { total: year >= 2027 ? 0.29 : 0.285, employee: 0.125 };
  if (band === "65") return { total: year >= 2027 ? 0.205 : 0.2, employee: 0.075 };
  if (band === "70") return { total: 0.14, employee: 0.05 };
  return { total: 0.125, employee: 0.05 };
}

function monthlyCpfAmount(monthlyWage: number, rate: CpfRate) {
  if (monthlyWage <= 50) return { total: 0, employee: 0 };
  const employerRate = Math.max(0, rate.total - rate.employee);
  if (monthlyWage <= 500) return { total: monthlyWage * employerRate, employee: 0 };
  if (monthlyWage <= 750) {
    const employee = rate.employee * 3 * (monthlyWage - 500);
    return { total: monthlyWage * employerRate + employee, employee };
  }
  return { total: monthlyWage * rate.total, employee: monthlyWage * rate.employee };
}

export function cpfContribution(profile: SingaporePlannerProfile, age: number, annualIncome: number): CpfContribution {
  if ((profile.cpf.status || "Employed") !== "Employed") {
    const mandatoryEstimate = selfEmployedMedisaveContribution(age, annualIncome);
    const annualMaximum = selfEmployedMedisaveContribution(age, 96_000);
    const ma = Math.min(positive(profile.cpf.selfAnnual) || mandatoryEstimate, annualMaximum);
    return { oa: 0, sa: 0, ma, ra: 0, total: ma, employee: ma };
  }
  const year = projectionYear(profile, age);
  const rate = cpfContributionRates(profile, age, year);
  const allocation = cpfAllocationRates(age, year);
  const cpfWage = Math.min(8000, Math.max(0, annualIncome / 12)) * 12;
  const monthly = monthlyCpfAmount(cpfWage / 12, rate);
  const total = Math.min(monthly.total * 12, CPF_ANNUAL_CAP_2026);
  const employee = Math.min(monthly.employee * 12, total);
  const ma = total * allocation.ma;
  const saOrRa = total * allocation.sa;
  const oa = Math.max(0, total - ma - saOrRa);
  return age >= 55 ? { oa, sa: 0, ma, ra: saOrRa, total, employee } : { oa, sa: saOrRa, ma, ra: 0, total, employee };
}

/**
 * Estimates the mandatory MediSave contribution for a non-pensioner
 * self-employed person using CPF's 2026 Net Trade Income bands.
 */
export function selfEmployedMedisaveContribution(age: number, annualNetTradeIncome: number) {
  const nti = Math.max(0, annualNetTradeIncome);
  if (nti <= 6_000) return 0;

  const band = age < 35
    ? { baseRate: 0.04, upperRate: 0.08, phaseRate: 0.16 }
    : age < 45
      ? { baseRate: 0.045, upperRate: 0.09, phaseRate: 0.18 }
      : age < 50
        ? { baseRate: 0.05, upperRate: 0.10, phaseRate: 0.20 }
        : { baseRate: 0.0525, upperRate: 0.105, phaseRate: 0.21 };

  if (nti <= 12_000) return nti * band.baseRate;
  if (nti <= 18_000) return 12_000 * band.baseRate + (nti - 12_000) * band.phaseRate;
  return Math.min(nti, 96_000) * band.upperRate;
}

function cpfInterest(cpf: CpfNumberState, age: number) {
  let oa = cpf.oa * 0.025;
  let sa = cpf.sa * 0.04;
  let ma = cpf.ma * 0.04;
  let ra = cpf.ra * 0.04;
  const total = cpf.oa + cpf.sa + cpf.ma + cpf.ra;
  if (total > 0) {
    if (age < 55) {
      sa += Math.min(60_000, total) * 0.01;
    } else {
      ra += Math.min(30_000, total) * 0.02 + Math.min(30_000, Math.max(0, total - 30_000)) * 0.01;
    }
  }
  return { oa, sa, ma, ra };
}

function applyMedisaveCap(profile: SingaporePlannerProfile, cpf: CpfNumberState, age: number, retirementSavings = cpf.ra) {
  const cap = bhsForAge(profile, age);
  if (cpf.ma <= cap) return 0;
  const overflow = cpf.ma - cap;
  cpf.ma = cap;
  const retirementBalance = age >= 55 ? Math.max(cpf.ra, retirementSavings) : cpf.sa;
  const retirementRoom = Math.max(0, frsForYear(projectionYear(profile, age)) - retirementBalance);
  const retirementOverflow = Math.min(overflow, retirementRoom);
  if (age >= 55) cpf.ra += retirementOverflow;
  else cpf.sa += retirementOverflow;
  cpf.oa += Math.max(0, overflow - retirementOverflow);
  return overflow;
}

function cpfLifeMonthly(ra: number) {
  const points = [
    [82_400, 490],
    [170_100, 950],
    [227_900, 1250],
    [330_100, 1780],
    [445_600, 2380],
    [650_100, 3440]
  ];
  if (ra <= 0) return 0;
  if (ra <= points[0][0]) return (ra / points[0][0]) * points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    if (ra <= points[index][0]) {
      const a = points[index - 1];
      const b = points[index];
      const t = (ra - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return points.at(-1)![1];
}

function cpfLifeAnnual(profile: SingaporePlannerProfile, base: number, startAge: number, age: number, raBalance = base) {
  const override = positive(profile.cpf.lifeMonthlyOverride);
  let monthly = override > 0 ? override : cpfLifeMonthly(base);
  if (override > 0) {
    if (profile.cpf.lifePlan === "Escalating") monthly *= 1.02 ** Math.max(0, age - startAge);
    return monthly * 12;
  }
  if (profile.cpf.lifePlan === "Basic") {
    monthly *= 0.86;
    if (raBalance < 60_000) monthly *= 0.9 + 0.1 * Math.max(0, raBalance) / 60_000;
  }
  if (profile.cpf.lifePlan === "Escalating") monthly *= 0.78 * 1.02 ** Math.max(0, age - startAge);
  return monthly * 12;
}

export function incomeTaxResident(chargeableIncome: number) {
  const brackets = [
    [20_000, 0],
    [30_000, 0.02],
    [40_000, 0.035],
    [80_000, 0.07],
    [120_000, 0.115],
    [160_000, 0.15],
    [200_000, 0.18],
    [240_000, 0.19],
    [280_000, 0.195],
    [320_000, 0.2],
    [500_000, 0.22],
    [1_000_000, 0.23],
    [Infinity, 0.24]
  ];
  let tax = 0;
  let last = 0;
  const income = Math.max(0, chargeableIncome);
  for (const [limit, rate] of brackets) {
    const band = Math.max(0, Math.min(income, limit) - last);
    tax += band * rate;
    last = limit;
    if (income <= limit) break;
  }
  return tax;
}

export function annualIncomeTax(profile: SingaporePlannerProfile, annualGross: number, age = positive(profile.age), extraTaxableIncome = 0) {
  const employeeCpf = cpfContribution(profile, age, annualGross).employee;
  const donationRelief = positive(profile.tax.donations) * 2.5;
  const selectedReliefs = employeeCpf + donationRelief + positive(profile.tax.otherReliefs) + taxReliefSelectionsTotal(profile) + srsContributionAtAge(profile, age);
  const relief = Math.min(80_000, selectedReliefs);
  const chargeable = Math.max(0, annualGross + extraTaxableIncome - relief);
  return Math.max(0, incomeTaxResident(chargeable) - positive(profile.tax.rebates) - taxRebateSelectionsTotal(profile));
}

export function taxReliefSelectionsTotal(profile: SingaporePlannerProfile) {
  return Object.entries(profile.tax.reliefs ?? {}).reduce((total, [key, relief]) => total + (key === "parenthoodTaxRebate" || !relief?.enabled ? 0 : positive(relief.amount)), 0);
}

export function taxRebateSelectionsTotal(profile: SingaporePlannerProfile) {
  const rebate = profile.tax.reliefs?.parenthoodTaxRebate;
  return rebate?.enabled ? positive(rebate.amount) : 0;
}

export function srsCap(profile: SingaporePlannerProfile) {
  return profile.srs.citizenship === "Foreigner" ? 35_700 : 15_300;
}

export function srsContributionAtAge(profile: SingaporePlannerProfile, age: number) {
  if (!profile.srs.enabled) return 0;
  const start = positive(profile.srs.contributionStartAge) || positive(profile.age);
  const stop = positive(profile.srs.contributionStopAge) || positive(profile.retirementAge) || profile.endAge;
  if (age < start || age > stop) return 0;
  return Math.min(srsCap(profile), positive(profile.srs.annualContribution));
}

export function srsWithdrawalAtAge(profile: SingaporePlannerProfile, balance: number, age: number) {
  if (!profile.srs.enabled || balance <= 0) return 0;
  const start = positive(profile.srs.withdrawalStartAge) || positive(profile.retirementAge) || 63;
  if (age < start) return 0;
  if (profile.srs.withdrawalMethod === "Lump Sum") return age === start ? balance : 0;
  if (profile.srs.withdrawalMethod === "Custom Annual") return Math.min(balance, positive(profile.srs.customAnnualWithdrawal));
  const elapsed = Math.max(0, age - start);
  const remaining = Math.max(1, 10 - elapsed);
  return elapsed < 10 ? balance / remaining : balance;
}

function taxableSrsWithdrawal(profile: SingaporePlannerProfile, withdrawal: number) {
  if (!profile.srs.enabled) return 0;
  return withdrawal * (profile.srs.earlyWithdrawal ? 1 : 0.5);
}

function projectedIncome(profile: SingaporePlannerProfile, age: number) {
  const currentAge = positive(profile.age);
  const retired = profile.events.some((event) => event.type === "Retirement" && event.zeroIncome && age >= positive(event.age));
  if (retired) return 0;
  const growth = 1 + toNumber(profile.incomeInf) / 100;
  const employmentOverride = employmentIncome(profile, age);
  const base = employmentOverride === undefined ? monthlyIncome(profile) * growth ** Math.max(0, age - currentAge) : employmentOverride;
  const events = profile.events
    .filter((event) => age >= positive(event.age) && !event.zeroIncome)
    .reduce((total, event) => total + toNumber(event.incomeChange) * growth ** Math.max(0, age - currentAge), 0);
  return Math.max(0, base + events);
}

function projectedExpenses(profile: SingaporePlannerProfile, age: number) {
  const currentAge = positive(profile.age);
  const growth = 1 + toNumber(profile.expenseInf) / 100;
  const base = monthlyExpenses(profile) * growth ** Math.max(0, age - currentAge);
  const events = profile.events
    .filter((event) => age >= positive(event.age))
    .reduce((total, event) => total + toNumber(event.expenseChange) * growth ** Math.max(0, age - currentAge), 0);
  return Math.max(0, base + events);
}

function annualContribution(profile: SingaporePlannerProfile, asset: InvestmentHolding, age: number) {
  if (age < (positive(asset.contribStart) || positive(profile.age)) || age > (positive(asset.contribEnd) || profile.endAge)) return 0;
  if (asset.freq === "Monthly") return positive(asset.contrib) * 12;
  if (asset.freq === "Annually") return positive(asset.contrib);
  return 0;
}

function eventsAtAge(profile: SingaporePlannerProfile, age: number) {
  return profile.events.filter((event) => positive(event.age) === age);
}

function eventCosts(profile: SingaporePlannerProfile, age: number) {
  return eventsAtAge(profile, age).reduce((total, event) => total + positive(event.cost), 0);
}

function futureHousingAssets(profile: SingaporePlannerProfile): HousingAsset[] {
  return profile.events
    .filter((event) => event.type === "House" && event.housing)
    .map((event) => {
      const housing = event.housing!;
      const price = positive(housing.purchasePrice);
      const plannedCpf = Math.min(price, positive(housing.cpfOaDownpayment));
      const cashDownpayment = Math.min(Math.max(0, price - plannedCpf), positive(housing.cashDownpayment));
      const loan = positive(housing.loan) || Math.max(0, price - plannedCpf - cashDownpayment);
      return {
        id: `event-home-${event.id}`,
        label: event.label || "Future Home",
        value: price,
        appreciation: housing.appreciation,
        loan,
        rate: housing.rate,
        term: housing.term,
        saleAge: housing.saleAge,
        cpfUsed: 0,
        cpfAccruedInterest: 0,
        purchaseAge: event.age,
        annualPropertyTax: housing.annualPropertyTax,
        sourceEventId: event.id
      };
    });
}

type LoanLike = { rate: number | ""; term: number | "" };

export function monthlyMortgage(item: LoanLike, loan = 0, age = 0, startAge = age) {
  const elapsed = Math.max(0, age - startAge);
  const term = Math.max(1, positive(item.term) || 1);
  const years = Math.max(1, term - elapsed);
  const monthlyRate = toNumber(item.rate) / 100 / 12;
  const periods = years * 12;
  if (loan <= 0) return 0;
  return monthlyRate ? (loan * monthlyRate) / (1 - (1 + monthlyRate) ** -periods) : loan / periods;
}

function loanYear(item: LoanLike, loan: number, age: number, startAge: number) {
  const monthly = monthlyMortgage(item, loan, age, startAge);
  const annual = monthly * 12;
  const interest = loan * (toNumber(item.rate) / 100);
  const payment = Math.min(loan + interest, annual);
  const principal = Math.max(0, payment - interest);
  return { monthly, payment, interest, principal, endLoan: Math.max(0, loan - principal) };
}

function retirementTarget(profile: SingaporePlannerProfile, year: number) {
  const sums = retirementSumsForYear(year);
  if (profile.cpf.lifeSum === "Basic") return sums.brs;
  if (profile.cpf.lifeSum === "Enhanced") return sums.ers;
  return sums.frs;
}

function glideTargets(glidepath: PortfolioGlidepath) {
  const entries = Object.entries(glidepath.targetAlloc).filter(([, pct]) => positive(pct) > 0) as [InvestmentType, number][];
  const total = entries.reduce((sum, [, pct]) => sum + positive(pct), 0);
  return total ? entries.map(([type, pct]) => ({ type, pct: positive(pct) / total })) : [];
}

function shiftAssets(profile: SingaporePlannerProfile, values: Map<string, number>, age: number) {
  profile.shifts
    .filter((shift) => age >= positive(shift.age) && age < positive(shift.age) + Math.max(1, positive(shift.glideYears) || 1))
    .forEach((shift) => {
      const sourceAssets = profile.assets.filter((asset) => !asset.isShiftTarget && (shift.scope !== "selected" || asset.id === shift.from));
      const sourceTotal = sourceAssets.reduce((total, asset) => total + (values.get(asset.id) ?? 0), 0);
      const glideYears = Math.max(1, positive(shift.glideYears) || 1);
      const targetShare = Math.min(1, positive(shift.pct) / 100);
      const elapsedYears = Math.max(0, age - positive(shift.age));
      const priorSourceShare = Math.max(0, 1 - targetShare * elapsedYears / glideYears);
      const nextSourceShare = Math.max(0, 1 - targetShare * (elapsedYears + 1) / glideYears);
      const annualSlice = priorSourceShare > 0
        ? Math.min(1, (priorSourceShare - nextSourceShare) / priorSourceShare)
        : 0;
      const moveTotal = sourceTotal * annualSlice;
      const targets = glideTargets(shift);
      if (!sourceTotal || !moveTotal || !targets.length) return;

      sourceAssets.forEach((asset) => {
        const current = values.get(asset.id) ?? 0;
        values.set(asset.id, Math.max(0, current - moveTotal * (current / sourceTotal)));
      });

      targets.forEach((target) => {
        const targetAsset = ensureGlideTarget(profile, shift, target.type);
        values.set(targetAsset.id, (values.get(targetAsset.id) ?? 0) + moveTotal * target.pct);
      });
    });
}

function ensureGlideTarget(profile: SingaporePlannerProfile, shift: PortfolioGlidepath, type: InvestmentType) {
  const key = `glide-${shift.id}-${type}`;
  const assumption = glideAssumption(shift, type);
  let asset = profile.assets.find((holding) => holding.glideKey === key);
  if (!asset) {
    asset = {
      id: key,
      glideKey: key,
      label: `${type} Glidepath Bucket`,
      type,
      value: 0,
      ret: assumption.ret,
      contrib: 0,
      freq: "None",
      contribStart: "",
      contribEnd: "",
      divEnabled: assumption.divEnabled,
      divYield: assumption.divYield,
      divTreat: assumption.divTreat,
      drawdown: assumption.drawdown,
      isShiftTarget: true,
      color: "#8792a2"
    };
    profile.assets.push(asset);
  } else {
    asset.ret = assumption.ret;
    asset.divEnabled = assumption.divEnabled;
    asset.divYield = assumption.divYield;
    asset.divTreat = assumption.divTreat;
    asset.drawdown = assumption.drawdown;
  }
  return asset;
}

function glideAssumption(shift: PortfolioGlidepath, type: InvestmentType): GlidepathAssumption {
  const current = shift.targetAssumptions?.[type];
  return {
    ret: current?.ret ?? investmentReturnDefaults[type],
    divEnabled: current?.divEnabled ?? false,
    divYield: current?.divYield ?? "",
    divTreat: current?.divTreat ?? "Take dividends as cash",
    drawdown: current?.drawdown ?? true
  };
}

function drawdown(profile: SingaporePlannerProfile, values: Map<string, number>, need: number) {
  if (need <= 0) return 0;
  const assets = profile.assets.filter((asset) => asset.drawdown && (values.get(asset.id) ?? 0) > 0);
  const total = assets.reduce((sum, asset) => sum + (values.get(asset.id) ?? 0), 0);
  if (total <= 0) return 0;
  let left = need;
  assets.forEach((asset, index) => {
    const current = values.get(asset.id) ?? 0;
    const amount = Math.min(current, index === assets.length - 1 ? left : need * (current / total));
    values.set(asset.id, current - amount);
    left -= amount;
  });
  return need - Math.max(0, left);
}

function drawdownCustomAssets(profile: SingaporePlannerProfile, values: Map<string, number>, liabilities: Map<string, number>, need: number) {
  if (need <= 0) return 0;
  const assets = profile.customAssets.filter((asset) => asset.drawdown && Math.max(0, (values.get(asset.id) ?? 0) - (liabilities.get(asset.id) ?? 0)) > 0);
  const total = assets.reduce((sum, asset) => sum + Math.max(0, (values.get(asset.id) ?? 0) - (liabilities.get(asset.id) ?? 0)), 0);
  if (total <= 0) return 0;
  let left = need;
  assets.forEach((asset, index) => {
    const value = values.get(asset.id) ?? 0;
    const liability = liabilities.get(asset.id) ?? 0;
    const available = Math.max(0, value - liability);
    const amount = Math.min(available, index === assets.length - 1 ? left : need * (available / total));
    values.set(asset.id, value - amount);
    left -= amount;
  });
  return need - Math.max(0, left);
}

type CpfNumberState = { oa: number; sa: number; ma: number; ra: number };

export function careShieldPremium(profile: SingaporePlannerProfile, age: number) {
  if (!profile.healthcare.careShield.enabled || age < 30) return 0;
  const base = profile.gender === "Female" ? 253 : 206;
  const years = Math.max(0, age - 30);
  return base * 1.04 ** years + (profile.healthcare.careShield.enhancement ? positive(profile.healthcare.careShield.enhancementAnnualMedisave) : 0);
}

export function careShieldCoverageAnnual(profile: SingaporePlannerProfile, age: number) {
  if (!profile.healthcare.careShield.enabled || age < 30) return 0;
  const yearsFrom30 = Math.max(0, Math.min(age, 67) - 30);
  const policyYears = Math.max(0, Math.min(4, projectionYear(profile, age) - 2026));
  const baseMonthlyPayout = 689 * 1.04 ** policyYears * 1.02 ** Math.max(0, yearsFrom30 - 4);
  return (baseMonthlyPayout + positive(profile.healthcare.careShield.enhancementMonthlyBenefit)) * 12;
}

export function mediShieldBasePremium(age: number) {
  // CPF publishes MediShield Life premiums by "age next birthday"; profile ages are stored as age last birthday.
  const a = Math.max(1, Math.floor(age) + 1);
  if (a <= 20) return 200;
  if (a <= 30) return 295;
  if (a <= 40) return 503;
  if (a <= 50) return 637;
  if (a <= 60) return 903;
  if (a <= 65) return 1131;
  if (a <= 70) return 1326;
  if (a <= 73) return 1643;
  if (a <= 75) return 1816;
  if (a <= 78) return 2027;
  if (a <= 80) return 2187;
  if (a <= 83) return 2303;
  if (a <= 85) return 2616;
  if (a <= 90) return 2785;
  return 2826;
}

function mediShieldIncomeSubsidyRate(profile: SingaporePlannerProfile, age: number) {
  const settings = profile.healthcare.mediShield;
  if (settings.residency === "Foreigner" || settings.ownsMultipleProperties) return 0;
  const income = positive(settings.householdIncomePerPerson);
  const annualValue = positive(settings.annualValue);
  if (!income || annualValue > 31_000) return 0;
  const column = income <= 1500 ? 0 : income <= 2600 ? 1 : income <= 3600 ? 2 : null;
  if (column === null) return 0;
  const table = age <= 40 ? [25, 20, 15] : age <= 50 ? [30, 25, 20] : age <= 60 ? [35, 30, 20] : age <= 70 ? [40, 35, 25] : age <= 80 ? [45, 40, 30] : age <= 85 ? [50, 45, 30] : age <= 90 ? [55, 50, 35] : [60, 55, 40];
  let rate = table[column];
  if (annualValue > 21_000) rate = Math.max(0, rate - 10);
  if (settings.residency === "Permanent Resident") rate /= 2;
  return rate;
}

function mediShieldGenerationSubsidyRate(profile: SingaporePlannerProfile, age: number) {
  const generation = profile.healthcare.mediShield.generation;
  if (generation === "Merdeka Generation") return age >= 76 ? 10 : age >= 60 ? 5 : 0;
  if (generation === "Pioneer Generation") {
    if (age >= 91) return 60;
    if (age >= 81) return 54;
    if (age >= 71) return 44;
    if (age >= 66) return 40;
  }
  return 0;
}

export function mediShieldPremiumAtAge(profile: SingaporePlannerProfile, age: number) {
  const settings = profile.healthcare.mediShield;
  if (!settings.enabled || settings.residency === "Foreigner") return { base: 0, subsidy: 0, additional: 0, total: 0, rate: 0 };
  const base = mediShieldBasePremium(age);
  const rate = 0;
  const start = positive(settings.preExistingStartAge) || positive(profile.age) || age;
  const additional = settings.preExisting && age >= start && age < start + 10 ? base * 0.3 : 0;
  const subsidy = base * rate / 100;
  return { base, subsidy, additional, total: Math.max(0, base + additional - subsidy), rate };
}

function policyStartAge(policy: InsurancePolicy, profile: SingaporePlannerProfile) {
  return positive(policy.startAge) || positive(profile.age);
}

function policyInPremiumDuration(policy: InsurancePolicy, profile: SingaporePlannerProfile, age: number) {
  const start = policyStartAge(policy, profile);
  const duration = positive(policy.premiumDuration) || positive(policy.coverageDuration) || Math.max(0, profile.endAge - start + 1);
  return age >= start && age < start + duration;
}

function policyInCoverageDuration(policy: InsurancePolicy, profile: SingaporePlannerProfile, age: number) {
  const start = policyStartAge(policy, profile);
  const duration = positive(policy.coverageDuration) || Math.max(0, profile.endAge - start + 1);
  return age >= start && age < start + duration;
}

export function protectionAtAge(profile: SingaporePlannerProfile, age: number) {
  const activePolicies = profile.protection.policies.filter((policy) => policyInCoverageDuration(policy, profile, age));
  const premiumPolicies = profile.protection.policies.filter((policy) => policyInPremiumDuration(policy, profile, age));
  const death = positive(profile.protection.death) + activePolicies.reduce((sum, policy) => sum + positive(policy.death) + positive(policy.accidentDeath), 0);
  const tpd = positive(profile.protection.tpd) + activePolicies.reduce((sum, policy) => sum + positive(policy.tpd) + positive(policy.accidentTpd), 0);
  const majorCi = positive(profile.protection.majorCi) + activePolicies.reduce((sum, policy) => sum + positive(policy.majorCi), 0);
  const earlyCi = positive(profile.protection.earlyCi) + activePolicies.reduce((sum, policy) => sum + positive(policy.earlyCi), 0);
  const accident = positive(profile.protection.accident) + activePolicies.reduce((sum, policy) => sum + positive(policy.accidentMedical) + positive(policy.accidentDeath) + positive(policy.accidentTpd), 0);
  const disabilityMonthly = positive(profile.protection.disabilityMonthly) + activePolicies.reduce((sum, policy) => sum + positive(policy.disabilityMonthly), 0);
  const shieldCovered = profile.protection.shieldCovered || profile.healthcare.mediShield.enabled || activePolicies.some((policy) => policy.type === "Hospitalization" || policy.hospitalizationTier !== "None");
  const cashPremiums = positive(profile.protection.annualCashPremiums) + premiumPolicies.reduce((sum, policy) => {
    if (policy.type === "Hospitalization" && policy.insurer === "Great Eastern Life") return sum + geHospitalizationPremium(policy, age).cash;
    return sum + positive(policy.annualPremium);
  }, 0);
  const medisavePremiums = positive(profile.protection.annualMedisavePremiums) + premiumPolicies.reduce((sum, policy) => {
    if (policy.type === "Hospitalization" && policy.insurer === "Great Eastern Life") return sum + geHospitalizationPremium(policy, age).medisave;
    return sum + positive(policy.annualMedisavePremium);
  }, 0);
  return { death, tpd, majorCi, earlyCi, accident, disabilityMonthly, shieldCovered, cashPremiums, medisavePremiums };
}

export function projectSingaporeProfile(input: SingaporePlannerProfile): ProjectionYear[] {
  const profile = normalizeProfile(input);
  const start = Math.max(0, Math.floor(positive(profile.age)));
  const end = Math.max(start, Math.floor(profile.endAge || start));
  const values = new Map(profile.assets.map((asset) => [asset.id, positive(asset.value)]));
  const allHomes = [...profile.homes, ...futureHousingAssets(profile)];
  const homeValues = new Map(allHomes.map((asset) => [asset.id, positive(asset.purchaseAge) > start ? 0 : positive(asset.value)]));
  const homeLoans = new Map(allHomes.map((asset) => [asset.id, positive(asset.purchaseAge) > start ? 0 : positive(asset.loan)]));
  const homeCpfRefundLiability = new Map(allHomes.map((asset) => [asset.id, positive(asset.cpfUsed) + positive(asset.cpfAccruedInterest)]));
  const soldHomes = new Set<string>();
  const carValues = new Map(profile.cars.map((asset) => [asset.id, positive(asset.value)]));
  const carLoans = new Map(profile.cars.map((asset) => [asset.id, positive(asset.loan)]));
  const customValues = new Map(profile.customAssets.map((asset) => [asset.id, positive(asset.value)]));
  const customLiabilities = new Map(profile.customAssets.map((asset) => [asset.id, positive(asset.liability)]));
  const cpf: CpfNumberState = {
    oa: positive(profile.cpf.oa),
    sa: positive(profile.cpf.sa),
    ma: positive(profile.cpf.ma),
    ra: positive(profile.cpf.ra)
  };
  let cash = positive(profile.freeCash);
  let srsBalance = positive(profile.srs.currentBalance);
  let lifeStarted = false;
  let lifeBase = 0;
  let cpfLifeReserve = 0;
  const lifeStartAge = positive(profile.cpf.lifeStart) || 65;
  const rows: ProjectionYear[] = [];

  applyMedisaveCap(profile, cpf, start);
  if (start > 55 && cpf.sa > 0) {
    cpf.oa += cpf.sa;
    cpf.sa = 0;
  }

  for (let age = start; age <= end; age += 1) {
    const year = age - start;
    if (age === 55) {
      let target = retirementTarget(profile, projectionYear(profile, age));
      let need = Math.max(0, target - cpf.ra);
      const saMove = Math.min(cpf.sa, need);
      cpf.sa -= saMove;
      cpf.ra += saMove;
      need -= saMove;
      const oaMove = Math.min(cpf.oa, need);
      cpf.oa -= oaMove;
      cpf.ra += oaMove;
      if (cpf.sa > 0) {
        cpf.oa += cpf.sa;
        cpf.sa = 0;
      }
    }

    const activeIncome = projectedIncome(profile, age) * 12;
    let cpfLife = 0;
    if (age >= lifeStartAge) {
      if (!lifeStarted) {
        lifeStarted = true;
        lifeBase = cpf.ra;
        cpfLifeReserve = lifeBase;
        cpf.ra = profile.cpf.lifePlan === "Basic" ? cpf.ra * 0.85 : 0;
      }
      cpfLife = cpfLifeAnnual(profile, lifeBase, lifeStartAge, age, profile.cpf.lifePlan === "Basic" ? cpf.ra : cpfLifeReserve);
      if (profile.cpf.lifePlan === "Basic") {
        cpf.ra = Math.max(0, cpf.ra - cpfLife);
        cpfLifeReserve = cpf.ra;
      } else {
        cpfLifeReserve = Math.max(0, cpfLifeReserve - cpfLife);
      }
    }

    if (year > 0 && profile.srs.enabled) srsBalance *= 1 + toNumber(profile.srs.expectedReturn) / 100;
    const srsContribution = year > 0 ? srsContributionAtAge(profile, age) : 0;
    const srsWithdrawal = year > 0 ? srsWithdrawalAtAge(profile, srsBalance, age) : 0;
    srsBalance = Math.max(0, srsBalance + srsContribution - srsWithdrawal);

    const cpfContrib = employmentCpfApplies(profile, age) ? cpfContribution(profile, age, activeIncome) : { oa: 0, sa: 0, ma: 0, ra: 0, employee: 0, employer: 0, total: 0 };
    const annualIncome = activeIncome + cpfLife + srsWithdrawal;
    const takeHomeIncome = Math.max(0, activeIncome - cpfContrib.employee) + cpfLife + srsWithdrawal;
    const incomeTax = annualIncomeTax(profile, activeIncome, age, taxableSrsWithdrawal(profile, srsWithdrawal));
    const annualExpenses = projectedExpenses(profile, age) * 12;
    const lifeCosts = eventCosts(profile, age);
    let contribs = 0;
    let paidDivs = 0;
    let freeCashDraw = 0;
    let draw = 0;
    let srsDeficitDraw = 0;
    let otherAssetDraw = 0;
    let cpfDeficitDraw = 0;
    let unfundedShortfall = 0;
    let mortgageCash = 0;
    let mortgageCpf = 0;
    let homeSaleCash = 0;
    let homeSaleCpfRefund = 0;
    let homePurchaseCash = 0;
    let homePurchaseCpf = 0;
    let carLoanCash = 0;
    let carExpenses = 0;

    cpf.oa += cpfContrib.oa;
    cpf.sa += cpfContrib.sa;
    cpf.ma += cpfContrib.ma;
    if (lifeStarted && profile.cpf.lifePlan !== "Basic") cpf.oa += cpfContrib.ra;
    else if (age >= 55 && Math.max(cpf.ra, lifeBase) >= frsForYear(projectionYear(profile, age))) cpf.oa += cpfContrib.ra;
    else cpf.ra += cpfContrib.ra;
    applyMedisaveCap(profile, cpf, age, Math.max(cpf.ra, lifeBase, cpfLifeReserve));

    if (year > 0) {
      cash *= 1 + toNumber(profile.freeCashRate) / 100;
      let cpfMortgageBudget = cpfContrib.oa;
      shiftAssets(profile, values, age);

      allHomes.forEach((home) => {
        if (soldHomes.has(home.id)) return;
        const purchaseAge = positive(home.purchaseAge) || start;
        if (age < purchaseAge) return;
        const isPurchaseYear = Boolean(home.sourceEventId) && age === purchaseAge;
        if (isPurchaseYear) {
          const event = profile.events.find((item) => item.id === home.sourceEventId);
          const housing = event?.housing;
          const price = positive(home.value);
          const loanAtPurchase = positive(home.loan);
          const requiredEquity = Math.max(0, price - loanAtPurchase);
          const plannedCpf = Math.min(requiredEquity, positive(housing?.cpfOaDownpayment));
          const cpfUse = Math.min(cpf.oa, plannedCpf);
          cpf.oa -= cpfUse;
          homePurchaseCpf += cpfUse;
          homePurchaseCash += Math.max(0, requiredEquity - cpfUse);
          homeValues.set(home.id, price);
          homeLoans.set(home.id, loanAtPurchase);
          homeCpfRefundLiability.set(home.id, cpfUse);
        } else if (year > 0) {
          homeCpfRefundLiability.set(home.id, (homeCpfRefundLiability.get(home.id) ?? 0) * 1.025);
        }
        const openingValue = homeValues.get(home.id) ?? 0;
        const value = isPurchaseYear ? openingValue : openingValue * (1 + toNumber(home.appreciation) / 100);
        const loan = homeLoans.get(home.id) ?? 0;
        const saleAge = positive(home.saleAge);
        if (saleAge && age >= saleAge) {
          const proceeds = Math.max(0, value - loan);
          const estimatedCpfRefund = homeCpfRefundLiability.get(home.id) ?? 0;
          const cpfRefund = Math.min(proceeds, estimatedCpfRefund);
          cpf.oa += cpfRefund;
          cash += Math.max(0, proceeds - cpfRefund);
          homeSaleCash += Math.max(0, proceeds - cpfRefund);
          homeSaleCpfRefund += cpfRefund;
          homeValues.set(home.id, 0);
          homeLoans.set(home.id, 0);
          soldHomes.add(home.id);
          return;
        }
        const mortgage = loanYear(home, loan, age, start);
        const cpfUse = Math.min(cpf.oa, cpfMortgageBudget, mortgage.payment);
        cpf.oa -= cpfUse;
        cpfMortgageBudget -= cpfUse;
        mortgageCpf += cpfUse;
        homeCpfRefundLiability.set(home.id, (homeCpfRefundLiability.get(home.id) ?? 0) + cpfUse);
        mortgageCash += Math.max(0, mortgage.payment - cpfUse);
        homeValues.set(home.id, value);
        homeLoans.set(home.id, mortgage.endLoan);
      });

      profile.cars.forEach((car) => {
        const depreciation = toNumber(car.depreciation) || positive(car.value) / Math.max(1, positive(car.coeYearsLeft) || 1);
        const value = Math.max(0, (carValues.get(car.id) ?? 0) - depreciation);
        const loan = carLoans.get(car.id) ?? 0;
        const loanPayment = loanYear(car, loan, age, start);
        carLoanCash += loanPayment.payment;
        if (year <= positive(car.coeYearsLeft)) {
          carExpenses += positive(car.monthlyExpense) * 12 * (1 + toNumber(profile.expenseInf) / 100) ** year;
        }
        carValues.set(car.id, value);
        carLoans.set(car.id, loanPayment.endLoan);
      });

      profile.customAssets.forEach((asset) => {
        const value = Math.max(0, (customValues.get(asset.id) ?? 0) * (1 + toNumber(asset.growth) / 100));
        const loan = customLiabilities.get(asset.id) ?? 0;
        const loanPayment = loanYear({ rate: asset.liabilityRate, term: asset.liabilityTerm }, loan, age, start);
        customValues.set(asset.id, value);
        customLiabilities.set(asset.id, loanPayment.endLoan);
        carLoanCash += loanPayment.payment;
      });

      profile.assets.forEach((asset) => {
        let value = values.get(asset.id) ?? 0;
        const contribution = annualContribution(profile, asset, age);
        const dividend = asset.divEnabled ? value * (toNumber(asset.divYield) / 100) : 0;
        const growth = value * (toNumber(asset.ret) / 100);
        contribs += contribution;
        if (asset.divTreat === "Take dividends as cash") {
          paidDivs += dividend;
          value += contribution + growth;
        } else {
          value += contribution + growth + dividend;
        }
        values.set(asset.id, Math.max(0, value));
      });
    }

    const protection = protectionAtAge(profile, age);
    const cashPremiums = protection.cashPremiums;
    const medisavePremiums = protection.medisavePremiums;
    const careShield = careShieldPremium(profile, age);
    const mediShield = mediShieldPremiumAtAge(profile, age);
    const totalMedisavePremiums = medisavePremiums + careShield + mediShield.total;
    const medisavePaid = Math.min(cpf.ma, totalMedisavePremiums);
    const medisaveCashShortfall = Math.max(0, totalMedisavePremiums - medisavePaid);
    cpf.ma -= medisavePaid;

    const activeHomePropertyTax = allHomes.reduce((sum, home) => {
      const purchaseAge = positive(home.purchaseAge) || start;
      return age >= purchaseAge && !soldHomes.has(home.id) ? sum + positive(home.annualPropertyTax) : sum;
    }, 0);
    const gross = takeHomeIncome - incomeTax - annualExpenses - lifeCosts - homePurchaseCash - mortgageCash - carLoanCash - carExpenses - cashPremiums - medisaveCashShortfall - positive(profile.tax.propertyTaxAnnual) - activeHomePropertyTax;
    const excess = Math.max(0, gross);
    const retirementAge = positive(profile.retirementAge) || 65;
    const netCashFlowBeforeDrawdown = gross + paidDivs - contribs - srsContribution;
    const retirementCashFlowGap = age >= retirementAge ? Math.max(0, -netCashFlowBeforeDrawdown) : 0;
    if (year > 0) {
      const net = netCashFlowBeforeDrawdown;
      if (net >= 0) {
        cash += net;
      } else {
        let need = Math.abs(net);
        const cashUsed = Math.min(cash, need);
        cash -= cashUsed;
        freeCashDraw = cashUsed;
        need -= cashUsed;
        draw = drawdown(profile, values, need);
        need -= draw;
        // SRS is consumed only through the configured withdrawal schedule above,
        // where eligibility and tax are modelled. Never take an untaxed ad-hoc
        // deficit withdrawal from the remaining SRS balance here.
        otherAssetDraw = drawdownCustomAssets(profile, customValues, customLiabilities, need);
        need -= otherAssetDraw;
        if (need > 0 && age >= 55) {
          const oaUse = Math.min(cpf.oa, need);
          cpf.oa -= oaUse;
          need -= oaUse;
          cpfDeficitDraw = oaUse;
        }
        unfundedShortfall = Math.max(0, need);
      }
    }

    const interest = cpfInterest(cpf, age);
    if (lifeStarted && profile.cpf.lifePlan !== "Basic") interest.ra = 0;
    cpf.oa += interest.oa;
    cpf.sa += interest.sa;
    cpf.ma += interest.ma;
    cpf.ra += interest.ra;
    applyMedisaveCap(profile, cpf, age, Math.max(cpf.ra, lifeBase, cpfLifeReserve));
    if (lifeStarted && profile.cpf.lifePlan === "Basic") cpfLifeReserve = cpf.ra;
    if (lifeStarted && profile.cpf.lifePlan !== "Basic") cpf.ra = 0;

    const assets = profile.assets.map((asset) => {
      const projected = values.get(asset.id) ?? 0;
      return {
        ...asset,
        projected,
        growth: projected - positive(asset.value),
        yearContribution: year > 0 ? annualContribution(profile, asset, age) : 0,
        yearDividend: year > 0 ? projected * (toNumber(asset.divYield) / 100) : 0
      };
    });
    const homes = allHomes.filter((item) => age >= (positive(item.purchaseAge) || start)).map((item) => {
      const projected = homeValues.get(item.id) ?? 0;
      const loan = homeLoans.get(item.id) ?? 0;
      return { item, projected, loan, equity: Math.max(0, projected - loan), monthlyMortgage: monthlyMortgage(item, loan, age, start) };
    });
    const cars = profile.cars.map((item) => {
      const projected = carValues.get(item.id) ?? 0;
      const loan = carLoans.get(item.id) ?? 0;
      return { item, projected, loan, equity: Math.max(0, projected - loan), monthlyLoan: monthlyMortgage(item, loan, age, start) };
    });
    const customAssets = profile.customAssets.map((item) => {
      const projected = customValues.get(item.id) ?? 0;
      const liability = customLiabilities.get(item.id) ?? 0;
      return { item, projected, liability, equity: Math.max(0, projected - liability) };
    });
    const investmentValue = assets.reduce((sum, asset) => sum + asset.projected, 0);
    const housingValue = homes.reduce((sum, asset) => sum + asset.projected, 0);
    const housingDebt = homes.reduce((sum, asset) => sum + (asset.loan ?? 0), 0);
    const housingEquity = homes.reduce((sum, asset) => sum + asset.equity, 0);
    const carValue = cars.reduce((sum, asset) => sum + asset.projected, 0);
    const carDebt = cars.reduce((sum, asset) => sum + (asset.loan ?? 0), 0);
    const carEquity = cars.reduce((sum, asset) => sum + asset.equity, 0);
    const customValue = customAssets.reduce((sum, asset) => sum + asset.projected, 0);
    const customDebt = customAssets.reduce((sum, asset) => sum + (asset.liability ?? 0), 0);
    const customEquity = customAssets.reduce((sum, asset) => sum + asset.equity, 0);
    const cpfTotal = cpf.oa + cpf.sa + (lifeStarted && profile.cpf.lifePlan !== "Basic" ? 0 : cpf.ra) + cpf.ma;
    const annualCashOutflows =
      annualExpenses +
      incomeTax +
      cpfContrib.employee +
      lifeCosts +
      contribs +
      mortgageCash +
      mortgageCpf +
      homePurchaseCash +
      homePurchaseCpf +
      carLoanCash +
      carExpenses +
      cashPremiums +
      medisaveCashShortfall +
      medisavePremiums +
      careShield +
      mediShield.total +
      srsContribution +
      positive(profile.tax.propertyTaxAnnual) +
      activeHomePropertyTax;

    rows.push({
      age,
      year,
      investmentValue,
      housingValue,
      housingDebt,
      housingEquity,
      carValue,
      carDebt,
      carEquity,
      customValue,
      customDebt,
      customEquity,
      freeCash: cash,
      cpfTotal,
      totalAssets: investmentValue + cash + cpfTotal + (profile.includePropertyInNetWorth ? housingEquity : 0) + carEquity + customEquity + srsBalance,
      annualIncome,
      takeHomeIncome,
      activeIncome,
      cpfLifeIncome: cpfLife,
      annualIncomeTax: incomeTax,
      employeeCpfContribution: cpfContrib.employee,
      employerCpfContribution: Math.max(0, cpfContrib.total - cpfContrib.employee),
      cpfLifeBase: lifeBase,
      cpfLifeReserve,
      cpf: { ...cpf },
      cpfContribution: cpfContrib,
      annualExpenses,
      annualHomeSaleCash: homeSaleCash,
      annualHomeSaleCpfRefund: homeSaleCpfRefund,
      annualHomePurchaseCash: homePurchaseCash,
      annualHomePurchaseCpf: homePurchaseCpf,
      annualMortgageCash: mortgageCash,
      annualMortgageCpf: mortgageCpf,
      annualCarLoanCash: carLoanCash,
      annualCarExpenses: carExpenses,
      annualInsurancePremiums: cashPremiums + medisavePremiums + careShield + mediShield.total,
      annualInsuranceMedisavePremiums: medisavePremiums + careShield + mediShield.total,
      annualCareShieldPremiums: careShield,
      annualMediShieldPremiums: mediShield.total,
      annualMediShieldBasePremium: mediShield.base,
      annualMediShieldSubsidy: mediShield.subsidy,
      annualMediShieldAdditionalPremium: mediShield.additional,
      annualDividendIncome: paidDivs,
      annualSrsContribution: srsContribution,
      annualSrsWithdrawal: srsWithdrawal,
      srsBalance,
      annualLifeEventCosts: lifeCosts,
      annualCashOutflows,
      annualExcessCash: excess,
      annualInvestmentContributions: contribs,
      annualDividendsPaidOut: paidDivs,
      retirementCashFlowGap,
      annualFreeCashDrawdown: freeCashDraw,
      annualDrawdown: draw,
      annualSrsDeficitDrawdown: srsDeficitDraw,
      annualOtherAssetDrawdown: otherAssetDraw,
      annualCpfDeficitDrawdown: cpfDeficitDraw,
      annualUnfundedShortfall: unfundedShortfall,
      netCashFlow: netCashFlowBeforeDrawdown,
      triggeredLifeEvents: eventsAtAge(profile, age).map((event) => ({ ...event })),
      assets,
      homes,
      cars,
      customAssets
    });
  }

  return rows;
}

export function validateProfile(profile: SingaporePlannerProfile) {
  const errors: string[] = [];
  const age = positive(profile.age);
  if (profile.age !== "" && (age < 0 || age > 120)) errors.push("Current age should be between 0 and 120.");
  if (profile.retirementAge !== "" && positive(profile.retirementAge) < age) errors.push("Retirement age should be after current age.");
  if (profile.endAge < age) errors.push("Projection end age should be after current age.");
  profile.assets.forEach((asset) => {
    if (asset.ret !== "" && toNumber(asset.ret) <= -100) errors.push(`${asset.label || "Investment"} return must be above -100%.`);
    if (positive(asset.contribEnd) && positive(asset.contribStart) && positive(asset.contribEnd) < positive(asset.contribStart)) {
      errors.push(`${asset.label || "Investment"} contribution end age should be after start age.`);
    }
  });
  return [...new Set(errors)];
}
