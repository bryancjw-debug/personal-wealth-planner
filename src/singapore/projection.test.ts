import { describe, expect, it } from "vitest";
import { createQuickStartCoupleProfile } from "./defaults";
import { emptyFixture, quickStartFixture, retirementFixture, srsAndHealthcareFixture } from "./projection.fixtures";
import { annualIncomeTax, bhsForYear, careShieldPremium, cpfContribution, mediShieldPremiumAtAge, normalizeProfile, projectSingaporeProfile, protectionAtAge, selfEmployedMedisaveContribution, syncRetirementEvent, taxReliefSelectionsTotal, validateProfile } from "./projection";
import { geHospitalizationPremium } from "./geHospitalization";

function byAge(rows: ReturnType<typeof projectSingaporeProfile>, age: number) {
  const row = rows.find((item) => item.age === age);
  expect(row).toBeTruthy();
  return row!;
}

describe("Singapore projection golden fixtures", () => {
  it("keeps the blank profile stable and non-crashing", () => {
    const rows = projectSingaporeProfile(emptyFixture());
    expect(rows).toHaveLength(101);
    expect(rows[0]).toMatchObject({ age: 0, annualIncome: 0, totalAssets: 0 });
    expect(rows.at(-1)?.age).toBe(100);
  });

  it("projects the quick-start profile with CPF, investments, and free cash", () => {
    const rows = projectSingaporeProfile(quickStartFixture());
    const start = byAge(rows, 30);
    const age40 = byAge(rows, 40);
    expect(start.activeIncome).toBe(72_000);
    expect(start.employeeCpfContribution).toBeCloseTo(14_400, 0);
    expect(start.investmentValue).toBe(50_000);
    expect(age40.investmentValue).toBeGreaterThan(start.investmentValue);
    expect(age40.totalAssets).toBeGreaterThan(start.totalAssets);
    expect(age40.cpfTotal).toBeGreaterThan(start.cpfTotal);
  });

  it("honors a user-selected projection horizon below age 100", () => {
    const profile = quickStartFixture();
    profile.age = 30;
    profile.endAge = 72;

    const normalized = normalizeProfile(profile);
    const rows = projectSingaporeProfile(normalized);

    expect(normalized.endAge).toBe(72);
    expect(rows).toHaveLength(43);
    expect(rows[0].age).toBe(30);
    expect(rows.at(-1)?.age).toBe(72);
    expect(rows.some((row) => row.age === 73)).toBe(false);
  });

  it("reports a projection horizon earlier than the current age", () => {
    const profile = quickStartFixture();
    profile.age = 50;
    profile.endAge = 49;

    expect(validateProfile(normalizeProfile(profile))).toContain("Projection end age should be after current age.");
  });

  it("uses the selected household horizon for both people in couple mode", () => {
    const profile = createQuickStartCoupleProfile();
    profile.endAge = 78;

    const normalized = normalizeProfile(profile);

    expect(normalized.endAge).toBe(78);
    expect(normalized.couple?.partner.endAge).toBe(78);
    expect(projectSingaporeProfile(normalized.couple!.partner).at(-1)?.age).toBe(78);
  });

  it("excludes property equity from net worth by default and includes it when selected", () => {
    const profile = quickStartFixture();
    profile.age = 40;
    profile.endAge = 40;
    profile.homes = [{
      id: "home",
      label: "Home",
      value: 1_000_000,
      appreciation: 0,
      loan: 400_000,
      rate: 0,
      term: 20
    }];

    const excluded = projectSingaporeProfile(normalizeProfile({ ...profile, includePropertyInNetWorth: false }))[0];
    const included = projectSingaporeProfile(normalizeProfile({ ...profile, includePropertyInNetWorth: true }))[0];

    expect(excluded.housingEquity).toBe(600_000);
    expect(included.totalAssets - excluded.totalAssets).toBe(600_000);
    expect(excluded.annualMortgageCash).toBe(included.annualMortgageCash);
  });

  it("uses employment periods as income overrides without double-counting baseline income", () => {
    const profile = quickStartFixture();
    profile.age = 30;
    profile.retirementAge = 65;
    profile.endAge = 66;
    profile.monthlyIncome = 6000;
    profile.incomeInf = 0;
    profile.employmentPeriods = [
      {
        id: "career",
        label: "Mid-Career Role",
        startAge: 35,
        endAge: 40,
        grossMonthlyIncome: 10000,
        annualGrowth: 0,
        cpfApplies: true
      }
    ];

    const rows = projectSingaporeProfile(profile);
    expect(byAge(rows, 34).activeIncome).toBe(0);
    expect(byAge(rows, 35).activeIncome).toBe(120_000);
    expect(byAge(rows, 40).activeIncome).toBe(120_000);
    expect(byAge(rows, 41).activeIncome).toBe(0);
  });

  it("allows employment periods without CPF contributions for self-employed or career-break modelling", () => {
    const profile = quickStartFixture();
    profile.age = 30;
    profile.endAge = 31;
    profile.employmentPeriods = [
      {
        id: "contract",
        label: "Contract Work",
        startAge: 30,
        endAge: 31,
        grossMonthlyIncome: 6000,
        annualGrowth: 0,
        cpfApplies: false
      }
    ];

    const start = byAge(projectSingaporeProfile(profile), 30);
    expect(start.activeIncome).toBe(72_000);
    expect(start.employeeCpfContribution).toBe(0);
    expect(start.employerCpfContribution).toBe(0);
  });

  it("applies CPF contribution and allocation rates by residency, PR year, and age band", () => {
    const citizen = quickStartFixture();
    citizen.age = 30;
    citizen.monthlyIncome = 8000;
    const citizen30 = cpfContribution(citizen, 30, 96_000);
    expect(citizen30.total).toBeCloseTo(35_520, 0);
    expect(citizen30.employee).toBeCloseTo(19_200, 0);
    expect(citizen30.oa).toBeCloseTo(citizen30.total * 0.6217, 1);

    const firstYearPr = quickStartFixture();
    firstYearPr.age = 30;
    firstYearPr.cpf.residency = "Permanent Resident";
    firstYearPr.cpf.prYear = "First Year";
    firstYearPr.cpf.prRateType = "Graduated Employer And Employee";
    const pr30 = cpfContribution(firstYearPr, 30, 96_000);
    expect(pr30.total).toBeCloseTo(8_640, 0);
    expect(pr30.employee).toBeCloseTo(4_800, 0);

    const future = quickStartFixture();
    future.age = 56;
    future.monthlyIncome = 8000;
    const future57 = cpfContribution(future, 57, 96_000);
    expect(future57.total).toBeCloseTo(34_080, 0);
    expect(future57.employee).toBeCloseTo(18_240, 0);
    expect(future57.ra).toBeCloseTo(future57.total * 0.3661, 1);
  });

  it("uses the official 2026 non-pensioner MediSave bands for self-employed users", () => {
    expect(selfEmployedMedisaveContribution(30, 6_000)).toBe(0);
    expect(selfEmployedMedisaveContribution(30, 12_000)).toBeCloseTo(480, 0);
    expect(selfEmployedMedisaveContribution(30, 18_000)).toBeCloseTo(1_440, 0);
    expect(selfEmployedMedisaveContribution(30, 96_000)).toBeCloseTo(7_680, 0);
    expect(selfEmployedMedisaveContribution(40, 96_000)).toBeCloseTo(8_640, 0);
    expect(selfEmployedMedisaveContribution(47, 96_000)).toBeCloseTo(9_600, 0);
    expect(selfEmployedMedisaveContribution(50, 96_000)).toBeCloseTo(10_080, 0);
  });

  it("routes self-employed MediSave overflow correctly and funds the mortgage from cash", () => {
    const profile = quickStartFixture();
    profile.age = 30;
    profile.endAge = 31;
    profile.monthlyIncome = 8_000;
    profile.cpf.status = "Self-employed";
    profile.cpf.selfAnnual = 0;
    profile.cpf.oa = 50_000;
    profile.cpf.sa = 0;
    profile.cpf.ma = bhsForYear(2026);
    profile.homes = [{
      id: "home",
      label: "Home",
      value: 800_000,
      appreciation: 0,
      loan: 300_000,
      rate: 2.6,
      term: 20
    }];

    const age31 = byAge(projectSingaporeProfile(profile), 31);
    expect(age31.cpfContribution.oa).toBe(0);
    expect(age31.cpfContribution.sa).toBe(0);
    expect(age31.cpfContribution.ma).toBeCloseTo(7_680, 0);
    expect(age31.cpf.sa).toBeGreaterThan(0);
    expect(age31.annualMortgageCpf).toBe(0);
    expect(age31.annualMortgageCash).toBeGreaterThan(0);
  });

  it("uses employed OA contributions first for mortgage payments and cash for the remainder", () => {
    const profile = quickStartFixture();
    profile.age = 30;
    profile.endAge = 31;
    profile.monthlyIncome = 8_000;
    profile.cpf.status = "Employed";
    profile.homes = [{
      id: "home",
      label: "Home",
      value: 800_000,
      appreciation: 0,
      loan: 300_000,
      rate: 2.6,
      term: 20
    }];

    const age31 = byAge(projectSingaporeProfile(profile), 31);
    expect(age31.cpfContribution.oa).toBeGreaterThan(0);
    expect(age31.annualMortgageCpf).toBeGreaterThan(0);
    expect(age31.annualMortgageCpf).toBeLessThanOrEqual(age31.cpfContribution.oa);
    expect(age31.annualMortgageCash).toBeGreaterThanOrEqual(0);
  });

  it("forms RA and sets active income to zero after retirement", () => {
    const rows = projectSingaporeProfile(retirementFixture());
    const age55 = byAge(rows, 55);
    const age62 = byAge(rows, 62);
    const age65 = byAge(rows, 65);
    expect(age55.cpf.ra).toBeGreaterThan(0);
    expect(age62.activeIncome).toBe(0);
    expect(age65.cpfLifeIncome).toBeGreaterThan(0);
    expect(age65.cpfLifeReserve).toBeGreaterThan(0);
  });

  it("treats retirement expense changes as today's dollars and inflates them to retirement age", () => {
    const profile = retirementFixture();
    profile.age = 40;
    profile.retirementAge = 42;
    profile.endAge = 43;
    profile.expenseMode = "generic";
    profile.monthlyExpenses = 1000;
    profile.expenseInf = 10;
    profile.events = [
      {
        id: "retire",
        label: "Retirement",
        type: "Retirement",
        age: 42,
        cost: 0,
        incomeChange: 0,
        expenseChange: -100,
        zeroIncome: true
      }
    ];

    const age42 = byAge(projectSingaporeProfile(profile), 42);
    expect(age42.annualExpenses).toBeCloseTo((1000 - 100) * 1.1 ** 2 * 12, 0);
  });

  it("does not force an edited retirement event back to zero income", () => {
    const profile = retirementFixture();
    const synced = syncRetirementEvent([{ ...profile.events[0], zeroIncome: false }], 62);
    expect(synced.find((event) => event.type === "Retirement")?.zeroIncome).toBe(false);
  });

  it("differentiates CPF LIFE retirement sum and plan choices", () => {
    const full = retirementFixture();
    full.endAge = 75;
    full.cpf.oa = 700_000;
    full.cpf.sa = 250_000;
    full.cpf.lifeSum = "Full";
    full.cpf.lifePlan = "Standard";

    const enhanced = { ...full, cpf: { ...full.cpf, lifeSum: "Enhanced" as const } };
    const basic = { ...full, cpf: { ...full.cpf, lifePlan: "Basic" as const } };
    const escalating = { ...full, cpf: { ...full.cpf, lifePlan: "Escalating" as const } };

    const full65 = byAge(projectSingaporeProfile(full), 65);
    const full66 = byAge(projectSingaporeProfile(full), 66);
    const enhanced65 = byAge(projectSingaporeProfile(enhanced), 65);
    const basic65 = byAge(projectSingaporeProfile(basic), 65);
    const basic75 = byAge(projectSingaporeProfile(basic), 75);
    const escalating65 = byAge(projectSingaporeProfile(escalating), 65);
    const escalating75 = byAge(projectSingaporeProfile(escalating), 75);

    expect(enhanced65.cpfLifeIncome).toBeGreaterThan(full65.cpfLifeIncome);
    expect(full66.cpf.ra).toBe(0);
    expect(full66.cpfLifeReserve).toBeGreaterThan(0);
    expect(basic65.cpfLifeIncome).toBeLessThan(full65.cpfLifeIncome);
    expect(basic75.cpfLifeIncome).toBeLessThanOrEqual(basic65.cpfLifeIncome * 1.02);
    expect(escalating65.cpfLifeIncome).toBeLessThan(full65.cpfLifeIncome);
    expect(escalating75.cpfLifeIncome).toBeGreaterThan(escalating65.cpfLifeIncome);
  });

  it("uses official CPF LIFE monthly payout override when supplied", () => {
    const profile = retirementFixture();
    profile.age = 62;
    profile.retirementAge = 65;
    profile.endAge = 66;
    profile.monthlyIncome = 0;
    profile.cpf.oa = 0;
    profile.cpf.sa = 0;
    profile.cpf.ma = 0;
    profile.cpf.ra = 314_018;
    profile.cpf.lifeStart = 65;
    profile.cpf.lifePlan = "Standard";
    profile.cpf.lifeMonthlyOverride = 1900;

    const age65 = byAge(projectSingaporeProfile(profile), 65);
    const age66 = byAge(projectSingaporeProfile(profile), 66);
    expect(age65.cpfLifeIncome).toBeCloseTo(22_800, 0);
    expect(age66.cpfLifeIncome).toBeCloseTo(22_800, 0);
  });

  it("includes SRS, CareShield, and MediShield in assets and outflows", () => {
    const rows = projectSingaporeProfile(srsAndHealthcareFixture());
    const age35 = byAge(rows, 35);
    const age63 = byAge(rows, 63);
    expect(age35.annualSrsContribution).toBe(15_300);
    expect(age35.srsBalance).toBeGreaterThan(30_000);
    expect(age35.annualCareShieldPremiums).toBeGreaterThan(0);
    expect(age35.annualMediShieldPremiums).toBeGreaterThan(0);
    expect(age35.annualInsuranceMedisavePremiums).toBeCloseTo(age35.annualCareShieldPremiums + age35.annualMediShieldPremiums, 1);
    const withoutMediShield = srsAndHealthcareFixture();
    withoutMediShield.healthcare.mediShield.enabled = false;
    expect(age35.cpf.ma).toBeLessThan(byAge(projectSingaporeProfile(withoutMediShield), 35).cpf.ma);
    expect(age63.annualSrsWithdrawal).toBeGreaterThan(0);
  });

  it("keeps healthcare premium assumptions deterministic", () => {
    const profile = srsAndHealthcareFixture();
    profile.age = 30;
    profile.gender = "Male";
    expect(careShieldPremium(profile, 30)).toBeCloseTo(806, 0);
    const medishield = mediShieldPremiumAtAge(profile, 40);
    expect(medishield.base).toBe(637);
    expect(medishield.subsidy).toBe(0);
    expect(medishield.total).toBe(637);
  });

  it("auto-populates GE hospitalization premiums for active policy years", () => {
    const profile = quickStartFixture();
    profile.protection.policies = [
      {
        id: "ge-hospital",
        type: "Hospitalization",
        name: "GE Private Shield",
        insurer: "Great Eastern Life",
        geBasePlan: "P Plus",
        geTotalCare2Tier: "P",
        geTotalCarePlus2: true,
        startAge: 30,
        annualPremium: "",
        annualMedisavePremium: "",
        premiumDuration: 5,
        coverageDuration: 20,
        death: "",
        tpd: "",
        majorCi: "",
        earlyCi: "",
        accidentMedical: "",
        accidentDeath: "",
        accidentTpd: "",
        disabilityMonthly: "",
        hospitalizationTier: "Private"
      }
    ];
    const premium = geHospitalizationPremium(profile.protection.policies[0], 30);
    expect(premium.medisave).toBeCloseTo(456.71, 2);
    expect(premium.cash).toBeCloseTo(1024.6, 1);
    expect(geHospitalizationPremium(profile.protection.policies[0], 79).medisave).toBeCloseTo(11607.41, 2);
    expect(geHospitalizationPremium(profile.protection.policies[0], 84).medisave).toBeCloseTo(13120.33, 2);
    expect(geHospitalizationPremium(profile.protection.policies[0], 96).medisave).toBeCloseTo(13711.11, 2);
    expect(geHospitalizationPremium(profile.protection.policies[0], 41).cash).toBeCloseTo(1669.88, 2);
    expect(geHospitalizationPremium(profile.protection.policies[0], 86).cash).toBeCloseTo(10845.5, 2);
    expect(protectionAtAge(profile, 30).medisavePremiums).toBeCloseTo(456.71, 2);
    expect(protectionAtAge(profile, 36).cashPremiums).toBe(0);
  });

  it("applies selected tax reliefs and rebates to resident tax", () => {
    const profile = quickStartFixture();
    profile.tax.reliefs.parent = { enabled: true, amount: 9000 };
    profile.tax.reliefs.parenthoodTaxRebate = { enabled: true, amount: 5000, year: 2026 };
    const baseTax = annualIncomeTax({ ...profile, tax: { ...profile.tax, reliefs: {}, rebates: "" } }, 120_000, 35);
    const adjustedTax = annualIncomeTax(profile, 120_000, 35);
    expect(taxReliefSelectionsTotal(profile)).toBe(9000);
    expect(adjustedTax).toBeLessThan(baseTax);
  });

  it("allows a 100 percent retirement glidepath re-allocation into target buckets", () => {
    const profile = quickStartFixture();
    profile.endAge = 68;
    profile.shifts = [
      {
        id: "glide",
        label: "Retirement Glidepath",
        age: 60,
        pct: 100,
        glideYears: 0,
        futureContrib: true,
        scope: "all",
        targetAlloc: { Bonds: 70, "Cash holdings": 30 },
        targetAssumptions: {
          Bonds: { ret: 3.5, divEnabled: true, divYield: 3, divTreat: "Take dividends as cash", drawdown: true },
          "Cash holdings": { ret: 0.05, divEnabled: false, divYield: "", divTreat: "Take dividends as cash", drawdown: true }
        }
      }
    ];
    const age60 = byAge(projectSingaporeProfile(profile), 60);
    const shifted = age60.assets.filter((asset) => asset.isShiftTarget && asset.projected > 0);
    expect(shifted.map((asset) => asset.type).sort()).toEqual(["Bonds", "Cash holdings"]);
    expect(shifted.reduce((sum, asset) => sum + asset.projected, 0)).toBeGreaterThan(0);
  });

  it("completes a multi-year 100 percent glidepath by its final year", () => {
    const profile = quickStartFixture();
    profile.age = 59;
    profile.endAge = 65;
    profile.assets = [{ ...profile.assets[0], value: 100_000, contrib: 0, freq: "None", ret: 0, divEnabled: false }];
    profile.shifts = [{
      id: "five-year-glide",
      label: "Five year glide",
      age: 60,
      pct: 100,
      glideYears: 5,
      futureContrib: true,
      scope: "all",
      targetAlloc: { Bonds: 100 },
      targetAssumptions: { Bonds: { ret: 0, divEnabled: false, divYield: "", divTreat: "Take dividends as cash", drawdown: true } }
    }];

    const final = byAge(projectSingaporeProfile(profile), 64);
    expect(final.assets.filter(asset => !asset.isShiftTarget).reduce((sum, asset) => sum + asset.projected, 0)).toBeCloseTo(0, 5);
    expect(final.assets.filter(asset => asset.isShiftTarget).reduce((sum, asset) => sum + asset.projected, 0)).toBeCloseTo(100_000, 5);
  });

  it("does not use CPF OA to cover a cash-flow deficit before age 55", () => {
    const profile = quickStartFixture();
    profile.age = 40;
    profile.endAge = 41;
    profile.monthlyIncome = 0;
    profile.monthlyExpenses = 5_000;
    profile.freeCash = 0;
    profile.assets = [];
    profile.customAssets = [];
    profile.cpf.oa = 100_000;
    profile.srs.enabled = false;

    const row = byAge(projectSingaporeProfile(profile), 41);
    expect(row.annualCpfDeficitDrawdown).toBe(0);
    expect(row.annualUnfundedShortfall).toBeGreaterThan(0);
    expect(row.cpf.oa).toBeGreaterThan(0);
  });

  it("moves MediSave premium amounts above the MA balance into the cash-flow need", () => {
    const profile = quickStartFixture();
    profile.age = 40;
    profile.endAge = 41;
    profile.monthlyIncome = 0;
    profile.monthlyExpenses = 0;
    profile.freeCash = 10_000;
    profile.assets = [];
    profile.customAssets = [];
    profile.cpf.oa = 0;
    profile.cpf.sa = 0;
    profile.cpf.ma = 0;
    profile.protection.annualCashPremiums = 0;
    profile.protection.annualMedisavePremiums = 2_400;
    profile.healthcare.mediShield.enabled = false;
    profile.healthcare.careShield.enabled = false;
    profile.srs.enabled = false;

    const row = byAge(projectSingaporeProfile(profile), 41);
    expect(row.annualFreeCashDrawdown).toBeCloseTo(2_400, 0);
    expect(row.freeCash).toBeLessThan(10_000);
  });

  it("models housing sale proceeds with CPF OA refund before free cash proceeds", () => {
    const profile = quickStartFixture();
    profile.age = 40;
    profile.endAge = 42;
    profile.homes = [
      {
        id: "home",
        label: "Flat",
        value: 500_000,
        appreciation: 0,
        loan: 100_000,
        rate: 2.6,
        term: 20,
        saleAge: 41,
        cpfUsed: 200_000,
        cpfAccruedInterest: 0
      }
    ];
    const age41 = byAge(projectSingaporeProfile(profile), 41);
    expect(age41.annualHomeSaleCpfRefund).toBeGreaterThan(200_000);
    expect(age41.annualHomeSaleCash).toBeGreaterThan(0);
    expect(age41.housingValue).toBe(0);
  });

  it("activates a future house purchase at the event age and funds the upfront CPF OA portion", () => {
    const profile = quickStartFixture();
    profile.age = 40;
    profile.endAge = 42;
    profile.cpf.oa = 120_000;
    profile.freeCash = 100_000;
    profile.events.push({
      id: "future-home",
      label: "Future flat",
      type: "House",
      age: 41,
      cost: 8_000,
      incomeChange: 0,
      expenseChange: 0,
      zeroIncome: false,
      housing: {
        purchasePrice: 500_000,
        cashDownpayment: 50_000,
        cpfOaDownpayment: 100_000,
        loan: 350_000,
        rate: 2.6,
        term: 25,
        appreciation: 2,
        annualPropertyTax: 1_200,
        saleAge: ""
      }
    });

    const rows = projectSingaporeProfile(profile);
    const age40 = byAge(rows, 40);
    const age41 = byAge(rows, 41);

    expect(age40.housingValue).toBe(0);
    expect(age41.housingValue).toBe(500_000);
    expect(age41.housingDebt).toBeLessThan(350_000);
    expect(age41.annualHomePurchaseCpf).toBe(100_000);
    expect(age41.annualHomePurchaseCash).toBe(50_000);
    expect(age41.annualMortgageCpf).toBeGreaterThan(0);
    expect(age41.annualCashOutflows).toBeGreaterThan(age41.annualExpenses + 159_000);
  });

  it("converts an unavailable planned CPF OA downpayment into cash funding", () => {
    const profile = quickStartFixture();
    profile.age = 40;
    profile.endAge = 41;
    profile.cpf.oa = 20_000;
    profile.events.push({
      id: "cpf-limited-home",
      label: "Future home",
      type: "House",
      age: 41,
      cost: 0,
      incomeChange: 0,
      expenseChange: 0,
      zeroIncome: false,
      housing: {
        purchasePrice: 500_000,
        cashDownpayment: 50_000,
        cpfOaDownpayment: 100_000,
        loan: 350_000,
        rate: 2.6,
        term: 25,
        appreciation: 2,
        annualPropertyTax: 0,
        saleAge: ""
      }
    });

    const age41 = byAge(projectSingaporeProfile(profile), 41);
    expect(age41.annualHomePurchaseCpf).toBeLessThan(100_000);
    expect(age41.annualHomePurchaseCash + age41.annualHomePurchaseCpf).toBe(150_000);
  });
});
