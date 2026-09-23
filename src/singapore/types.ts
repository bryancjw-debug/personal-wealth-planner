export type WorkStatus = "Employed" | "Self-employed";
export type PlanningMode = "Individual" | "Couple";
export type CpfResidencyStatus = "Singapore Citizen" | "Permanent Resident";
export type CpfPrYear = "First Year" | "Second Year" | "Third Year Or Later";
export type CpfPrRateType = "Graduated Employer And Employee" | "Full Employer And Graduated Employee" | "Full Employer And Employee";
export type CashFlowMode = "generic" | "breakdown";
export type InvestmentFrequency = "None" | "Monthly" | "Annually";
export type DividendTreatment = "Reinvest dividends" | "Take dividends as cash";
export type RetirementSumChoice = "Basic" | "Full" | "Enhanced";
export type CpfLifePlan = "Standard" | "Basic" | "Escalating";
export type Gender = "Male" | "Female";
export type ResidencyStatus = "Singapore Citizen / PR" | "Foreigner";
export type MediShieldResidency = "Singapore Citizen / PR" | "Permanent Resident" | "Foreigner";
export type MediShieldSubsidyMode = "Estimate" | "Manual" | "None";
export type GenerationSubsidy = "None" | "Merdeka Generation" | "Pioneer Generation";
export type SrsWithdrawalMethod = "10-Year Drawdown" | "Custom Annual" | "Lump Sum";
export type InsurancePolicyType =
  | "Term"
  | "Whole Life"
  | "Investment Linked Policies"
  | "Universal Life"
  | "Hospitalization"
  | "Personal Accident"
  | "Careshield Life Enhancement"
  | "Disability Income";

export type InvestmentType =
  | "Equities"
  | "Funds / ETFs"
  | "Bonds"
  | "Cash holdings"
  | "Crypto"
  | "Commodities"
  | "Endowments"
  | "Other";

export interface NamedAmount {
  id: string;
  label: string;
  amount: number | "";
}

export interface CpfSettings {
  status: WorkStatus;
  residency: CpfResidencyStatus;
  prYear: CpfPrYear;
  prRateType: CpfPrRateType;
  oa: number | "";
  sa: number | "";
  ma: number | "";
  ra: number | "";
  lifeStart: number;
  selfAnnual: number | "";
  lifeSum: RetirementSumChoice;
  lifePlan: CpfLifePlan;
  lifeMonthlyOverride: number | "";
}

export interface InvestmentHolding {
  id: string;
  label: string;
  type: InvestmentType;
  value: number | "";
  ret: number | "";
  contrib: number | "";
  freq: InvestmentFrequency;
  contribStart: number | "";
  contribEnd: number | "";
  divEnabled: boolean;
  divYield: number | "";
  divTreat: DividendTreatment;
  drawdown: boolean;
  color: string;
  isShiftTarget?: boolean;
  glideKey?: string;
}

export interface GlidepathAssumption {
  ret: number | "";
  divEnabled: boolean;
  divYield: number | "";
  divTreat: DividendTreatment;
  drawdown: boolean;
}

export interface HousingAsset {
  id: string;
  label: string;
  value: number | "";
  appreciation: number | "";
  loan: number | "";
  rate: number | "";
  term: number | "";
  saleAge?: number | "";
  cpfUsed?: number | "";
  cpfAccruedInterest?: number | "";
  purchaseAge?: number | "";
  annualPropertyTax?: number | "";
  sourceEventId?: string;
}

export interface FutureHousingPurchase {
  purchasePrice: number | "";
  cashDownpayment: number | "";
  cpfOaDownpayment: number | "";
  loan: number | "";
  rate: number | "";
  term: number | "";
  appreciation: number | "";
  annualPropertyTax: number | "";
  saleAge?: number | "";
}

export interface CarAsset {
  id: string;
  label: string;
  value: number | "";
  purchaseAge: number | "";
  coeYearsLeft: number | "";
  depreciation: number | "";
  loan: number | "";
  rate: number | "";
  term: number | "";
  monthlyExpense: number | "";
}

export interface CustomAsset {
  id: string;
  label: string;
  value: number | "";
  growth: number | "";
  liability: number | "";
  liabilityRate: number | "";
  liabilityTerm: number | "";
  drawdown: boolean;
}

