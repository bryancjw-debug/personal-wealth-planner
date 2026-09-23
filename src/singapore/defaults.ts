import type { InvestmentType, LifeEvent, SingaporePlannerProfile } from "./types";

export const CPF_ANNUAL_CAP_2026 = 37_740;

export const investmentReturnDefaults: Record<InvestmentType, number> = {
  Equities: 7,
  "Funds / ETFs": 6,
  Bonds: 3.5,
  "Cash holdings": 2,
  Crypto: 10,
  Commodities: 4,
  Endowments: 3.5,
  Other: 5
};

export const investmentTypes = Object.keys(investmentReturnDefaults) as InvestmentType[];

export const chartColors = {
  asset: "hsl(var(--ui-primary))",
  income: "hsl(var(--ui-info))",
  expense: "hsl(var(--ui-destructive))",
  cashflow: "hsl(var(--ui-success))"
};

export const allocationColors = [
  "#5E7CE2",
  "#4A7FA7",
  "#FCA311",
  "#36A27B",
  "#8B75E8",
  "#D39231",
  "#B3CFE5",
  "#8792a2"
];

export function retirementEvent(age: number | "" = ""): LifeEvent {
  return {
    id: "retire",
    label: "Retirement",
    type: "Retirement",
    age,
    cost: 0,
    incomeChange: 0,
    expenseChange: -1200,
    zeroIncome: true
  };
}

export function createDefaultProfile(): SingaporePlannerProfile {
  return {
    planningMode: "Individual",
    name: "",
    occupation: "",
    gender: "Male",
    age: "",
    retirementAge: "",
    endAge: 100,
    dark: true,
    welcomed: false,
    includePropertyInNetWorth: false,
    freeCash: "",
    freeCashRate: 0.05,
    incomeInf: 3,
    expenseInf: 2.5,
    taxMode: "monthly",
    incomeMode: "generic",
    expenseMode: "generic",
    monthlyIncome: "",
    monthlyExpenses: "",
    income: [],
    expenses: [],
    cpf: {
      status: "Employed",
      residency: "Singapore Citizen",
      prYear: "Third Year Or Later",
      prRateType: "Full Employer And Employee",
      oa: "",
      sa: "",
      ma: "",
      ra: "",
      lifeStart: 65,
      selfAnnual: 0,
      lifeSum: "Full",
      lifePlan: "Standard",
      lifeMonthlyOverride: ""
    },
    assets: [
      {
        id: "etf",
        label: "First investment",
        type: "Funds / ETFs",
        value: "",
        ret: 6,
        contrib: "",
        freq: "None",
        contribStart: "",
        contribEnd: "",
        divEnabled: false,
        divYield: "",
        divTreat: "Take dividends as cash",
        drawdown: true,
        color: allocationColors[0]
      }
    ],
    homes: [],
    cars: [],
    customAssets: [],
    events: [retirementEvent()],
    employmentPeriods: [],
    shifts: [],
    healthcare: {
      careShield: {
        enabled: false,
        enhancement: false,
        enhancementAnnualMedisave: 600,
        enhancementMonthlyBenefit: ""
      },
      mediShield: {
        enabled: false,
        residency: "Singapore Citizen / PR",
        subsidyMode: "None",
        householdIncomePerPerson: "",
        annualValue: "",
        ownsMultipleProperties: false,
        generation: "None",
        manualSubsidyPct: "",
        preExisting: false,
        preExistingStartAge: ""
      }
    },
    protection: {
      annualCashPremiums: "",
      annualMedisavePremiums: "",
      death: "",
      tpd: "",
      majorCi: "",
      earlyCi: "",
      accident: "",
      disabilityMonthly: "",
      shieldCovered: false,
      policies: []
    },
    tax: {
      donations: "",
      propertyTaxAnnual: "",
      otherReliefs: "",
      rebates: "",
      reliefs: {}
    },
    srs: {
      enabled: false,
      citizenship: "Singapore Citizen / PR",
      currentBalance: "",
      annualContribution: "",
      contributionStartAge: "",
      contributionStopAge: "",
      expectedReturn: 5,
      withdrawalStartAge: "",
      withdrawalMethod: "10-Year Drawdown",
      customAnnualWithdrawal: "",
      earlyWithdrawal: false,
      drawdown: true
    }
  };
}

export function createDefaultPartnerProfile(): SingaporePlannerProfile {
  const partner = createDefaultProfile();
  partner.name = "";
  partner.occupation = "";
  partner.gender = "Female";
  partner.planningMode = "Individual";
  partner.couple = undefined;
  return partner;
}

export function createDefaultCoupleProfile(): SingaporePlannerProfile {
  const profile = createDefaultProfile();
  profile.planningMode = "Couple";
  profile.couple = {
    partner: createDefaultPartnerProfile(),
    propertyOwnershipA: 50,
    propertyOwnershipB: 50,
    loanShareA: 50,
    loanShareB: 50
  };
  return profile;
}

export function createQuickStartProfile(): SingaporePlannerProfile {
  const profile = createDefaultProfile();
  profile.name = "Sample client";
  profile.occupation = "Professional";
  profile.age = 30;
  profile.retirementAge = 65;
  profile.monthlyIncome = 6000;
  profile.monthlyExpenses = 3000;
  profile.freeCash = 20_000;
  profile.cpf.oa = 16_976;
  profile.cpf.sa = 4_757;
  profile.cpf.ma = 5_990;
  profile.assets[0] = {
    ...profile.assets[0],
    label: "Core ETF Portfolio",
    value: 50_000,
    contrib: 500,
    freq: "Monthly",
    contribStart: 30,
    contribEnd: 65,
    divEnabled: true,
    divYield: 2,
    divTreat: "Reinvest dividends"
  };
  profile.events = [retirementEvent(65)];
  return profile;
}

export function createQuickStartCoupleProfile(): SingaporePlannerProfile {
  const profile = createQuickStartProfile();
  profile.planningMode = "Couple";
  profile.name = "Sample client A";
  profile.couple = {
    partner: {
      ...createQuickStartProfile(),
      planningMode: "Individual",
      couple: undefined,
      name: "Sample client B",
      gender: "Female",
      occupation: "Professional",
      monthlyIncome: 5200,
      monthlyExpenses: 2200,
      freeCash: 18_000,
      cpf: {
        ...profile.cpf,
        oa: 14_500,
        sa: 4_200,
        ma: 5_800
      },
      assets: [
        {
          ...profile.assets[0],
          id: "partner-etf",
          label: "Partner ETF Portfolio",
          value: 40_000,
          contrib: 400,
          color: allocationColors[1]
        }
      ],
      events: [retirementEvent(65)]
    },
    propertyOwnershipA: 50,
    propertyOwnershipB: 50,
    loanShareA: 50,
    loanShareB: 50
  };
  return profile;
}