export type LifeEventType = "Custom" | "Car" | "House" | "Wedding" | "Child" | "Pet" | "Promotion" | "Retirement";

export interface LifeEvent {
  id: string;
  label: string;
  type: LifeEventType;
  age: number | "";
  cost: number | "";
  incomeChange: number | "";
  expenseChange: number | "";
  zeroIncome: boolean;
  housing?: FutureHousingPurchase;
}

export interface EmploymentPeriod {
  id: string;
  label: string;
  startAge: number | "";
  endAge: number | "";
  grossMonthlyIncome: number | "";
  annualGrowth: number | "";
  cpfApplies: boolean;
}

export interface PortfolioGlidepath {
  id: string;
  label: string;
  age: number | "";
  pct: number;
  glideYears: number;
  futureContrib: boolean;
  scope: "all" | "selected";
  from?: string;
  targetAlloc: Partial<Record<InvestmentType, number>>;
  targetAssumptions: Partial<Record<InvestmentType, GlidepathAssumption>>;
}

export interface HealthcareSettings {
  careShield: CareShieldSettings;
  mediShield: MediShieldSettings;
}

export interface CareShieldSettings {
  enabled: boolean;
  enhancement: boolean;
  enhancementAnnualMedisave: number | "";
  enhancementMonthlyBenefit: number | "";
}

export interface MediShieldSettings {
  enabled: boolean;
  residency: MediShieldResidency;
  subsidyMode: MediShieldSubsidyMode;
  householdIncomePerPerson: number | "";
  annualValue: number | "";
  ownsMultipleProperties: boolean;
  generation: GenerationSubsidy;
  manualSubsidyPct: number | "";
  preExisting: boolean;
  preExistingStartAge: number | "";
}

export interface InsurancePolicy {
  id: string;
  type: InsurancePolicyType;
  name: string;
  insurer: string;
  geBasePlan?: "None" | "P Plus" | "P Prime" | "A Plus" | "B Plus" | "Standard";
  geTotalCare2Tier?: "None" | "P" | "Prime" | "A" | "B";
  geTotalCarePlus2?: boolean;
  startAge: number | "";
  annualPremium: number | "";
  annualMedisavePremium: number | "";
  premiumDuration: number | "";
  coverageDuration: number | "";
  death: number | "";
  tpd: number | "";
  majorCi: number | "";
  earlyCi: number | "";
  accidentMedical: number | "";
  accidentDeath: number | "";
  accidentTpd: number | "";
  disabilityMonthly: number | "";
  hospitalizationTier: "None" | "Private" | "Govt A Ward" | "Govt B1 Ward" | "Govt B2 Ward" | "Basic MediShield Life";
}

export interface ProtectionSettings {
  annualCashPremiums: number | "";
  annualMedisavePremiums: number | "";
  death: number | "";
  tpd: number | "";
  majorCi: number | "";
  earlyCi: number | "";
  accident: number | "";
  disabilityMonthly: number | "";
  shieldCovered: boolean;
  policies: InsurancePolicy[];
}

export interface TaxSettings {
  donations: number | "";
  propertyTaxAnnual: number | "";
  otherReliefs: number | "";
  rebates: number | "";
  reliefs: Partial<Record<TaxReliefKey, TaxReliefSelection>>;
}

export interface SrsSettings {
  enabled: boolean;
  citizenship: ResidencyStatus;
  currentBalance: number | "";
  annualContribution: number | "";
  contributionStartAge: number | "";
  contributionStopAge: number | "";
  expectedReturn: number | "";
  withdrawalStartAge: number | "";
  withdrawalMethod: SrsWithdrawalMethod;
  customAnnualWithdrawal: number | "";
  earlyWithdrawal: boolean;
  drawdown: boolean;
}

export type TaxReliefKey =
  | "earnedIncome"
  | "spouse"
  | "parent"
  | "child"
  | "workingMotherChild"
  | "grandparentCaregiver"
  | "foreignDomesticWorker"
  | "courseFees"
  | "cpfCashTopUp"
  | "lifeInsurance"
  | "nsman"
  | "parenthoodTaxRebate";

export interface TaxReliefSelection {
  enabled: boolean;
  amount: number | "";
  year?: number | "";
}

export interface SingaporePlannerProfile {
  planningMode: PlanningMode;
  name: string;
  occupation: string;
  gender: Gender;
  age: number | "";
  retirementAge: number | "";
  endAge: number;
  dark: boolean;
  welcomed: boolean;
  includePropertyInNetWorth: boolean;
  freeCash: number | "";
  freeCashRate: number;
  incomeInf: number;
  expenseInf: number;
  taxMode: "monthly" | "annual";
  incomeMode: CashFlowMode;
  expenseMode: CashFlowMode;
  monthlyIncome: number | "";
  monthlyExpenses: number | "";
  income: NamedAmount[];
  expenses: NamedAmount[];
  cpf: CpfSettings;
  assets: InvestmentHolding[];
  homes: HousingAsset[];
  cars: CarAsset[];
  customAssets: CustomAsset[];
  events: LifeEvent[];
  employmentPeriods: EmploymentPeriod[];
  shifts: PortfolioGlidepath[];
  healthcare: HealthcareSettings;
  protection: ProtectionSettings;
  tax: TaxSettings;
  srs: SrsSettings;
  couple?: CoupleSettings;
}

export interface CoupleSettings {
  partner: SingaporePlannerProfile;
  propertyOwnershipA: number | "";
  propertyOwnershipB: number | "";
  loanShareA: number | "";
  loanShareB: number | "";
}

export interface CpfContribution {
  oa: number;
  sa: number;
  ma: number;
  ra: number;
  total: number;
  employee: number;
}

export interface ProjectedInvestment extends InvestmentHolding {
  projected: number;
  growth: number;
  yearContribution: number;
  yearDividend: number;
}

export interface ProjectedAsset<T> {
  projected: number;
  loan?: number;
  liability?: number;
  equity: number;
  monthlyMortgage?: number;
  monthlyLoan?: number;
  item: T;
}

export interface ProjectionYear {
  age: number;
  year: number;
  investmentValue: number;
  housingValue: number;
  housingDebt: number;
  housingEquity: number;
  carValue: number;
  carDebt: number;
  carEquity: number;
  customValue: number;
  customDebt: number;
  customEquity: number;
  freeCash: number;
  cpfTotal: number;
  totalAssets: number;
  annualIncome: number;
  takeHomeIncome: number;
  activeIncome: number;
  cpfLifeIncome: number;
  annualIncomeTax: number;
  employeeCpfContribution: number;
  employerCpfContribution: number;
  cpfLifeBase: number;
  cpfLifeReserve: number;
  cpf: { oa: number; sa: number; ma: number; ra: number };
  cpfContribution: CpfContribution;
  annualExpenses: number;
  annualMortgageCash: number;
  annualMortgageCpf: number;
  annualCarLoanCash: number;
  annualCarExpenses: number;
  annualInsurancePremiums: number;
  annualInsuranceMedisavePremiums: number;
  annualCareShieldPremiums: number;
  annualMediShieldPremiums: number;
  annualMediShieldBasePremium: number;
  annualMediShieldSubsidy: number;
  annualMediShieldAdditionalPremium: number;
  annualDividendIncome: number;
  annualSrsContribution: number;
  annualSrsWithdrawal: number;
  srsBalance: number;
  annualLifeEventCosts: number;
  annualHomeSaleCash: number;
  annualHomeSaleCpfRefund: number;
  annualHomePurchaseCash: number;
  annualHomePurchaseCpf: number;
  annualCashOutflows: number;
  annualExcessCash: number;
  annualInvestmentContributions: number;
  annualDividendsPaidOut: number;
  retirementCashFlowGap: number;
  annualFreeCashDrawdown: number;
  annualDrawdown: number;
  annualSrsDeficitDrawdown: number;
  annualOtherAssetDrawdown: number;
  annualCpfDeficitDrawdown: number;
  annualUnfundedShortfall: number;
  netCashFlow: number;
  triggeredLifeEvents: LifeEvent[];
  assets: ProjectedInvestment[];
  homes: ProjectedAsset<HousingAsset>[];
  cars: ProjectedAsset<CarAsset>[];
  customAssets: ProjectedAsset<CustomAsset>[];
}
