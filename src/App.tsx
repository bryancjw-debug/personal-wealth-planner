import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AlertTriangle, Building2, CalendarClock, ChartNoAxesCombined, CircleDollarSign, Download, HeartPulse, Home, Landmark, Menu, Moon, Pencil, PiggyBank, Plus, Shield, Sparkles, Sun, Trash2, Upload, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allocationColors, createDefaultCoupleProfile, createDefaultProfile, createQuickStartCoupleProfile, createQuickStartProfile, investmentReturnDefaults, investmentTypes, retirementEvent } from "@/singapore/defaults";
import {
  monthlyExpenses,
  monthlyIncome,
  monthlyMortgage,
  normalizeProfile,
  positive,
  projectSingaporeProfile,
  protectionAtAge,
  careShieldCoverageAnnual,
  mediShieldPremiumAtAge,
  annualIncomeTax,
  cpfContribution,
  projectionYear,
  retirementSumsForYear,
  srsContributionAtAge,
  syncRetirementEvent,
  taxRebateSelectionsTotal,
  taxReliefSelectionsTotal,
  toNumber,
  validateProfile
} from "@/singapore/projection";
import { activeStoredProfile, addProfile, loadProfileStore, normalizeProfileStore, removeProfile, renameProfile, saveProfileStore, upsertActiveProfile } from "@/singapore/storage";
import type {
  CarAsset,
  CashFlowMode,
  CustomAsset,
  EmploymentPeriod,
  HousingAsset,
  InsurancePolicy,
  InsurancePolicyType,
  InvestmentFrequency,
  InvestmentHolding,
  InvestmentType,
  LifeEvent,
  ProjectionYear,
  ProjectedAsset,
  ProjectedInvestment,
  SingaporePlannerProfile,
  TaxReliefKey
} from "@/singapore/types";
import { geHospitalizationPremium } from "@/singapore/geHospitalization";
import { createInputSummaryReport, reportFilename } from "@/singapore/report";
import "./styles.css";

type CouplePersonKey = "person1" | "person2";
type ProjectionScope = CouplePersonKey | "combined";

const steps = [
  { id: 1, label: "Profile", icon: PiggyBank },
  { id: 2, label: "Income & CPF", icon: CircleDollarSign },
  { id: 3, label: "Expenses", icon: ChartNoAxesCombined },
  { id: 4, label: "Protection", icon: Shield },
  { id: 5, label: "Assets", icon: Home },
  { id: 6, label: "Taxes", icon: Building2 },
  { id: 7, label: "Investments", icon: ChartNoAxesCombined },
  { id: 8, label: "Life Events", icon: CalendarClock }
];

function currency(value: number) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function compactCurrency(value: number) {
  const n = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (n >= 1_000_000) return `${sign}SGD ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${sign}SGD ${Math.round(n / 1000)}K`;
  return currency(value);
}

function compactAmount(value: number) {
  return compactCurrency(value).replace("SGD ", "");
}

function numberValue(value: number | "") {
  return value === "" ? "" : String(value);
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.round(element.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  helper
}: {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  readOnly?: boolean;
  helper?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(numberValue(value));

  useEffect(() => {
    setDraft(numberValue(value));
  }, [value]);

  const commit = (raw: string) => {
    const cleaned = raw.trim();
    if (cleaned === "") {
      onChange("");
      return;
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={draft}
        readOnly={readOnly}
        placeholder={placeholder}
        onBlur={(event) => commit(event.target.value)}
        onChange={(event) => {
          const raw = event.target.value;
          if (!/^-?\d*\.?\d*$/.test(raw)) return;
          setDraft(raw);
          if (raw === "") {
            onChange("");
            return;
          }
          if (raw === "-" || raw.endsWith(".")) return;
          commit(raw);
        }}
      />
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="react-select" value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <Label htmlFor={id} className="toggle-row__label text-foreground">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function MetricGlyph({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const Icon = lower.includes("cash")
    ? WalletCards
    : lower.includes("income")
      ? CircleDollarSign
      : lower.includes("cpf") || lower.includes("tax")
        ? Landmark
        : lower.includes("outflow") || lower.includes("expense")
          ? ChartNoAxesCombined
          : lower.includes("protection") || lower.includes("shield")
            ? Shield
            : PiggyBank;
  return (
    <span className="metric-glyph" aria-hidden="true">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function MetricCard({ label, value, compactValue, note, tone = "default" }: { label: string; value: string; compactValue?: string; note?: string; tone?: "default" | "good" | "bad" | "info" }) {
  return (
    <Card className="metric-card-react">
      <CardContent className="p-4">
        <p className="metric-card-react__label text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <MetricGlyph label={label} />
          <span>{label}</span>
        </p>
        <strong className={`mt-3 block text-2xl font-semibold tabular-nums ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "info" ? "text-info" : "text-primary"}`}>
          <span className="metric-card-react__value-full">{value}</span>
          <span className="metric-card-react__value-compact">{compactValue ?? value}</span>
        </strong>
        {note ? <small className="mt-2 block text-sm text-muted-foreground">{note}</small> : null}
      </CardContent>
    </Card>
  );
}

function DecisionPreview({
  title = "Live Decision Preview",
  description,
  items
}: {
  title?: string;
  description?: string;
  items: { label: string; value: string; tone?: "default" | "good" | "bad" | "info"; note?: string }[];
}) {
  if (!items.length) return null;
  return (
    <div className="decision-preview">
      <div className="decision-preview__intro">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      <div className="decision-preview__grid">
        {items.map((item) => (
          <div className="decision-preview__item" key={item.label}>
            <span>{item.label}</span>
            <strong className={item.tone === "good" ? "text-success" : item.tone === "bad" ? "text-destructive" : item.tone === "info" ? "text-info" : ""}>{item.value}</strong>
            {item.note ? <small>{item.note}</small> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepRail({ step, setStep, close }: { step: number; setStep: (step: number) => void; close?: () => void }) {
  return (
    <>
      {steps.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={step === item.id ? "active" : ""}
            onClick={() => {
              setStep(item.id);
              close?.();
            }}
          >
            <Icon className="h-4 w-4" />
            <span>{item.id}</span>
            <b>{item.label}</b>
          </button>
        );
      })}
    </>
  );
}

function StepStatus({ step }: { step: number }) {
  const active = steps.find((item) => item.id === step) ?? steps[0];
  const Icon = active.icon;
  return (
    <div className="mobile-step-status" aria-label={`Current step ${active.id} of ${steps.length}: ${active.label}`}>
      <Icon className="h-4 w-4" />
      <span>Step {active.id} of {steps.length}</span>
      <strong>{active.label}</strong>
    </div>
  );
}

function WelcomeScreen({
  startBlank,
  startTemplate,
  startCoupleBlank,
  startCoupleTemplate,
  resume
}: {
  startBlank: () => void;
  startTemplate: () => void;
  startCoupleBlank: () => void;
  startCoupleTemplate: () => void;
  resume?: () => void;
}) {
  const previewCards = [
    ["Projected Net Worth", "SGD 1.9M", "At age 65"],
    ["Retirement Readiness", "Funded To 100", "With selected drawdowns"],
    ["Emergency Cash", "6.7 Months", "Based on monthly expenses"],
    ["CPF Total", "SGD 620K", "OA, SA, MA and RA"],
    ["Nett Cash Flow", "SGD 18K", "Current-year view"],
    ["Protection Gap", "CI 82%", "Coverage progress"]
  ];
  return (
    <main className="react-app-shell">
      <section className="react-welcome">
        <div className="welcome-preview-rail" aria-hidden="true">
          {[...previewCards, ...previewCards].map(([label, value, note], index) => (
            <div className="welcome-preview-card" key={`${label}-${index}`}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>
        <div className="welcome-hero-grid">
          <div className="welcome-hero-copy">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Difficult Dollars To Common Cents</p>
            <h1>See where your money is going, and where it could take you.</h1>
            <p className="welcome-slogan">Your Personal Finance, Simplified.</p>
            <p className="welcome-lede">
              Turn CPF, cash flow, protection, property, investments, taxes, and life events into a clear year-by-year wealth view.
            </p>
            <div className="welcome-trust-strip" aria-label="Singapore planning modules">
              {["CPF", "SRS", "Taxes", "Insurance", "Property", "Retirement"].map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="welcome-live-preview" aria-hidden="true">
            <div className="welcome-live-preview__top">
              <span>Projection Preview</span>
              <strong>Age 30-100</strong>
            </div>
            <div className="welcome-mini-chart">
              {[18, 25, 33, 42, 54, 68, 84, 72, 64, 58, 62, 67].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="welcome-preview-metrics">
              <div><span>Net Worth</span><strong>SGD 1.9M</strong></div>
              <div><span>Cash Flow</span><strong>+SGD 18K</strong></div>
              <div><span>Readiness</span><strong>Funded</strong></div>
            </div>
          </div>
        </div>
        <div className="welcome-outcome-grid" aria-label="What this planner helps you see">
          <div>
            <span>01</span>
            <strong>Your money today</strong>
            <small>Income, expenses, CPF, protection, assets, and investments in one flow.</small>
          </div>
          <div>
            <span>02</span>
            <strong>Your future by age</strong>
            <small>See net worth and cash flow change as life events unfold.</small>
          </div>
          <div>
            <span>03</span>
            <strong>Your retirement pressure points</strong>
            <small>Spot shortfalls, drawdowns, and what may need attention.</small>
          </div>
        </div>
        <div className="welcome-meta-row">
          <p className="welcome-promise">8 guided steps. About 5-10 minutes. No login required.</p>
          <p className="welcome-disclaimer">The projection is only as accurate as the information you provide, so treat the result as a planning guide rather than financial advice.</p>
        </div>
        <div className="welcome-choice-grid">
          {resume ? (
            <button className="welcome-choice-primary" onClick={resume}>
              <strong>Continue Current Plan</strong>
              <span>Return to the plan you were working on without changing any saved inputs.</span>
              <em>Resume planning</em>
            </button>
          ) : null}
          <button className="welcome-choice-primary" onClick={startTemplate}>
            <strong>Try With Sample Figures</strong>
            <span>Pre-fills simple generic fields so you can test the flow first, then tune the numbers to your actual situation.</span>
            <em>Start guided preview</em>
          </button>
          <button className="welcome-choice-primary" onClick={startCoupleTemplate}>
            <strong>Plan As A Couple With Sample Figures</strong>
            <span>Starts with two sample profiles and combines the household projection for CPF, cash flow, assets, and retirement.</span>
            <em>Preview couple mode</em>
          </button>
          <button onClick={startBlank}>
            <strong>Start From My Own Details</strong>
            <span>Keeps most fields blank so you can enter each detail yourself from the start.</span>
            <em>Build from scratch</em>
          </button>
          <button onClick={startCoupleBlank}>
            <strong>Start A Couple Plan From Scratch</strong>
            <span>Keeps both profiles mostly blank while enabling partner inputs and ownership assumptions.</span>
            <em>Build household plan</em>
          </button>
        </div>
      </section>
      <footer className="mt-6 text-sm text-muted-foreground">Created by bryancjw</footer>
    </main>
  );
}

function FinancialSummary({
  selected,
  profile,
  rows,
  minimized,
  setMinimized
}: {
  selected: ProjectionYear;
  profile: SingaporePlannerProfile;
  rows: ProjectionYear[];
  minimized: boolean;
  setMinimized: (value: boolean) => void;
}) {
  const months = monthlyExpenses(profile) ? positive(profile.freeCash) / monthlyExpenses(profile) : 0;
  const retirementAge = positive(profile.retirementAge) || selected.age;
  const retirement = rows.find((row) => row.age >= retirementAge) ?? selected;
  const readiness = retirementReadiness(profile, rows);
  return (
    <aside className={`projection-pulse ${minimized ? "is-minimized" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Financial Summary</p>
          <h3 className="text-base font-semibold">At A Glance</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMinimized(!minimized)}>{minimized ? "+" : "-"}</Button>
      </div>
      {minimized ? (
        <div className="summary-compact mt-4">
          <PulseItem label="Net Worth" value={compactCurrency(selected.totalAssets)} tone="good" />
          <PulseItem label="Nett Cash Flow" value={compactCurrency(selected.netCashFlow)} tone={selected.netCashFlow >= 0 ? "good" : "bad"} />
          <PulseItem label="Free Cash Months" value={`${months.toFixed(1)} Months`} tone={months >= 3 ? "good" : months >= 1 ? "info" : "bad"} />
          <PulseItem label="Retirement Readiness" value={readiness.label.replace("Shortfall From ", "From ")} tone={readiness.firstShortfall ? "bad" : "good"} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <PulseItem label="Net Worth" value={compactCurrency(selected.totalAssets)} tone="good" />
          <PulseItem label="Nett Cash Flow" value={compactCurrency(selected.netCashFlow)} tone={selected.netCashFlow >= 0 ? "good" : "bad"} />
          <PulseItem label="Free Cash Months" value={`${months.toFixed(1)} Months`} tone={months >= 3 ? "good" : months >= 1 ? "info" : "bad"} />
          <PulseItem label="Retirement Readiness" value={readiness.label.replace("Shortfall From ", "From ")} tone={readiness.firstShortfall ? "bad" : retirement.netCashFlow >= 0 ? "good" : "info"} />
          <p className="text-xs leading-relaxed text-muted-foreground">Updates as you enter figures, so pressure points appear before the projection page.</p>
        </div>
      )}
    </aside>
  );
}

function PulseItem({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "info" }) {
  return (
    <div className="rounded-lg border p-3">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <strong className={`mt-1 block text-lg font-semibold tabular-nums ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-info"}`}>{value}</strong>
    </div>
  );
}

function retirementReadiness(profile: SingaporePlannerProfile, rows: ProjectionYear[]) {
  const retirementAge = positive(profile.retirementAge) || 65;
  const retirementRows = rows.filter((row) => row.age >= retirementAge);
  const firstShortfall = retirementRows.find((row) => row.annualUnfundedShortfall > 0.5);
  const firstGap = retirementRows.find((row) => row.retirementCashFlowGap > 0.5);
  const totalGap = retirementRows.reduce((sum, row) => sum + row.retirementCashFlowGap, 0);
  const totalDrawdown = retirementRows.reduce((sum, row) => sum + row.annualFreeCashDrawdown + row.annualDrawdown + row.annualSrsDeficitDrawdown + row.annualOtherAssetDrawdown + row.annualCpfDeficitDrawdown, 0);
  const totalShortfall = retirementRows.reduce((sum, row) => sum + row.annualUnfundedShortfall, 0);
  const ending = rows.at(-1);
  return {
    label: firstShortfall ? `Shortfall From Age ${firstShortfall.age} Onwards` : `Funded Through Age ${ending?.age ?? "-"}`,
    firstGap,
    firstShortfall,
    totalGap,
    totalDrawdown,
    totalShortfall,
    retirementAge
  };
}

function partnerProfile(profile: SingaporePlannerProfile) {
  return profile.planningMode === "Couple" && profile.couple?.partner
    ? normalizeProfile({ ...profile.couple.partner, planningMode: "Individual", couple: undefined, dark: profile.dark, welcomed: true, endAge: profile.endAge })
    : null;
}

function primarySoloProfile(profile: SingaporePlannerProfile) {
  return normalizeProfile({ ...profile, planningMode: "Individual", couple: undefined, welcomed: true });
}

function personName(profile: SingaporePlannerProfile, fallback: string) {
  return profile.name?.trim() || fallback;
}

function updatePartnerProfile(profile: SingaporePlannerProfile, update: (patch: Partial<SingaporePlannerProfile>) => void, patch: Partial<SingaporePlannerProfile>) {
  const couple = profile.couple ?? createDefaultCoupleProfile().couple!;
  const currentPartner = partnerProfile(profile) ?? couple.partner;
  update({
    planningMode: "Couple",
    couple: {
      ...couple,
      partner: normalizeProfile({ ...currentPartner, ...patch, planningMode: "Individual", couple: undefined })
    }
  });
}

function ownerLabel(owner: string, label: string) {
  return label ? `${owner}: ${label}` : owner;
}

function labelInvestments(items: ProjectedInvestment[], owner: string): ProjectedInvestment[] {
  return items.map((item) => ({ ...item, label: ownerLabel(owner, item.label || item.type) }));
}

function labelProjectedAssets<T extends { label: string }>(items: ProjectedAsset<T>[], owner: string): ProjectedAsset<T>[] {
  return items.map((asset) => ({ ...asset, item: { ...asset.item, label: ownerLabel(owner, asset.item.label) } }));
}

function combineProjectionYear(primary: ProjectionYear, partner?: ProjectionYear): ProjectionYear {
  if (!partner) {
    return {
      ...primary,
      assets: labelInvestments(primary.assets, "You"),
      homes: labelProjectedAssets(primary.homes, "You"),
      cars: labelProjectedAssets(primary.cars, "You"),
      customAssets: labelProjectedAssets(primary.customAssets, "You")
    };
  }
  const sum = (key: keyof ProjectionYear) => Number(primary[key] ?? 0) + Number(partner[key] ?? 0);
  return {
    ...primary,
    investmentValue: sum("investmentValue"),
    housingValue: sum("housingValue"),
    housingDebt: sum("housingDebt"),
    housingEquity: sum("housingEquity"),
    carValue: sum("carValue"),
    carDebt: sum("carDebt"),
    carEquity: sum("carEquity"),
    customValue: sum("customValue"),
    customDebt: sum("customDebt"),
    customEquity: sum("customEquity"),
    freeCash: sum("freeCash"),
    cpfTotal: sum("cpfTotal"),
    totalAssets: sum("totalAssets"),
    annualIncome: sum("annualIncome"),
    takeHomeIncome: sum("takeHomeIncome"),
    activeIncome: sum("activeIncome"),
    cpfLifeIncome: sum("cpfLifeIncome"),
    annualIncomeTax: sum("annualIncomeTax"),
    employeeCpfContribution: sum("employeeCpfContribution"),
    employerCpfContribution: sum("employerCpfContribution"),
    cpfLifeBase: sum("cpfLifeBase"),
    cpfLifeReserve: sum("cpfLifeReserve"),
    cpf: {
      oa: primary.cpf.oa + partner.cpf.oa,
      sa: primary.cpf.sa + partner.cpf.sa,
      ma: primary.cpf.ma + partner.cpf.ma,
      ra: primary.cpf.ra + partner.cpf.ra
    },
    cpfContribution: {
      oa: primary.cpfContribution.oa + partner.cpfContribution.oa,
      sa: primary.cpfContribution.sa + partner.cpfContribution.sa,
      ma: primary.cpfContribution.ma + partner.cpfContribution.ma,
      ra: primary.cpfContribution.ra + partner.cpfContribution.ra,
      total: primary.cpfContribution.total + partner.cpfContribution.total,
      employee: primary.cpfContribution.employee + partner.cpfContribution.employee
    },
    annualExpenses: sum("annualExpenses"),
    annualMortgageCash: sum("annualMortgageCash"),
    annualMortgageCpf: sum("annualMortgageCpf"),
    annualCarLoanCash: sum("annualCarLoanCash"),
    annualCarExpenses: sum("annualCarExpenses"),
    annualInsurancePremiums: sum("annualInsurancePremiums"),
    annualInsuranceMedisavePremiums: sum("annualInsuranceMedisavePremiums"),
    annualCareShieldPremiums: sum("annualCareShieldPremiums"),
    annualMediShieldPremiums: sum("annualMediShieldPremiums"),
    annualMediShieldBasePremium: sum("annualMediShieldBasePremium"),
    annualMediShieldSubsidy: sum("annualMediShieldSubsidy"),
    annualMediShieldAdditionalPremium: sum("annualMediShieldAdditionalPremium"),
    annualDividendIncome: sum("annualDividendIncome"),
    annualSrsContribution: sum("annualSrsContribution"),
    annualSrsWithdrawal: sum("annualSrsWithdrawal"),
    srsBalance: sum("srsBalance"),
    annualLifeEventCosts: sum("annualLifeEventCosts"),
    annualHomeSaleCash: sum("annualHomeSaleCash"),
    annualHomeSaleCpfRefund: sum("annualHomeSaleCpfRefund"),
    annualHomePurchaseCash: sum("annualHomePurchaseCash"),
    annualHomePurchaseCpf: sum("annualHomePurchaseCpf"),
    annualCashOutflows: sum("annualCashOutflows"),
    annualExcessCash: sum("annualExcessCash"),
    annualInvestmentContributions: sum("annualInvestmentContributions"),
    annualDividendsPaidOut: sum("annualDividendsPaidOut"),
    retirementCashFlowGap: sum("retirementCashFlowGap"),
    annualFreeCashDrawdown: sum("annualFreeCashDrawdown"),
    annualDrawdown: sum("annualDrawdown"),
    annualSrsDeficitDrawdown: sum("annualSrsDeficitDrawdown"),
    annualOtherAssetDrawdown: sum("annualOtherAssetDrawdown"),
    annualCpfDeficitDrawdown: sum("annualCpfDeficitDrawdown"),
    annualUnfundedShortfall: sum("annualUnfundedShortfall"),
    netCashFlow: sum("netCashFlow"),
    triggeredLifeEvents: [...primary.triggeredLifeEvents, ...partner.triggeredLifeEvents],
    assets: [...labelInvestments(primary.assets, "You"), ...labelInvestments(partner.assets, "Partner")],
    homes: [...labelProjectedAssets(primary.homes, "You"), ...labelProjectedAssets(partner.homes, "Partner")],
    cars: [...labelProjectedAssets(primary.cars, "You"), ...labelProjectedAssets(partner.cars, "Partner")],
    customAssets: [...labelProjectedAssets(primary.customAssets, "You"), ...labelProjectedAssets(partner.customAssets, "Partner")]
  };
}

function householdProjectionRows(profile: SingaporePlannerProfile) {
  const primaryRows = projectSingaporeProfile(profile);
  const partner = partnerProfile(profile);
  if (!partner) return primaryRows;
  const partnerRows = projectSingaporeProfile(partner);
  return primaryRows.map((row) => combineProjectionYear(row, partnerRows.find((partnerRow) => partnerRow.year === row.year) ?? partnerRows.at(-1)));
}

function CouplePersonTabs({
  profile,
  update,
  active,
  onActiveChange,
  render
}: {
  profile: SingaporePlannerProfile;
  update: (patch: Partial<SingaporePlannerProfile>) => void;
  active: CouplePersonKey;
  onActiveChange: (person: CouplePersonKey) => void;
  render: (personProfile: SingaporePlannerProfile, updatePerson: (patch: Partial<SingaporePlannerProfile>) => void, person: CouplePersonKey) => ReactNode;
}) {
  const person1 = primarySoloProfile(profile);
  const person2 = partnerProfile(profile) ?? createDefaultCoupleProfile().couple!.partner;
  const activeProfile = active === "person1" ? person1 : person2;
  const updateActivePerson = active === "person1"
    ? (patch: Partial<SingaporePlannerProfile>) => {
        const { couple: _discardCouple, planningMode: _discardMode, ...personPatch } = patch;
        void _discardCouple;
        void _discardMode;
        update(personPatch);
      }
    : (patch: Partial<SingaporePlannerProfile>) => updatePartnerProfile(profile, update, patch);

  return (
    <div className="couple-person-workspace">
      <Tabs value={active} onValueChange={(value) => onActiveChange(value as CouplePersonKey)}>
        <TabsList className="couple-person-tabs">
          <TabsTrigger value="person1">{personName(person1, "Person 1")}</TabsTrigger>
          <TabsTrigger value="person2">{personName(person2, "Person 2")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="couple-person-panel">
        {render(activeProfile, updateActivePerson, active)}
      </div>
    </div>
  );
}

function ProfileManagerDialog({
  open,
  onOpenChange,
  store,
  switchProfile,
  renameSavedProfile,
  deleteProfile,
  exportProfiles,
  importProfiles
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: ReturnType<typeof loadProfileStore>;
  switchProfile: (id: string) => void;
  renameSavedProfile: (id: string, name: string) => void;
  deleteProfile: (id?: string) => void;
  exportProfiles: () => void;
  importProfiles: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const beginRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };
  const finishRename = () => {
    if (!editingId || !editingName.trim()) return;
    renameSavedProfile(editingId, editingName);
    setEditingId(null);
    setEditingName("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Profile Manager</DialogTitle>
          <DialogDescription>Save, switch, export, or import client profiles without leaving the planner.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {store.profiles.map((item) => (
            <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={item.id}>
              <div className="min-w-0">
                {editingId === item.id ? (
                  <div className="grid max-w-md gap-2">
                    <Label htmlFor={`profile-name-${item.id}`}>Profile Name</Label>
                    <Input
                      id={`profile-name-${item.id}`}
                      autoFocus
                      maxLength={60}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") finishRename();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                  </div>
                ) : (
                  <strong className="block truncate">{item.name}</strong>
                )}
                <p className="mt-1 text-sm text-muted-foreground">Updated {new Date(item.updatedAt).toLocaleString("en-SG")}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {editingId === item.id ? (
                  <>
                    <Button size="sm" disabled={!editingName.trim()} onClick={finishRename}>Save Name</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button variant={store.activeId === item.id ? "default" : "outline"} size="sm" onClick={() => switchProfile(item.id)}>
                      {store.activeId === item.id ? "Active" : "Load"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => beginRename(item.id, item.name)}>
                      <Pencil className="h-3.5 w-3.5" /> Rename
                    </Button>
                    <Button variant="outline" size="sm" disabled={store.profiles.length <= 1} onClick={() => deleteProfile(item.id)}>Delete</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={exportProfiles}><Download className="h-4 w-4" /> Export Profiles</Button>
          <Button variant="outline" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Import Profiles</Button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importProfiles(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionGlyph({ title }: { title: string }) {
  const lower = title.toLowerCase();
  const Icon = lower.includes("cpf") || lower.includes("tax")
    ? Landmark
    : lower.includes("cash") || lower.includes("expense")
      ? WalletCards
      : lower.includes("protection") || lower.includes("insurance")
        ? Shield
        : lower.includes("asset") || lower.includes("home")
          ? Home
          : lower.includes("investment")
            ? ChartNoAxesCombined
            : Sparkles;
  return (
    <span className="section-glyph" aria-hidden="true">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function FieldCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="field-card-react">
      <CardHeader className="field-card-react__header">
        <SectionGlyph title={title} />
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state-react rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
      <div className="empty-state-visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong className="mb-1 block text-foreground">{title}</strong>
        {description}
      </div>
    </div>
  );
}

function SummaryRow({
  title,
  meta,
  value,
  extraAction,
  onEdit,
  onDelete
}: {
  title: string;
  meta?: string;
  value?: string;
  extraAction?: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <button className="min-w-0 text-left" onClick={onEdit}>
        <strong className="block truncate">{title || "Untitled"}</strong>
        {meta ? <span className="mt-1 block text-sm text-muted-foreground">{meta}</span> : null}
      </button>
      {value ? <strong className="text-left tabular-nums sm:text-right">{value}</strong> : null}
      <div className="flex gap-2 sm:justify-end">
        {extraAction}
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="outline" size="sm" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}

function CashFlowCard({
  title,
  mode,
  genericValue,
  items,
  onModeChange,
  onGenericChange,
  onItemsChange,
  addLabel
}: {
  title: string;
  mode: CashFlowMode;
  genericValue: number | "";
  items: SingaporePlannerProfile["income"];
  onModeChange: (mode: CashFlowMode) => void;
  onGenericChange: (value: number | "") => void;
  onItemsChange: (items: SingaporePlannerProfile["income"]) => void;
  addLabel: string;
}) {
  return (
    <FieldCard title={title}>
      <Tabs value={mode} onValueChange={(value) => onModeChange(value as CashFlowMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generic">Generic Sum</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "generic" ? (
        <NumberField label="Monthly Sum" value={genericValue} onChange={onGenericChange} />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_180px_auto]" key={item.id}>
              <TextField label="Name" value={item.label} onChange={(label) => onItemsChange(items.map((row) => (row.id === item.id ? { ...row, label } : row)))} />
              <NumberField label="Monthly Amount" value={item.amount} onChange={(amount) => onItemsChange(items.map((row) => (row.id === item.id ? { ...row, amount } : row)))} />
              <Button variant="outline" size="icon" className="self-end" onClick={() => onItemsChange(items.filter((row) => row.id !== item.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => onItemsChange([...items, { id: uid("line"), label: "", amount: "" }])}>
            <Plus className="h-4 w-4" /> Add {addLabel}
          </Button>
        </div>
      )}
    </FieldCard>
  );
}

function ProfileStep({ profile, update }: StepProps) {
  const currentAge = positive(profile.age);
  const retirementAge = positive(profile.retirementAge);
  const endAge = positive(profile.endAge) || 100;
  const age55Year = currentAge ? projectionYear(profile, 55) : new Date().getFullYear() + Math.max(0, 55 - currentAge);
  const coupleTemplate = createDefaultCoupleProfile().couple!;
  const couple = profile.couple ?? coupleTemplate;
  const partner = partnerProfile(profile) ?? couple.partner;
  const updatePartner = (patch: Partial<SingaporePlannerProfile>) => updatePartnerProfile(profile, update, patch);
  const updateCouple = (patch: Partial<typeof couple>) => {
    update({ planningMode: "Couple", couple: { ...couple, ...patch, partner } });
  };
  return (
    <section className="step-grid">
      <FieldCard title="Who Are You and How Do You Do? (:" description="Basic profile details anchor CPF, retirement, and year-by-year projections.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Planning Mode"
            value={profile.planningMode}
            options={["Individual", "Couple"] as const}
            onChange={(planningMode) => update(planningMode === "Couple" ? { planningMode, couple } : { planningMode, couple: undefined })}
          />
          <TextField label="Name" value={profile.name} placeholder="Your name" onChange={(name) => update({ name })} />
          <TextField label="Occupation" value={profile.occupation} placeholder="Occupation" onChange={(occupation) => update({ occupation })} />
          <SelectField label="Gender" value={profile.gender} options={["Male", "Female"] as const} onChange={(gender) => update({ gender })} />
          <NumberField label="Current Age" value={profile.age} onChange={(age) => update({ age, events: syncRetirementEvent(profile.events, profile.retirementAge) })} />
          <NumberField label="Expected Retirement Age" value={profile.retirementAge} onChange={(retirementAge) => update({ retirementAge, events: syncRetirementEvent(profile.events, retirementAge) })} />
          <NumberField
            label="Project Until Age"
            value={profile.endAge}
            onChange={(endAge) => {
              if (endAge !== "") update({ endAge });
            }}
            helper="The projection, charts, snapshots, and reports will end at this age."
          />
        </div>
        <DecisionPreview
          title="Timeline Preview"
          description="A quick check that the plan horizon matches the major Singapore planning ages."
          items={[
            { label: "CPF RA Formation", value: currentAge && currentAge <= 55 ? `Age 55 / ${age55Year}` : "Already Past", tone: "info" },
            { label: "Retirement Target", value: retirementAge ? `Age ${retirementAge}` : "Not Set", tone: retirementAge ? "good" : "bad" },
            { label: "Planning Horizon", value: `To Age ${endAge}`, tone: endAge >= 100 ? "good" : "info" }
          ]}
        />
      </FieldCard>
      {profile.planningMode === "Couple" ? (
        <>
          <FieldCard title="Partner Profile" description="Couple mode projects both people separately, then combines household net worth, inflows, outflows, CPF, SRS, investments, and drawdowns on the projection page.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Partner Name" value={partner.name} placeholder="Partner name" onChange={(name) => updatePartner({ name })} />
              <TextField label="Partner Occupation" value={partner.occupation} placeholder="Occupation" onChange={(occupation) => updatePartner({ occupation })} />
              <SelectField label="Partner Gender" value={partner.gender} options={["Male", "Female"] as const} onChange={(gender) => updatePartner({ gender })} />
              <NumberField label="Partner Current Age" value={partner.age} onChange={(age) => updatePartner({ age, events: syncRetirementEvent(partner.events, partner.retirementAge) })} />
              <NumberField label="Partner Retirement Age" value={partner.retirementAge} onChange={(retirementAge) => updatePartner({ retirementAge, events: syncRetirementEvent(partner.events, retirementAge) })} />
              <NumberField label="Partner Gross Monthly Income" value={partner.monthlyIncome} onChange={(monthlyIncome) => updatePartner({ monthlyIncome, incomeMode: "generic" })} />
              <NumberField label="Partner Monthly Expenses" value={partner.monthlyExpenses} onChange={(monthlyExpenses) => updatePartner({ monthlyExpenses, expenseMode: "generic" })} />
              <NumberField label="Partner Free Cash" value={partner.freeCash} onChange={(freeCash) => updatePartner({ freeCash })} />
            </div>
          </FieldCard>
          <FieldCard title="Couple Ownership Assumptions" description="Use this to document ownership versus loan-servicing reality. For example, property ownership can be 99:1 while the mortgage servicing split can still be modelled differently.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <NumberField label="Your Property Ownership %" value={couple.propertyOwnershipA} onChange={(propertyOwnershipA) => updateCouple({ propertyOwnershipA })} />
              <NumberField label="Partner Property Ownership %" value={couple.propertyOwnershipB} onChange={(propertyOwnershipB) => updateCouple({ propertyOwnershipB })} />
              <NumberField label="Your Loan Servicing Share %" value={couple.loanShareA} onChange={(loanShareA) => updateCouple({ loanShareA })} />
              <NumberField label="Partner Loan Servicing Share %" value={couple.loanShareB} onChange={(loanShareB) => updateCouple({ loanShareB })} />
            </div>
            <DecisionPreview
              title="Household Projection Preview"
              description="The current version combines each person's projection at the dashboard level. Property and loan split fields are captured for review and future person-level allocation."
              items={[
                { label: "Mode", value: "Couple", tone: "info" },
                { label: "Ownership Split", value: `${positive(couple.propertyOwnershipA)}:${positive(couple.propertyOwnershipB)}`, tone: "info" },
                { label: "Loan Servicing Split", value: `${positive(couple.loanShareA)}:${positive(couple.loanShareB)}`, tone: "info" }
              ]}
            />
          </FieldCard>
        </>
      ) : null}
    </section>
  );
}

function IncomeStep({ profile, update }: StepProps) {
  const annual = monthlyIncome(profile) * 12;
  const cpf = profile.age === "" ? { oa: 0, sa: 0, ma: 0, employee: 0, total: 0 } : projectSingaporeProfile(profile)[0]?.cpfContribution;
  const partner = partnerProfile(profile);
  const updatePartner = (patch: Partial<SingaporePlannerProfile>) => updatePartnerProfile(profile, update, patch);
  const cpfReferenceAge = Math.max(55, positive(profile.age) || 55);
  const cpfReferenceYear = projectionYear(profile, cpfReferenceAge);
  const retirementSums = retirementSumsForYear(cpfReferenceYear);
  return (
    <section className="income-step">
      <div className="income-step__top">
        <CashFlowCard
          title="Gross Monthly Income"
          mode={profile.incomeMode}
          genericValue={profile.monthlyIncome}
          items={profile.income}
          onModeChange={(incomeMode) => update({ incomeMode })}
          onGenericChange={(monthlyIncome) => update({ monthlyIncome })}
          onItemsChange={(income) => update({ income })}
          addLabel="Income"
        />
        <Card>
          <CardHeader>
            <CardTitle>Live CPF Breakdown</CardTitle>
            <CardDescription>{profile.cpf.status === "Self-employed" ? "Mandatory MediSave is estimated from income using CPF's 2026 non-pensioner SEP bands." : "Based on gross income and current CPF age band."}</CardDescription>
          </CardHeader>
          <CardContent className="income-cpf-metrics grid gap-3 md:grid-cols-3">
            <MetricCard label="Annual Gross Income" value={compactAmount(annual)} note="SGD" />
            <MetricCard label={profile.cpf.status === "Self-employed" ? "Mandatory MediSave" : "Employee CPF"} value={compactAmount(cpf?.employee ?? 0)} note="SGD" tone="info" />
            <MetricCard label="Take Home Before Tax" value={compactAmount(Math.max(0, annual - (cpf?.employee ?? 0)))} note="SGD" tone="good" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Retirement Sum Indicator</CardTitle>
            <CardDescription>Estimated CPF retirement sums for the year you reach age {cpfReferenceAge}.</CardDescription>
          </CardHeader>
          <CardContent className="income-cpf-metrics grid gap-3 md:grid-cols-3">
            <MetricCard label={`BRS ${cpfReferenceYear}`} value={compactAmount(retirementSums.brs)} note="SGD" />
            <MetricCard label={`FRS ${cpfReferenceYear}`} value={compactAmount(retirementSums.frs)} note="SGD" tone="info" />
            <MetricCard label={`ERS ${cpfReferenceYear}`} value={compactAmount(retirementSums.ers)} note="SGD" tone="good" />
          </CardContent>
        </Card>
      </div>
      <FieldCard title="CPF Settings" description="CPF uses the official 2026 tables, plus already-announced 2027 contribution and allocation rates for future projected years. PR first/second-year rates follow the selected contribution basis.">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <SelectField label="Work Status" value={profile.cpf.status} options={["Employed", "Self-employed"] as const} onChange={(status) => update({ cpf: { ...profile.cpf, status } })} />
          {profile.cpf.status === "Self-employed" ? <NumberField label="Annual Mandatory MediSave Override" value={profile.cpf.selfAnnual} onChange={(selfAnnual) => update({ cpf: { ...profile.cpf, selfAnnual } })} helper="Optional. Leave at 0 for an estimate from gross income (treated as Net Trade Income). Enter the assessed mandatory MediSave amount from CPF when available." /> : null}
          <SelectField label="CPF Residency" value={profile.cpf.residency} options={["Singapore Citizen", "Permanent Resident"] as const} onChange={(residency) => update({ cpf: { ...profile.cpf, residency } })} />
          {profile.cpf.residency === "Permanent Resident" ? <SelectField label="PR CPF Year" value={profile.cpf.prYear} options={["First Year", "Second Year", "Third Year Or Later"] as const} onChange={(prYear) => update({ cpf: { ...profile.cpf, prYear } })} /> : null}
          {profile.cpf.residency === "Permanent Resident" && profile.cpf.prYear !== "Third Year Or Later" ? <SelectField label="PR Contribution Basis" value={profile.cpf.prRateType} options={["Graduated Employer And Employee", "Full Employer And Graduated Employee", "Full Employer And Employee"] as const} onChange={(prRateType) => update({ cpf: { ...profile.cpf, prRateType } })} /> : null}
          <NumberField label="OA Balance" value={profile.cpf.oa} onChange={(oa) => update({ cpf: { ...profile.cpf, oa } })} />
          <NumberField label="SA Balance" value={profile.cpf.sa} onChange={(sa) => update({ cpf: { ...profile.cpf, sa } })} />
          <NumberField label="MA Balance" value={profile.cpf.ma} onChange={(ma) => update({ cpf: { ...profile.cpf, ma } })} />
          <NumberField label="RA Balance" value={profile.cpf.ra} onChange={(ra) => update({ cpf: { ...profile.cpf, ra } })} />
          <NumberField label="CPF LIFE Start Age" value={profile.cpf.lifeStart} onChange={(lifeStart) => update({ cpf: { ...profile.cpf, lifeStart: positive(lifeStart) || 65 } })} />
          <SelectField label="Retirement Sum" value={profile.cpf.lifeSum} options={["Basic", "Full", "Enhanced"] as const} onChange={(lifeSum) => update({ cpf: { ...profile.cpf, lifeSum } })} />
          <SelectField label="CPF LIFE Plan" value={profile.cpf.lifePlan} options={["Standard", "Basic", "Escalating"] as const} onChange={(lifePlan) => update({ cpf: { ...profile.cpf, lifePlan } })} />
          <NumberField label="CPF LIFE Monthly Payout Override" value={profile.cpf.lifeMonthlyOverride ?? ""} onChange={(lifeMonthlyOverride) => update({ cpf: { ...profile.cpf, lifeMonthlyOverride } })} helper="Optional. Enter the exact monthly payout from CPF's estimator when available." />
        </div>
      </FieldCard>
      {partner ? (
        <FieldCard title="Partner Income & CPF" description="Partner CPF is calculated separately using the partner's age, income, residency, and CPF LIFE choices, then combined into the household projection.">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <NumberField label="Partner Gross Monthly Income" value={partner.monthlyIncome} onChange={(monthlyIncome) => updatePartner({ monthlyIncome, incomeMode: "generic" })} />
            <SelectField label="Partner Work Status" value={partner.cpf.status} options={["Employed", "Self-employed"] as const} onChange={(status) => updatePartner({ cpf: { ...partner.cpf, status } })} />
            {partner.cpf.status === "Self-employed" ? <NumberField label="Partner Annual Mandatory MediSave Override" value={partner.cpf.selfAnnual} onChange={(selfAnnual) => updatePartner({ cpf: { ...partner.cpf, selfAnnual } })} helper="Optional. Leave at 0 for an estimate from income; use CPF's assessed amount when available." /> : null}
            <SelectField label="Partner CPF Residency" value={partner.cpf.residency} options={["Singapore Citizen", "Permanent Resident"] as const} onChange={(residency) => updatePartner({ cpf: { ...partner.cpf, residency } })} />
            {partner.cpf.residency === "Permanent Resident" ? <SelectField label="Partner PR CPF Year" value={partner.cpf.prYear} options={["First Year", "Second Year", "Third Year Or Later"] as const} onChange={(prYear) => updatePartner({ cpf: { ...partner.cpf, prYear } })} /> : null}
            {partner.cpf.residency === "Permanent Resident" && partner.cpf.prYear !== "Third Year Or Later" ? <SelectField label="Partner PR Contribution Basis" value={partner.cpf.prRateType} options={["Graduated Employer And Employee", "Full Employer And Graduated Employee", "Full Employer And Employee"] as const} onChange={(prRateType) => updatePartner({ cpf: { ...partner.cpf, prRateType } })} /> : null}
            <NumberField label="Partner OA Balance" value={partner.cpf.oa} onChange={(oa) => updatePartner({ cpf: { ...partner.cpf, oa } })} />
            <NumberField label="Partner SA Balance" value={partner.cpf.sa} onChange={(sa) => updatePartner({ cpf: { ...partner.cpf, sa } })} />
            <NumberField label="Partner MA Balance" value={partner.cpf.ma} onChange={(ma) => updatePartner({ cpf: { ...partner.cpf, ma } })} />
            <NumberField label="Partner RA Balance" value={partner.cpf.ra} onChange={(ra) => updatePartner({ cpf: { ...partner.cpf, ra } })} />
            <NumberField label="Partner CPF LIFE Start Age" value={partner.cpf.lifeStart} onChange={(lifeStart) => updatePartner({ cpf: { ...partner.cpf, lifeStart: positive(lifeStart) || 65 } })} />
            <SelectField label="Partner Retirement Sum" value={partner.cpf.lifeSum} options={["Basic", "Full", "Enhanced"] as const} onChange={(lifeSum) => updatePartner({ cpf: { ...partner.cpf, lifeSum } })} />
            <SelectField label="Partner CPF LIFE Plan" value={partner.cpf.lifePlan} options={["Standard", "Basic", "Escalating"] as const} onChange={(lifePlan) => updatePartner({ cpf: { ...partner.cpf, lifePlan } })} />
            <NumberField label="Partner CPF LIFE Monthly Payout Override" value={partner.cpf.lifeMonthlyOverride ?? ""} onChange={(lifeMonthlyOverride) => updatePartner({ cpf: { ...partner.cpf, lifeMonthlyOverride } })} helper="Optional. Enter the exact monthly payout from CPF's estimator when available." />
          </div>
        </FieldCard>
      ) : null}
    </section>
  );
}

function ExpensesStep({ profile, update }: StepProps) {
  const months = monthlyExpenses(profile) ? positive(profile.freeCash) / monthlyExpenses(profile) : 0;
  const monthlySurplus = monthlyIncome(profile) - monthlyExpenses(profile);
  const retirementAge = positive(profile.retirementAge) || positive(profile.age);
  const retirementExpenses = retirementAge ? monthlyExpensesPreview(profile, retirementAge) : monthlyExpenses(profile);
  return (
    <section className="expenses-step">
      <div className="expenses-step__top">
        <CashFlowCard
          title="Monthly Expenses"
          mode={profile.expenseMode}
          genericValue={profile.monthlyExpenses}
          items={profile.expenses}
          onModeChange={(expenseMode) => update({ expenseMode })}
          onGenericChange={(monthlyExpenses) => update({ monthlyExpenses })}
          onItemsChange={(expenses) => update({ expenses })}
          addLabel="Expense"
        />
        <div className="expenses-step__side">
          <FieldCard title="Free Cash Holdings">
            <NumberField label="Current Free Cash" value={profile.freeCash} onChange={(freeCash) => update({ freeCash })} />
            <NumberField label="Free Cash Interest % p.a." value={profile.freeCashRate} onChange={(freeCashRate) => update({ freeCashRate: toNumber(freeCashRate) })} />
          </FieldCard>
          <Card className="emergency-rating-card">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Emergency Cash Rating</p>
              <strong className={`mt-3 block text-3xl font-semibold ${months >= 6 ? "text-success" : months >= 3 ? "text-primary" : months >= 1 ? "text-warning" : "text-destructive"}`}>
                {months.toFixed(1)} Months
              </strong>
              <p className="mt-3 text-sm text-muted-foreground">
                {months < 1 ? "Please manage your cashflow and save up!" : months < 3 ? "You are almost there." : months < 6 ? "MAS is proud of you." : "You are ready for almost anything, except maybe inflation?"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <DecisionPreview
        title="Cash Flow Preview"
        description="This shows the immediate cash-flow impact of your spending and emergency cash assumptions."
        items={[
          { label: "Monthly Surplus / Deficit Today", value: currency(monthlySurplus), tone: monthlySurplus >= 0 ? "good" : "bad" },
          { label: "Emergency Cash Months", value: `${months.toFixed(1)} Months`, tone: months >= 3 ? "good" : months >= 1 ? "info" : "bad" },
          { label: "Projected Monthly Expenses At Retirement", value: currency(retirementExpenses), tone: "info", note: `Age ${retirementAge || "-"}` }
        ]}
      />
      <FieldCard title="Inflation Assumptions">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Income Growth %" value={profile.incomeInf} onChange={(incomeInf) => update({ incomeInf: toNumber(incomeInf) })} />
          <NumberField label="Expense Inflation %" value={profile.expenseInf} onChange={(expenseInf) => update({ expenseInf: toNumber(expenseInf) })} />
        </div>
      </FieldCard>
    </section>
  );
}

const policyTypes: InsurancePolicyType[] = ["Term", "Whole Life", "Investment Linked Policies", "Universal Life", "Hospitalization", "Personal Accident", "Careshield Life Enhancement", "Disability Income"];
const insurers = ["Great Eastern Life", "AIA Singapore", "Prudential Singapore", "Income Insurance", "Manulife Singapore", "Singlife", "HSBC Life", "Etiqa", "FWD Singapore", "Other"];
const taxReliefOptions: { key: TaxReliefKey; label: string; helper: string; defaultAmount: number | ""; rebate?: boolean }[] = [
  { key: "earnedIncome", label: "Earned Income Relief", helper: "Usually applies when you have employment or trade income.", defaultAmount: 1000 },
  { key: "spouse", label: "Spouse / Handicapped Spouse Relief", helper: "Use only if you qualify under IRAS rules.", defaultAmount: 2000 },
  { key: "parent", label: "Parent / Handicapped Parent Relief", helper: "Enter the qualifying amount based on living arrangement and eligibility.", defaultAmount: 9000 },
  { key: "child", label: "Qualifying / Handicapped Child Relief", helper: "Enter the total child relief amount that applies to your household.", defaultAmount: 4000 },
  { key: "workingMotherChild", label: "Working Mother's Child Relief", helper: "For eligible working mothers. Enter the qualifying amount after checking IRAS rules.", defaultAmount: "" },
  { key: "grandparentCaregiver", label: "Grandparent Caregiver Relief", helper: "For eligible working mothers with qualifying caregiver arrangements.", defaultAmount: 3000 },
  { key: "foreignDomesticWorker", label: "Foreign Domestic Worker Levy Relief", helper: "Applies only where IRAS eligibility conditions are met.", defaultAmount: "" },
  { key: "courseFees", label: "Course Fees Relief", helper: "For qualifying employment-related courses, subject to IRAS limits.", defaultAmount: "" },
  { key: "cpfCashTopUp", label: "CPF Cash Top-Up Relief", helper: "For eligible cash top-ups to CPF accounts. Enter only the relief amount that qualifies.", defaultAmount: "" },
  { key: "lifeInsurance", label: "Life Insurance Relief", helper: "Only available in limited situations; check IRAS eligibility before enabling.", defaultAmount: "" },
  { key: "nsman", label: "NSman Relief", helper: "For eligible NSmen, wives, and parents.", defaultAmount: 1500 },
  { key: "parenthoodTaxRebate", label: "Parenthood Tax Rebate", helper: "This is a rebate, not a relief. Enter the applicable YA/year and amount.", defaultAmount: "", rebate: true }
];

function newPolicy(profile: SingaporePlannerProfile): InsurancePolicy {
  return {
    id: uid("policy"),
    type: "Term",
    name: "",
    insurer: "Great Eastern Life",
    geBasePlan: "None",
    geTotalCare2Tier: "None",
    geTotalCarePlus2: false,
    startAge: profile.age,
    annualPremium: "",
    annualMedisavePremium: "",
    premiumDuration: "",
    coverageDuration: "",
    death: "",
    tpd: "",
    majorCi: "",
    earlyCi: "",
    accidentMedical: "",
    accidentDeath: "",
    accidentTpd: "",
    disabilityMonthly: "",
    hospitalizationTier: "None"
  };
}

function policyPremium(policy: InsurancePolicy, age: number) {
  if (policy.type === "Hospitalization" && policy.insurer === "Great Eastern Life") {
    return geHospitalizationPremium(policy, positive(policy.startAge) || age);
  }
  const cash = positive(policy.annualPremium);
  const medisave = positive(policy.annualMedisavePremium);
  return { cash, medisave, total: cash + medisave };
}

function policyHospitalization(policy: InsurancePolicy) {
  if (policy.type !== "Hospitalization") return "-";
  if (policy.insurer === "Great Eastern Life") {
    const parts = [policy.geBasePlan, policy.geTotalCare2Tier, policy.geTotalCarePlus2 ? "Plus 2" : ""]
      .filter(Boolean)
      .filter((part) => part !== "None");
    return parts.length ? parts.join(" / ") : policy.hospitalizationTier;
  }
  return policy.hospitalizationTier;
}

function policyPremiumActive(profile: SingaporePlannerProfile, policy: InsurancePolicy, age: number) {
  const start = positive(policy.startAge) || positive(profile.age) || age;
  const duration = positive(policy.premiumDuration) || positive(policy.coverageDuration) || Math.max(0, profile.endAge - start + 1);
  return age >= start && age < start + duration;
}

function policyPremiumAtSnapshot(policy: InsurancePolicy, age: number) {
  if (policy.type === "Hospitalization" && policy.insurer === "Great Eastern Life") {
    return geHospitalizationPremium(policy, age);
  }
  const cash = positive(policy.annualPremium);
  const medisave = positive(policy.annualMedisavePremium);
  return { cash, medisave, total: cash + medisave };
}

function livingExpenseBreakdown(profile: SingaporePlannerProfile, age: number): [string, number][] {
  const years = Math.max(0, Math.floor(age) - Math.floor(positive(profile.age)));
  const inflation = (1 + toNumber(profile.expenseInf) / 100) ** years;
  if (profile.expenseMode === "breakdown" && profile.expenses.some((item) => positive(item.amount) > 0)) {
    return profile.expenses
      .filter((item) => positive(item.amount) > 0)
      .map((item): [string, number] => [item.label || "Unnamed Expense", positive(item.amount) * 12 * inflation]);
  }
  const generic = positive(profile.monthlyExpenses) * 12 * inflation;
  return generic ? [["Generic Living Expenses", generic]] : [];
}

function insurancePremiumBreakdown(profile: SingaporePlannerProfile, point: ProjectionYear): [string, number][] {
  const rows: [string, number][] = [];
  const manualCash = positive(profile.protection.annualCashPremiums);
  const manualMedisave = positive(profile.protection.annualMedisavePremiums);
  if (manualCash) rows.push(["Manual Cash Premiums", manualCash]);
  if (manualMedisave) rows.push(["Manual MediSave Premiums", manualMedisave]);

  profile.protection.policies
    .filter((policy) => policyPremiumActive(profile, policy, point.age))
    .forEach((policy) => {
      const premium = policyPremiumAtSnapshot(policy, point.age);
      const label = `${policy.name || policy.type}${policy.insurer ? ` (${policy.insurer})` : ""}`;
      if (premium.cash) rows.push([`${label} - Cash`, premium.cash]);
      if (premium.medisave) rows.push([`${label} - MediSave`, premium.medisave]);
      if (!premium.cash && !premium.medisave && premium.total) rows.push([label, premium.total]);
    });

  if (point.annualCareShieldPremiums) rows.push(["CareShield Life / Supplement", point.annualCareShieldPremiums]);
  if (point.annualMediShieldPremiums) {
    const loading = point.annualMediShieldAdditionalPremium ? `, ${currency(point.annualMediShieldAdditionalPremium)} loading` : "";
    rows.push([`MediShield Life (Base ${currency(point.annualMediShieldBasePremium)}${loading})`, point.annualMediShieldPremiums]);
  }

  const detailTotal = rows.reduce((sum, [, value]) => sum + value, 0);
  const remainder = point.annualInsurancePremiums - detailTotal;
  if (Math.abs(remainder) > 1) rows.push(["Other Insurance Premiums", remainder]);
  return rows;
}

function ProtectionStep({ profile, update }: StepProps) {
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const annualIncome = monthlyIncome(profile) * 12;
  const protection = profile.protection;
  const currentProtection = protectionAtAge(profile, positive(profile.age));
  const currentMediShield = mediShieldPremiumAtAge(profile, positive(profile.age));
  const shieldNeed = 1;
  const items = [
    ["Death", currentProtection.death, annualIncome * 9, "9x annual income"],
    ["TPD", currentProtection.tpd, annualIncome * 9, "9x annual income"],
    ["Major CI", currentProtection.majorCi, annualIncome * 4, "4x annual income"],
    ["Early CI", currentProtection.earlyCi, annualIncome * 3, "3x annual income"],
    ["Accident", currentProtection.accident, annualIncome * 9, "9x annual income"],
    ["Disability", currentProtection.disabilityMonthly * 12 + careShieldCoverageAnnual(profile, positive(profile.age)), annualIncome * 0.5, "50% of active income"],
    ["Shield", currentProtection.shieldCovered ? 1 : 0, shieldNeed, "Covered / not covered"]
  ] as const;
  const averagePct = items.reduce((sum, [, covered, need]) => sum + (need ? Math.min(100, (covered / need) * 100) : 0), 0) / items.length;
  const mindState = averagePct <= 0 ? ["Never Mind", "No meaningful protection entered yet."] : averagePct < 36 ? ["Worrisome Mind", "Important coverage gaps need attention."] : averagePct < 67 ? ["On Your Mind", "Some core protection is forming."] : ["Peace Of Mind", "Most key protection areas are covered."];
  const missing = items.filter(([, covered, need]) => need > 0 && covered < need).slice(0, 4);
  const editingPolicy = profile.protection.policies.find((policy) => policy.id === editingPolicyId);
  const savePolicyPatch = (id: string, patch: Partial<InsurancePolicy>) => update({ protection: { ...protection, policies: protection.policies.map((policy) => (policy.id === id ? { ...policy, ...patch } : policy)) } });
  const addPolicy = () => {
    const policy = newPolicy(profile);
    update({ protection: { ...protection, policies: [...protection.policies, policy] } });
    setEditingPolicyId(policy.id);
  };
  return (
    <section className="protection-step">
      <FieldCard title="Insurance Policies" description="Add or edit policies first. The protection snapshot below updates immediately from these entries.">
        {protection.policies.length ? (
          <div className="grid gap-3">
            {protection.policies.map((policy) => (
              <SummaryRow
                key={policy.id}
                title={policy.name || policy.type}
                meta={`${policy.insurer || "Insurer"} - ${policy.type} - Start age ${policy.startAge || positive(profile.age) || "-"}`}
                value={policy.type === "Hospitalization" && policy.insurer === "Great Eastern Life" ? currency(geHospitalizationPremium(policy, positive(policy.startAge) || positive(profile.age)).total) : currency(positive(policy.annualPremium) + positive(policy.annualMedisavePremium))}
                onEdit={() => setEditingPolicyId(policy.id)}
                onDelete={() => update({ protection: { ...protection, policies: protection.policies.filter((row) => row.id !== policy.id) } })}
              />
            ))}
            <div className="record-table" role="table" aria-label="Protection policy summary">
              <div className="record-table__head" role="row">
                {["Plan", "Start", "Premiums", "Premium Duration", "Coverage Duration", "Death", "TPD", "Major CI", "Early CI", "Accident", "Disability", "Hospitalization"].map((header) => (
                  <span role="columnheader" key={header}>{header}</span>
                ))}
              </div>
              {protection.policies.map((policy) => {
                const premium = policyPremium(policy, positive(policy.startAge) || positive(profile.age));
                return (
                  <button className="record-table__row" role="row" key={policy.id} onClick={() => setEditingPolicyId(policy.id)}>
                    <span>{policy.name || policy.type}</span>
                    <span>{policy.startAge || "-"}</span>
                    <span>{currency(premium.total)}</span>
                    <span>{policy.premiumDuration || "-"}</span>
                    <span>{policy.coverageDuration || "-"}</span>
                    <span>{currency(positive(policy.death))}</span>
                    <span>{currency(positive(policy.tpd))}</span>
                    <span>{currency(positive(policy.majorCi))}</span>
                    <span>{currency(positive(policy.earlyCi))}</span>
                    <span>{currency(positive(policy.accidentMedical) + positive(policy.accidentDeath) + positive(policy.accidentTpd))}</span>
                    <span>{policy.disabilityMonthly ? `${currency(positive(policy.disabilityMonthly))}/mo` : currency(0)}</span>
                    <span>{policyHospitalization(policy)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="No policies added yet" description="Add existing policies to populate coverage, premiums, and year-by-year outflows." />
        )}
        <Button variant="outline" onClick={addPolicy}><Plus className="h-4 w-4" /> Add Policy</Button>
      </FieldCard>
      <div className="protection-overview">
        <Card className="state-card">
          <CardContent className="grid gap-3 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">State Of Mind (Protection)</p>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border bg-secondary"><HeartPulse className="h-8 w-8 text-primary" /></div>
              <div>
                <strong className="block text-2xl font-semibold">{mindState[0]}</strong>
                <span className="text-sm text-muted-foreground">{mindState[1]}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="state-card">
          <CardContent className="grid gap-3 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">What Is Missing</p>
            {missing.length ? missing.map(([label, covered, need, guide]) => (
              <div className="flex items-center justify-between gap-3 text-sm" key={label}>
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> {label}</span>
                <strong className="tabular-nums">{Math.round((covered / need) * 100)}%</strong>
                <small className="text-muted-foreground">{guide}</small>
              </div>
            )) : <p className="text-sm text-muted-foreground">No obvious protection gaps from the current inputs.</p>}
          </CardContent>
        </Card>
      </div>
      <div className="coverage-grid">
        {items.map(([label, covered, need, guide], index) => {
          const pct = need ? Math.min(100, (covered / need) * 100) : 0;
          const shieldStyle = {
            "--shield-color": allocationColors[index % allocationColors.length],
            "--shield-progress": `${pct}%`
          } as CSSProperties;
          return (
            <Card className="coverage-card" key={label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="shield-progress" style={shieldStyle}>
                    <Shield className="h-5 w-5" />
                  </span>
                  <span className={`text-sm font-semibold ${pct >= 100 ? "text-success" : pct >= 67 ? "text-info" : "text-destructive"}`}>{Math.round(pct)}%</span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label} Protection</p>
                <strong className="mt-1 block tabular-nums">{label === "Shield" ? (covered ? "Covered" : "Not Covered") : currency(covered)}</strong>
                <small className="mt-2 block text-muted-foreground">{label === "Shield" ? guide : `Recommended: ${currency(need)} - ${guide}`}</small>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <FieldCard title="Manual Protection Totals" description="Use this if you want a fast high-level estimate before entering individual policies.">
        <div className="manual-protection-grid">
          {(["death", "tpd", "majorCi", "earlyCi", "accident", "disabilityMonthly", "annualCashPremiums", "annualMedisavePremiums"] as const).map((key) => (
            <NumberField key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (m) => m.toUpperCase())} value={protection[key]} onChange={(value) => update({ protection: { ...protection, [key]: value } })} />
          ))}
          <ToggleRow label="Shield Plan Covered" checked={protection.shieldCovered} onChange={(shieldCovered) => update({ protection: { ...protection, shieldCovered } })} />
          <ToggleRow label="Include CareShield Life" checked={profile.healthcare.careShield.enabled} onChange={(enabled) => update({ healthcare: { ...profile.healthcare, careShield: { ...profile.healthcare.careShield, enabled } } })} />
          <ToggleRow label="CareShield Enhancement" checked={profile.healthcare.careShield.enhancement} onChange={(enhancement) => update({ healthcare: { ...profile.healthcare, careShield: { ...profile.healthcare.careShield, enhancement } } })} />
          <ToggleRow label="Include MediShield Life" checked={profile.healthcare.mediShield.enabled} onChange={(enabled) => update({ healthcare: { ...profile.healthcare, mediShield: { ...profile.healthcare.mediShield, enabled, subsidyMode: "None", manualSubsidyPct: "" } } })} />
        </div>
        {profile.healthcare.careShield.enabled ? (
          <div className="sub-form-grid">
            <NumberField label="CareShield Enhancement MediSave Premium / Yr" value={profile.healthcare.careShield.enhancementAnnualMedisave} onChange={(enhancementAnnualMedisave) => update({ healthcare: { ...profile.healthcare, careShield: { ...profile.healthcare.careShield, enhancementAnnualMedisave } } })} />
            <NumberField label="CareShield Enhancement Monthly Benefit" value={profile.healthcare.careShield.enhancementMonthlyBenefit} onChange={(enhancementMonthlyBenefit) => update({ healthcare: { ...profile.healthcare, careShield: { ...profile.healthcare.careShield, enhancementMonthlyBenefit } } })} />
          </div>
        ) : null}
        {profile.healthcare.mediShield.enabled ? (
          <div className="sub-form-grid medishield-grid">
            <MetricCard
              label="MediShield Life Premium From MediSave"
              value={currency(currentMediShield.total)}
              note={`Base ${currency(currentMediShield.base)}${currentMediShield.additional ? ` - Loading ${currency(currentMediShield.additional)}` : ""} - Subsidies assumed $0`}
              tone="info"
            />
            <SelectField label="MediShield Residency" value={profile.healthcare.mediShield.residency} options={["Singapore Citizen / PR", "Permanent Resident", "Foreigner"] as const} onChange={(residency) => update({ healthcare: { ...profile.healthcare, mediShield: { ...profile.healthcare.mediShield, residency } } })} />
            <ToggleRow label="Serious Pre-Existing Condition Loading" checked={profile.healthcare.mediShield.preExisting} onChange={(preExisting) => update({ healthcare: { ...profile.healthcare, mediShield: { ...profile.healthcare.mediShield, preExisting } } })} />
            {profile.healthcare.mediShield.preExisting ? <NumberField label="Additional Premium Start Age" value={profile.healthcare.mediShield.preExistingStartAge} onChange={(preExistingStartAge) => update({ healthcare: { ...profile.healthcare, mediShield: { ...profile.healthcare.mediShield, preExistingStartAge } } })} /> : null}
            <p className="sub-form-note text-sm text-muted-foreground">
              Estimate only. This planner assumes MediShield Life subsidies are $0, so the full age-next-birthday premium is deducted from MediSave. Actual premiums and subsidies should be checked through CPF e-services with Singpass.
              {" "}<a className="underline" href="https://www.cpf.gov.sg/member/healthcare-financing/medishield-life/medishield-life-premiums-and-subsidies" target="_blank" rel="noreferrer">CPF reference</a>
              {" - "}<a className="underline" href="https://www.moh.gov.sg/managing-expenses/schemes-and-subsidies/medishield-life/medishield-life-premium-and-subsidy-tables/" target="_blank" rel="noreferrer">MOH tables</a>
            </p>
          </div>
        ) : null}
      </FieldCard>
      <PolicyDialog
        profile={profile}
        policy={editingPolicy}
        open={Boolean(editingPolicy)}
        onOpenChange={(open) => {
          if (!open) setEditingPolicyId(null);
        }}
        updatePolicy={(patch) => editingPolicy && savePolicyPatch(editingPolicy.id, patch)}
      />
    </section>
  );
}

function PolicyDialog({
  profile,
  policy,
  open,
  onOpenChange,
  updatePolicy
}: {
  profile: SingaporePlannerProfile;
  policy?: InsurancePolicy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updatePolicy: (patch: Partial<InsurancePolicy>) => void;
}) {
  if (!policy) return null;
  const ge = geHospitalizationPremium(policy, positive(policy.startAge) || positive(profile.age));
  const isHospital = policy.type === "Hospitalization";
  const isGeHospital = isHospital && policy.insurer === "Great Eastern Life";
  const policyCashPremium = isGeHospital ? ge.cash : positive(policy.annualPremium);
  const policyMedisavePremium = isGeHospital ? ge.medisave : positive(policy.annualMedisavePremium);
  const policyAccident = positive(policy.accidentMedical) + positive(policy.accidentDeath) + positive(policy.accidentTpd);
  const setType = (type: InsurancePolicyType) => updatePolicy({ type, hospitalizationTier: type === "Hospitalization" ? "Private" : "None" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{policy.name || "Policy Details"}</DialogTitle>
          <DialogDescription>Group details once here; the list stays simple after saving.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <DecisionPreview
            title="Policy Impact Preview"
            description="Shows the main coverage and premium impact of this policy only."
            items={[
              { label: "Annual Cash Premium", value: currency(policyCashPremium), tone: policyCashPremium > 0 ? "bad" : "default" },
              { label: "Annual MediSave Premium", value: currency(policyMedisavePremium), tone: policyMedisavePremium > 0 ? "info" : "default" },
              { label: "Death / TPD Added", value: currency(positive(policy.death) + positive(policy.tpd)), tone: "good" },
              { label: "CI Added", value: currency(positive(policy.majorCi) + positive(policy.earlyCi)), tone: "good" },
              { label: "Accident Added", value: currency(policyAccident), tone: "good" },
              { label: "Hospital Tier", value: isHospital ? policyHospitalization(policy) : "-", tone: isHospital ? "info" : "default" }
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Policy Type" value={policy.type} options={policyTypes} onChange={setType} />
            <TextField label="Plan Name" value={policy.name} onChange={(name) => updatePolicy({ name })} />
            <SelectField label="Insurer" value={policy.insurer} options={insurers} onChange={(insurer) => updatePolicy({ insurer })} />
            <NumberField label="Start Age" value={policy.startAge} onChange={(startAge) => updatePolicy({ startAge })} />
          </div>
          {isGeHospital ? (
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="GSH Base Plan" value={policy.geBasePlan ?? "None"} options={["None", "P Plus", "P Prime", "A Plus", "B Plus", "Standard"] as const} onChange={(geBasePlan) => updatePolicy({ geBasePlan, annualMedisavePremium: Math.round(geHospitalizationPremium({ ...policy, geBasePlan }, positive(policy.startAge) || positive(profile.age)).medisave) })} />
              <SelectField label="TotalCare 2 Tier" value={policy.geTotalCare2Tier ?? "None"} options={["None", "P", "Prime", "A", "B"] as const} onChange={(geTotalCare2Tier) => updatePolicy({ geTotalCare2Tier, annualPremium: Math.round(geHospitalizationPremium({ ...policy, geTotalCare2Tier }, positive(policy.startAge) || positive(profile.age)).cash) })} />
              <ToggleRow label="TotalCare Plus 2 Essential" checked={Boolean(policy.geTotalCarePlus2)} onChange={(geTotalCarePlus2) => updatePolicy({ geTotalCarePlus2, annualPremium: Math.round(geHospitalizationPremium({ ...policy, geTotalCarePlus2 }, positive(policy.startAge) || positive(profile.age)).cash) })} />
              <MetricCard label="Estimated Annual Premium" value={currency(ge.total)} note={`Cash ${currency(ge.cash)} - MediSave ${currency(ge.medisave)}`} tone="info" />
            </div>
          ) : null}
          {isHospital && !isGeHospital ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Hospitalization Tier" value={policy.hospitalizationTier} options={["None", "Private", "Govt A Ward", "Govt B1 Ward", "Govt B2 Ward", "Basic MediShield Life"] as const} onChange={(hospitalizationTier) => updatePolicy({ hospitalizationTier })} />
              <NumberField label="Annual Cash Premium" value={policy.annualPremium} onChange={(annualPremium) => updatePolicy({ annualPremium })} />
              <NumberField label="Annual MediSave Premium" value={policy.annualMedisavePremium} onChange={(annualMedisavePremium) => updatePolicy({ annualMedisavePremium })} />
            </div>
          ) : null}
          {!isHospital ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <NumberField label="Annual Premium" value={policy.annualPremium} onChange={(annualPremium) => updatePolicy({ annualPremium })} />
                <NumberField label="Premium Duration" value={policy.premiumDuration} onChange={(premiumDuration) => updatePolicy({ premiumDuration })} />
                <NumberField label="Coverage Duration" value={policy.coverageDuration} onChange={(coverageDuration) => updatePolicy({ coverageDuration })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <NumberField label="Death" value={policy.death} onChange={(death) => updatePolicy({ death })} />
                <NumberField label="TPD" value={policy.tpd} onChange={(tpd) => updatePolicy({ tpd })} />
                <NumberField label="Major CI" value={policy.majorCi} onChange={(majorCi) => updatePolicy({ majorCi })} />
                <NumberField label="Early CI" value={policy.earlyCi} onChange={(earlyCi) => updatePolicy({ earlyCi })} />
                <NumberField label="Accidental Medical" value={policy.accidentMedical} onChange={(accidentMedical) => updatePolicy({ accidentMedical })} />
                <NumberField label="Accidental Death" value={policy.accidentDeath} onChange={(accidentDeath) => updatePolicy({ accidentDeath })} />
                <NumberField label="Accidental TPD" value={policy.accidentTpd} onChange={(accidentTpd) => updatePolicy({ accidentTpd })} />
                <NumberField label="Monthly Disability Income" value={policy.disabilityMonthly} onChange={(disabilityMonthly) => updatePolicy({ disabilityMonthly })} />
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetsStep({ profile, update }: StepProps) {
  const [assetModal, setAssetModal] = useState<{ kind: "home" | "car" | "custom"; id: string } | null>(null);
  const housingEquity = profile.homes.reduce((sum, item) => sum + Math.max(0, positive(item.value) - positive(item.loan)), 0);
  const carEquity = profile.cars.reduce((sum, item) => sum + Math.max(0, positive(item.value) - positive(item.loan)), 0);
  const otherEquity = profile.customAssets.reduce((sum, item) => sum + Math.max(0, positive(item.value) - positive(item.liability)), 0);
  const linkedLiabilities = profile.homes.reduce((sum, item) => sum + positive(item.loan), 0) + profile.cars.reduce((sum, item) => sum + positive(item.loan), 0) + profile.customAssets.reduce((sum, item) => sum + positive(item.liability), 0);
  const monthlyDebt = profile.homes.reduce((sum, item) => sum + monthlyMortgage(item, positive(item.loan), 0, 0), 0) + profile.cars.reduce((sum, item) => sum + monthlyMortgage(item, positive(item.loan), 0, 0) + positive(item.monthlyExpense), 0);
  const openNewHome = () => {
    const item: HousingAsset = { id: uid("home"), label: "", value: "", appreciation: 2, loan: "", rate: 2.6, term: "", saleAge: "", cpfUsed: "", cpfAccruedInterest: "" };
    update({ homes: [...profile.homes, item] });
    setAssetModal({ kind: "home", id: item.id });
  };
  const openNewCar = () => {
    const item: CarAsset = { id: uid("car"), label: "", value: "", purchaseAge: profile.age, coeYearsLeft: "", depreciation: "", loan: "", rate: "", term: "", monthlyExpense: "" };
    update({ cars: [...profile.cars, item] });
    setAssetModal({ kind: "car", id: item.id });
  };
  const openNewCustom = () => {
    const item: CustomAsset = { id: uid("custom"), label: "", value: "", growth: "", liability: "", liabilityRate: "", liabilityTerm: "", drawdown: false };
    update({ customAssets: [...profile.customAssets, item] });
    setAssetModal({ kind: "custom", id: item.id });
  };
  const activeHome = assetModal?.kind === "home" ? profile.homes.find((item) => item.id === assetModal.id) : undefined;
  const activeCar = assetModal?.kind === "car" ? profile.cars.find((item) => item.id === assetModal.id) : undefined;
  const activeCustom = assetModal?.kind === "custom" ? profile.customAssets.find((item) => item.id === assetModal.id) : undefined;
  return (
    <section className="step-grid">
      <div className="step-grid__full">
        <FieldCard
          title="Property In Net Worth"
          description="Property remains fully projected either way. Turn this on only if you want housing equity included in headline net worth, charts, snapshots, scenarios, and reports."
        >
          <ToggleRow
            label="Include Property Equity In Net Worth"
            checked={profile.includePropertyInNetWorth}
            onChange={(includePropertyInNetWorth) => update({ includePropertyInNetWorth })}
          />
          <p className="text-xs text-muted-foreground">
            Off by default to keep retirement projections focused on financial assets. Mortgages, property tax, CPF OA usage, sales, and sale proceeds are still calculated.
          </p>
        </FieldCard>
      </div>
      <div className="step-grid__full">
        <DecisionPreview
          title="Asset And Liability Preview"
          description="A quick view of how added assets improve net worth while loans and running costs pressure cash flow."
          items={[
            { label: "Property Equity", value: currency(housingEquity), tone: profile.includePropertyInNetWorth ? "good" : "info", note: profile.includePropertyInNetWorth ? "Included in net worth" : "Tracked separately" },
            { label: "Other Asset Equity", value: currency(carEquity + otherEquity), tone: "good" },
            { label: "Linked Liabilities", value: currency(linkedLiabilities), tone: linkedLiabilities > 0 ? "bad" : "default" },
            { label: "Monthly Debt And Asset Outflow", value: currency(monthlyDebt), tone: monthlyDebt > 0 ? "bad" : "default" },
            { label: "Assets Added", value: String(profile.homes.length + profile.cars.length + profile.customAssets.length), tone: "info" }
          ]}
        />
      </div>
      <FieldCard title="Assets & Liabilities" description="Keep the page scannable: add or edit each asset in a focused window.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openNewHome}><Plus className="h-4 w-4" /> Add Housing</Button>
          <Button variant="outline" onClick={openNewCar}><Plus className="h-4 w-4" /> Add Car</Button>
          <Button variant="outline" onClick={openNewCustom}><Plus className="h-4 w-4" /> Add Other Asset</Button>
        </div>
        <div className="grid gap-3">
          {[...profile.homes.map((item) => ({ kind: "home" as const, item, meta: "Housing", value: positive(item.value) - positive(item.loan) })),
            ...profile.cars.map((item) => ({ kind: "car" as const, item, meta: `Car - COE ${item.coeYearsLeft || "-"} years`, value: positive(item.value) - positive(item.loan) })),
            ...profile.customAssets.map((item) => ({ kind: "custom" as const, item, meta: "Other Asset", value: positive(item.value) - positive(item.liability) }))].map(({ kind, item, meta, value }) => (
              <SummaryRow
                key={item.id}
                title={item.label || meta}
                meta={meta}
                value={currency(Math.max(0, value))}
                onEdit={() => setAssetModal({ kind, id: item.id })}
                onDelete={() => {
                  if (kind === "home") update({ homes: profile.homes.filter((row) => row.id !== item.id) });
                  if (kind === "car") update({ cars: profile.cars.filter((row) => row.id !== item.id) });
                  if (kind === "custom") update({ customAssets: profile.customAssets.filter((row) => row.id !== item.id) });
                }}
              />
            ))}
          {!profile.homes.length && !profile.cars.length && !profile.customAssets.length ? <EmptyState title="No assets added yet" description="Add housing, car, or custom assets only if they apply." /> : null}
        </div>
      </FieldCard>
      <Dialog open={Boolean(assetModal)} onOpenChange={(open) => !open && setAssetModal(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{activeHome ? "Housing Asset" : activeCar ? "Car Asset" : "Other Asset"}</DialogTitle>
            <DialogDescription>Basics, loan details, and projection assumptions stay grouped for easier entry.</DialogDescription>
          </DialogHeader>
          {activeHome ? <HousingEditor item={activeHome} profile={profile} updateItem={(patch) => update({ homes: profile.homes.map((row) => (row.id === activeHome.id ? { ...row, ...patch } : row)) })} /> : null}
          {activeCar ? <CarEditor item={activeCar} profile={profile} updateItem={(patch) => update({ cars: profile.cars.map((row) => (row.id === activeCar.id ? { ...row, ...patch } : row)) })} /> : null}
          {activeCustom ? <CustomAssetEditor item={activeCustom} profile={profile} updateItem={(patch) => update({ customAssets: profile.customAssets.map((row) => (row.id === activeCustom.id ? { ...row, ...patch } : row)) })} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AssetList<T extends { id: string }>({ title, items, add, remove, render }: { title: string; items: T[]; add: () => void; remove: (id: string) => void; render: (item: T) => ReactNode }) {
  return (
    <FieldCard title={title}>
      {items.length ? items.map((item) => <div className="rounded-lg border p-4" key={item.id}>{render(item)}<Button className="mt-3" variant="outline" onClick={() => remove(item.id)}>Delete</Button></div>) : <p className="text-sm text-muted-foreground">No {title.toLowerCase()} added yet.</p>}
      <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add {title.slice(0, -1) || title}</Button>
    </FieldCard>
  );
}

function HousingEditor({ item, profile, updateItem }: { item: HousingAsset; profile: SingaporePlannerProfile; updateItem: (patch: Partial<HousingAsset>) => void }) {
  const mortgage = monthlyMortgage(item, positive(item.loan), 0, 0);
  const years = Math.max(0, (positive(profile.retirementAge) || positive(profile.endAge) || positive(profile.age)) - positive(profile.age));
  const projectedValue = positive(item.value) * (1 + toNumber(item.appreciation) / 100) ** years;
  const saleAge = positive(item.saleAge);
  const saleYears = saleAge ? Math.max(0, saleAge - positive(profile.age)) : years;
  const saleValue = positive(item.value) * (1 + toNumber(item.appreciation) / 100) ** saleYears;
  const estimatedCpfRefund = positive(item.cpfUsed) ? positive(item.cpfUsed) * 1.025 ** saleYears + positive(item.cpfAccruedInterest) : 0;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><DecisionPreview title="Asset Impact Preview" description="A quick view of equity, debt, and optional property-sale CPF refund assumptions." items={[{ label: "Current Equity", value: currency(Math.max(0, positive(item.value) - positive(item.loan))), tone: "good" }, { label: "Estimated Monthly Mortgage", value: currency(mortgage), tone: mortgage > 0 ? "bad" : "default" }, { label: saleAge ? `Estimated Sale Value At Age ${saleAge}` : "Projected Value At Retirement", value: currency(saleAge ? saleValue : projectedValue), tone: "info" }, { label: "Estimated CPF Refund If Sold", value: currency(estimatedCpfRefund), tone: estimatedCpfRefund > 0 ? "bad" : "default" }]} /><TextField label="Label" value={item.label} onChange={(label) => updateItem({ label })} /><NumberField label="Current Property Value" value={item.value} onChange={(value) => updateItem({ value })} /><NumberField label="Annual Appreciation %" value={item.appreciation} onChange={(appreciation) => updateItem({ appreciation })} /><NumberField label="Outstanding Loan" value={item.loan} onChange={(loan) => updateItem({ loan })} /><NumberField label="Mortgage Rate %" value={item.rate} onChange={(rate) => updateItem({ rate })} /><NumberField label="Remaining Loan Term" value={item.term} onChange={(term) => updateItem({ term })} /><NumberField label="Estimated Monthly Mortgage" value={Math.round(mortgage)} readOnly onChange={() => undefined} /><NumberField label="Optional Sale Age" value={item.saleAge ?? ""} onChange={(saleAge) => updateItem({ saleAge })} /><NumberField label="CPF OA Used For Property" value={item.cpfUsed ?? ""} onChange={(cpfUsed) => updateItem({ cpfUsed })} /><NumberField label="Existing CPF Accrued Interest" value={item.cpfAccruedInterest ?? ""} onChange={(cpfAccruedInterest) => updateItem({ cpfAccruedInterest })} /></div>;
}

function CarEditor({ item, profile, updateItem }: { item: CarAsset; profile: SingaporePlannerProfile; updateItem: (patch: Partial<CarAsset>) => void }) {
  const dep = toNumber(item.depreciation) || positive(item.value) / Math.max(1, positive(item.coeYearsLeft) || 1);
  const loan = monthlyMortgage(item, positive(item.loan), 0, 0);
  const coeEndAge = (positive(item.purchaseAge) || positive(profile.age)) + (positive(item.coeYearsLeft) || 0);
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><DecisionPreview title="Car Cost Preview" description="Keeps the car decision tied to both cash flow and the COE timeline." items={[{ label: "Current Car Equity", value: currency(Math.max(0, positive(item.value) - positive(item.loan))), tone: "info" }, { label: "Monthly Car Outflow", value: currency(loan + positive(item.monthlyExpense)), tone: loan + positive(item.monthlyExpense) > 0 ? "bad" : "default" }, { label: "COE Ends Around", value: coeEndAge ? `Age ${coeEndAge}` : "-", tone: "info" }]} /><TextField label="Label" value={item.label} onChange={(label) => updateItem({ label })} /><NumberField label="Current Car Value" value={item.value} onChange={(value) => updateItem({ value, depreciation: toNumber(value) / Math.max(1, positive(item.coeYearsLeft) || 1) })} /><NumberField label="Purchase Age" value={item.purchaseAge} onChange={(purchaseAge) => updateItem({ purchaseAge })} /><NumberField label="COE Years Left" value={item.coeYearsLeft} onChange={(coeYearsLeft) => updateItem({ coeYearsLeft, term: Math.min(positive(item.term) || positive(coeYearsLeft), positive(coeYearsLeft) || 10), depreciation: positive(item.value) / Math.max(1, positive(coeYearsLeft) || 1) })} /><NumberField label="Depreciation $/Yr" value={Math.round(dep)} onChange={(depreciation) => updateItem({ depreciation })} /><NumberField label="Outstanding Car Loan" value={item.loan} onChange={(value) => updateItem({ loan: value })} /><NumberField label="Car Loan Rate %" value={item.rate} onChange={(rate) => updateItem({ rate })} /><NumberField label="Remaining Loan Duration" value={item.term} onChange={(term) => updateItem({ term: Math.min(positive(term), positive(item.coeYearsLeft) || positive(term)) })} /><NumberField label="Monthly Car Expenses" value={item.monthlyExpense} onChange={(monthlyExpense) => updateItem({ monthlyExpense })} /><NumberField label="Estimated Monthly Car Loan" value={Math.round(loan)} readOnly onChange={() => undefined} /></div>;
}

function CustomAssetEditor({ item, profile, updateItem }: { item: CustomAsset; profile: SingaporePlannerProfile; updateItem: (patch: Partial<CustomAsset>) => void }) {
  const years = Math.max(0, (positive(profile.retirementAge) || positive(profile.endAge) || positive(profile.age)) - positive(profile.age));
  const projectedValue = positive(item.value) * (1 + toNumber(item.growth) / 100) ** years;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><DecisionPreview title="Asset Impact Preview" description="Shows whether this custom asset is meaningful for retirement planning." items={[{ label: "Current Net Equity", value: currency(Math.max(0, positive(item.value) - positive(item.liability))), tone: "good" }, { label: "Projected Retirement Value", value: currency(projectedValue), tone: "info" }, { label: "Retirement Drawdown", value: item.drawdown ? "Included" : "Excluded", tone: item.drawdown ? "good" : "default" }]} /><TextField label="Label" value={item.label} onChange={(label) => updateItem({ label })} /><NumberField label="Current Asset Value" value={item.value} onChange={(value) => updateItem({ value })} /><NumberField label="Annual Growth / Depreciation %" value={item.growth} onChange={(growth) => updateItem({ growth })} /><NumberField label="Linked Liability" value={item.liability} onChange={(liability) => updateItem({ liability })} /><NumberField label="Liability Interest %" value={item.liabilityRate} onChange={(liabilityRate) => updateItem({ liabilityRate })} /><NumberField label="Liability Term" value={item.liabilityTerm} onChange={(liabilityTerm) => updateItem({ liabilityTerm })} /><div className="xl:col-span-2"><ToggleRow label="Available For Retirement Drawdown" checked={item.drawdown} onChange={(drawdown) => updateItem({ drawdown })} /></div></div>;
}

function TaxesStep({ profile, update }: StepProps) {
  const age = positive(profile.age);
  const gross = monthlyIncome(profile) * 12;
  const cpfRelief = cpfContribution(profile, age, gross).employee;
  const donationRelief = positive(profile.tax.donations) * 2.5;
  const srsRelief = srsContributionAtAge(profile, age);
  const selectedTaxReliefs = taxReliefSelectionsTotal(profile);
  const selectedTaxRebates = taxRebateSelectionsTotal(profile);
  const qualifyingReliefs = Math.min(80_000, cpfRelief + donationRelief + positive(profile.tax.otherReliefs) + selectedTaxReliefs + srsRelief);
  const chargeableIncome = Math.max(0, gross - qualifyingReliefs);
  const taxPayable = annualIncomeTax(profile, gross, age);
  const taxWithoutSrs = annualIncomeTax({ ...profile, srs: { ...profile.srs, enabled: false, annualContribution: 0 } }, gross, age);
  const srsTaxSaving = Math.max(0, taxWithoutSrs - taxPayable);
  const setRelief = (key: TaxReliefKey, patch: Partial<NonNullable<SingaporePlannerProfile["tax"]["reliefs"][TaxReliefKey]>>) => {
    const current = profile.tax.reliefs[key] ?? { enabled: false, amount: "", year: "" };
    update({ tax: { ...profile.tax, reliefs: { ...profile.tax.reliefs, [key]: { ...current, ...patch } } } });
  };
  return (
    <section className="taxes-step">
      <div className="taxes-step__metrics">
        <MetricCard label="Gross Annual Income" value={currency(gross)} tone="info" />
        <MetricCard label="Qualifying Reliefs" value={currency(qualifyingReliefs)} note="Capped at SGD 80,000" tone="good" />
        <MetricCard label="Chargeable Income" value={currency(chargeableIncome)} />
        <MetricCard label="Net Income Tax Payable" value={currency(taxPayable)} tone={taxPayable > 0 ? "bad" : "good"} />
      </div>
      <FieldCard title="Your Taxes" description="Tax logic uses gross income less employee CPF and selected reliefs capped at SGD 80,000, then resident tax rates less rebates.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Eligible Donations" value={profile.tax.donations} onChange={(donations) => update({ tax: { ...profile.tax, donations } })} />
          <NumberField label="Other Reliefs" value={profile.tax.otherReliefs} onChange={(otherReliefs) => update({ tax: { ...profile.tax, otherReliefs } })} />
          <NumberField label="Tax Rebates" value={profile.tax.rebates} onChange={(rebates) => update({ tax: { ...profile.tax, rebates } })} />
          <div className="grid gap-2">
            <NumberField label="Annual Property Tax Payable" value={profile.tax.propertyTaxAnnual} onChange={(propertyTaxAnnual) => update({ tax: { ...profile.tax, propertyTaxAnnual } })} />
            <p className="text-xs leading-relaxed text-muted-foreground">Enter the yearly property tax payable for owned properties. This is treated as an annual cash outflow in your projection.</p>
          </div>
          <SelectField label="Income Tax Payment Mode" value={profile.taxMode} options={["monthly", "annual"] as const} onChange={(taxMode) => update({ taxMode })} />
        </div>
        <div className="rounded-lg border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <strong className="block text-foreground">Formula</strong>
          Gross Annual Income {currency(gross)} - Qualifying Reliefs {currency(qualifyingReliefs)} = Chargeable Income {currency(chargeableIncome)}. Tax payable is then calculated from the resident tax table less rebates.
        </div>
        <p className="text-sm text-muted-foreground">Donations are treated as 2.5x tax relief per dollar of eligible donation.</p>
        <div className="tax-relief-grid">
          {taxReliefOptions.map((item) => {
            const relief = profile.tax.reliefs[item.key] ?? { enabled: false, amount: "", year: "" };
            return (
              <div className="rounded-lg border bg-card p-4" key={item.key}>
                <ToggleRow
                  label={item.label}
                  checked={Boolean(relief.enabled)}
                  onChange={(enabled) => setRelief(item.key, { enabled, amount: enabled && relief.amount === "" ? item.defaultAmount : relief.amount })}
                />
                {relief.enabled ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <NumberField label={item.rebate ? "Rebate Amount" : "Relief Amount"} value={relief.amount} onChange={(amount) => setRelief(item.key, { amount })} />
                    {item.rebate ? <NumberField label="Applicable YA / Year" value={relief.year ?? ""} onChange={(year) => setRelief(item.key, { year })} /> : null}
                    <p className="text-sm text-muted-foreground sm:col-span-2">{item.helper}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Selected Reliefs" value={currency(selectedTaxReliefs)} tone="good" />
          <MetricCard label="Selected Rebates" value={currency(selectedTaxRebates)} tone="info" />
          <MetricCard label="Relief Cap Remaining" value={currency(Math.max(0, 80_000 - qualifyingReliefs))} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="underline" href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-rates" target="_blank" rel="noreferrer">IRAS Income Tax Rates</a>
          <a className="underline" href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions" target="_blank" rel="noreferrer">IRAS Reliefs And Rebates</a>
          <a className="underline" href="https://www.iras.gov.sg/taxes/property-tax/property-owners/property-tax-rates" target="_blank" rel="noreferrer">IRAS Property Tax Rates</a>
        </div>
      </FieldCard>
      <FieldCard title="Supplementary Retirement Scheme (SRS)" description="SRS is hidden until enabled so tax planning stays simple for users who do not contribute.">
        <ToggleRow label="Enable SRS Planning" checked={profile.srs.enabled} onChange={(enabled) => update({ srs: { ...profile.srs, enabled } })} />
        {profile.srs.enabled ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DecisionPreview
              title="SRS Tax Preview"
              description="Shows the current-year relief effect only; retirement withdrawals are projected separately."
              items={[
                { label: "Annual SRS Contribution", value: currency(srsRelief), tone: srsRelief > 0 ? "good" : "default" },
                { label: "Estimated Tax Saving", value: currency(srsTaxSaving), tone: srsTaxSaving > 0 ? "good" : "default" },
                { label: "Relief Cap Remaining", value: currency(Math.max(0, 80_000 - qualifyingReliefs)), tone: "info" }
              ]}
            />
            <SelectField label="Residency Status" value={profile.srs.citizenship} options={["Singapore Citizen / PR", "Foreigner"] as const} onChange={(citizenship) => update({ srs: { ...profile.srs, citizenship } })} />
            <NumberField label="Current SRS Balance" value={profile.srs.currentBalance} onChange={(currentBalance) => update({ srs: { ...profile.srs, currentBalance } })} />
            <NumberField label="Annual SRS Contribution" value={profile.srs.annualContribution} onChange={(annualContribution) => update({ srs: { ...profile.srs, annualContribution } })} />
            <NumberField label="Contribution Start Age" value={profile.srs.contributionStartAge} onChange={(contributionStartAge) => update({ srs: { ...profile.srs, contributionStartAge } })} />
            <NumberField label="Contribution Stop Age" value={profile.srs.contributionStopAge} onChange={(contributionStopAge) => update({ srs: { ...profile.srs, contributionStopAge } })} />
            <NumberField label="Expected SRS Return %" value={profile.srs.expectedReturn} onChange={(expectedReturn) => update({ srs: { ...profile.srs, expectedReturn } })} />
            <NumberField label="Withdrawal Start Age" value={profile.srs.withdrawalStartAge} onChange={(withdrawalStartAge) => update({ srs: { ...profile.srs, withdrawalStartAge } })} />
            <SelectField label="Withdrawal Method" value={profile.srs.withdrawalMethod} options={["10-Year Drawdown", "Custom Annual", "Lump Sum"] as const} onChange={(withdrawalMethod) => update({ srs: { ...profile.srs, withdrawalMethod } })} />
            {profile.srs.withdrawalMethod === "Custom Annual" ? <NumberField label="Custom Annual Withdrawal" value={profile.srs.customAnnualWithdrawal} onChange={(customAnnualWithdrawal) => update({ srs: { ...profile.srs, customAnnualWithdrawal } })} /> : null}
            <ToggleRow label="Model As Early Withdrawal" checked={profile.srs.earlyWithdrawal} onChange={(earlyWithdrawal) => update({ srs: { ...profile.srs, earlyWithdrawal } })} />
            <ToggleRow label="Available For Retirement Drawdown" checked={profile.srs.drawdown} onChange={(drawdown) => update({ srs: { ...profile.srs, drawdown } })} />
          </div>
        ) : null}
      </FieldCard>
    </section>
  );
}

function InvestmentsStep({ profile, update }: StepProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const visibleAssets = profile.assets.filter((asset) => !asset.isShiftTarget);
  const editing = visibleAssets.find((asset) => asset.id === editingId);
  const retirementAge = positive(profile.retirementAge) || positive(profile.endAge) || positive(profile.age);
  const retirementRow = projectSingaporeProfile(profile).find((row) => row.age >= retirementAge);
  const currentValue = visibleAssets.reduce((sum, asset) => sum + positive(asset.value), 0);
  const annualContributions = visibleAssets.reduce((sum, asset) => {
    if (asset.freq === "Monthly") return sum + positive(asset.contrib) * 12;
    if (asset.freq === "Annually") return sum + positive(asset.contrib);
    return sum;
  }, 0);
  const projectedRetirementValue = retirementRow?.investmentValue ?? currentValue;
  const drawdownEnabled = visibleAssets.filter((asset) => asset.drawdown).length;
  const add = () => {
    const item = newInvestment(profile.assets.length);
    update({ assets: [...profile.assets, item] });
    setEditingId(item.id);
  };
  return (
    <section className="step-grid">
      <div className="step-grid__full">
        <DecisionPreview
          title="Portfolio Impact Preview"
          description="Shows the retirement-facing impact of the holdings entered here. Glidepath changes are managed under Life Events."
          items={[
            { label: "Current Investment Value", value: currency(currentValue), tone: currentValue > 0 ? "info" : "default" },
            { label: "Annual Contributions", value: currency(annualContributions), tone: annualContributions > 0 ? "bad" : "default" },
            { label: `Projected Value At Age ${retirementAge || "-"}`, value: currency(projectedRetirementValue), tone: "good" },
            { label: "Drawdown-Enabled Holdings", value: `${drawdownEnabled} / ${visibleAssets.length}`, tone: drawdownEnabled ? "good" : "default" }
          ]}
        />
      </div>
      <FieldCard title="Your Investments" description="Enter each holding once, then use Life Events for retirement glidepath changes.">
        {visibleAssets.length ? (
          <div className="grid gap-3">
            {visibleAssets.map((asset) => (
              <SummaryRow
                key={asset.id}
                title={asset.label || asset.type}
                meta={`${asset.type} - ${asset.ret || 0}% return - ${asset.freq} contributions`}
                value={currency(positive(asset.value))}
                extraAction={<Button variant="outline" size="sm" onClick={() => update({ assets: [...profile.assets, { ...asset, id: uid("investment"), label: asset.label ? `${asset.label} Copy` : "" }] })}>Duplicate</Button>}
                onEdit={() => setEditingId(asset.id)}
                onDelete={() => update({ assets: profile.assets.filter((row) => row.id !== asset.id) })}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No investments added yet" description="Add one investment to start projecting portfolio growth." />
        )}
        <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add Investment</Button>
      </FieldCard>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing?.label || "Investment Details"}</DialogTitle>
            <DialogDescription>Basics, recurring contributions, dividends, and retirement drawdown settings.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <InvestmentEditor
              asset={editing}
              profile={profile}
              update={(patch) => update({ assets: profile.assets.map((row) => (row.id === editing.id ? { ...row, ...patch } : row)) })}
              remove={() => {
                update({ assets: profile.assets.filter((row) => row.id !== editing.id) });
                setEditingId(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function newInvestment(index: number): InvestmentHolding {
  return { id: uid("investment"), label: "", type: "Funds / ETFs", value: "", ret: 6, contrib: "", freq: "None", contribStart: "", contribEnd: "", divEnabled: false, divYield: "", divTreat: "Take dividends as cash", drawdown: true, color: allocationColors[index % allocationColors.length] };
}

function InvestmentEditor({ asset, profile, update, remove }: { asset: InvestmentHolding; profile: SingaporePlannerProfile; update: (patch: Partial<InvestmentHolding>) => void; remove: () => void }) {
  const retirementAge = positive(profile.retirementAge) || positive(profile.endAge) || positive(profile.age);
  const retirementRow = projectSingaporeProfile(profile).find((row) => row.age >= retirementAge);
  const projectedAsset = retirementRow?.assets.find((item) => item.id === asset.id);
  const annualContribution = asset.freq === "Monthly" ? positive(asset.contrib) * 12 : asset.freq === "Annually" ? positive(asset.contrib) : 0;
  const annualDividend = positive(asset.value) * (asset.divEnabled ? toNumber(asset.divYield) / 100 : 0);
  return (
    <div className="rounded-lg border p-4">
      <DecisionPreview
        title="Investment Impact Preview"
        description="This is local to the investment being edited. The page preview above shows the portfolio-level impact."
        items={[
          { label: "Projected Value At Retirement", value: currency(projectedAsset?.projected ?? positive(asset.value)), tone: "info", note: `Age ${retirementAge || "-"}` },
          { label: "Annual Contribution", value: currency(annualContribution), tone: annualContribution > 0 ? "bad" : "default" },
          { label: "Current Annual Dividend", value: currency(annualDividend), tone: annualDividend > 0 ? "good" : "default" },
          { label: "Retirement Drawdown", value: asset.drawdown ? "Included" : "Excluded", tone: asset.drawdown ? "good" : "default" }
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextField label="Label" value={asset.label} onChange={(label) => update({ label })} />
        <SelectField label="Investment Type" value={asset.type} options={investmentTypes} onChange={(type) => update({ type, ret: investmentReturnDefaults[type] })} />
        <NumberField label="Current Value" value={asset.value} onChange={(value) => update({ value })} />
        <NumberField label="Expected Annual Return %" value={asset.ret} onChange={(ret) => update({ ret })} />
        <NumberField label="Contribution Amount" value={asset.contrib} onChange={(contrib) => update({ contrib })} />
        <SelectField label="Contribution Frequency" value={asset.freq} options={["None", "Monthly", "Annually"] as InvestmentFrequency[]} onChange={(freq) => update({ freq })} />
        <NumberField label="Contribution Start Age" value={asset.contribStart} onChange={(contribStart) => update({ contribStart })} />
        <NumberField label="Contribution Stop Age" value={asset.contribEnd} onChange={(contribEnd) => update({ contribEnd })} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ToggleRow label="Dividend Yield" checked={asset.divEnabled} onChange={(divEnabled) => update({ divEnabled })} />
        {asset.divEnabled ? <NumberField label="Dividend Yield %" value={asset.divYield} onChange={(divYield) => update({ divYield })} /> : null}
        {asset.divEnabled ? <ToggleRow label="Reinvest Dividends" checked={asset.divTreat === "Reinvest dividends"} onChange={(checked) => update({ divTreat: checked ? "Reinvest dividends" : "Take dividends as cash" })} /> : null}
        <ToggleRow label="Allow Retirement Drawdown" checked={asset.drawdown} onChange={(drawdown) => update({ drawdown })} />
      </div>
      <Button className="mt-4" variant="outline" onClick={remove}>Delete</Button>
    </div>
  );
}

function LifeEventsStep({ profile, update }: StepProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEmploymentId, setEditingEmploymentId] = useState<string | null>(null);
  const retirement = profile.events.find((event) => event.type === "Retirement");
  const editing = profile.events.find((event) => event.id === editingId);
  const editingEmployment = profile.employmentPeriods.find((period) => period.id === editingEmploymentId);
  const add = () => {
    const item: LifeEvent = { id: uid("event"), label: "", type: "Custom", age: profile.age, cost: "", incomeChange: "", expenseChange: "", zeroIncome: false };
    update({ events: [...profile.events, item] });
    setEditingId(item.id);
  };
  const addEmployment = () => {
    const item = newEmploymentPeriod(profile);
    update({ employmentPeriods: [...profile.employmentPeriods, item] });
    setEditingEmploymentId(item.id);
  };
  return (
    <section className="life-events-layout">
      <div className="life-events-layout__full">
        <FieldCard
          title="Employment Periods"
          description="Optional job timeline. If empty, Step 2 gross income continues until retirement. If filled, the active period replaces Step 2 income for that age so income is not double-counted."
        >
        {profile.employmentPeriods.length ? (
          <div className="grid gap-3">
            {profile.employmentPeriods.map((period) => (
              <SummaryRow
                key={period.id}
                title={period.label || "Employment Period"}
                meta={`Age ${period.startAge || "-"} to ${period.endAge || "-"} - ${period.annualGrowth || 0}% growth - ${period.cpfApplies ? "CPF applies" : "No CPF"}`}
                value={currency(positive(period.grossMonthlyIncome))}
                onEdit={() => setEditingEmploymentId(period.id)}
                onDelete={() => update({ employmentPeriods: profile.employmentPeriods.filter((row) => row.id !== period.id) })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No employment periods added"
            description="Your current Step 2 gross monthly income will be used until retirement. Add a period only for job changes, career breaks, or self-employed phases."
          />
        )}
          <Button variant="outline" onClick={addEmployment}><Plus className="h-4 w-4" /> Add Employment Period</Button>
        </FieldCard>
      </div>
      <FieldCard title="Your Goals and What-Ifs">
        <div className="grid gap-3">
          {profile.events.map((event) => (
            <SummaryRow
              key={event.id}
              title={event.label || event.type}
              meta={`${event.type} - Age ${event.age || "-"}`}
              value={event.zeroIncome ? "Income to zero" : currency(positive(event.cost) + Math.abs(toNumber(event.incomeChange) * 12) + Math.abs(toNumber(event.expenseChange) * 12))}
              onEdit={() => setEditingId(event.id)}
              onDelete={() => update({ events: profile.events.filter((row) => row.id !== event.id) })}
            />
          ))}
        </div>
        <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add Goal / What-If</Button>
      </FieldCard>
      {retirement ? (
        <FieldCard title="Retirement Portfolio Strategy" description="Glidepath decisions live here because they are easier to understand after retirement age is selected.">
          <GlidepathEditor profile={profile} update={update} />
        </FieldCard>
      ) : null}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing?.label || "Goal / What-If Details"}</DialogTitle>
            <DialogDescription>Use this to model life events, promotion, retirement, or one-off expenses.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <LifeEventEditor
              event={editing}
              profile={profile}
              update={(patch) => update({ events: profile.events.map((row) => (row.id === editing.id ? { ...row, ...patch } : row)) })}
              remove={() => {
                update({ events: profile.events.filter((row) => row.id !== editing.id) });
                setEditingId(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editingEmployment)} onOpenChange={(open) => !open && setEditingEmploymentId(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployment?.label || "Employment Period"}</DialogTitle>
            <DialogDescription>Use this to model job changes, career breaks, or CPF treatment without double-counting Step 2 income.</DialogDescription>
          </DialogHeader>
          {editingEmployment ? (
            <EmploymentPeriodEditor
              period={editingEmployment}
              profile={profile}
              update={(patch) => update({ employmentPeriods: profile.employmentPeriods.map((row) => (row.id === editingEmployment.id ? { ...row, ...patch } : row)) })}
              remove={() => {
                update({ employmentPeriods: profile.employmentPeriods.filter((row) => row.id !== editingEmployment.id) });
                setEditingEmploymentId(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function newEmploymentPeriod(profile: SingaporePlannerProfile): EmploymentPeriod {
  return {
    id: uid("employment"),
    label: "",
    startAge: profile.age,
    endAge: profile.retirementAge || 65,
    grossMonthlyIncome: monthlyIncome(profile) || "",
    annualGrowth: profile.incomeInf,
    cpfApplies: profile.cpf.status === "Employed"
  };
}

function EmploymentPeriodEditor({
  period,
  profile,
  update,
  remove
}: {
  period: EmploymentPeriod;
  profile: SingaporePlannerProfile;
  update: (patch: Partial<EmploymentPeriod>) => void;
  remove: () => void;
}) {
  const startAge = positive(period.startAge) || positive(profile.age);
  const endAge = positive(period.endAge) || positive(profile.retirementAge) || positive(profile.endAge);
  const growth = 1 + toNumber(period.annualGrowth) / 100;
  const firstYearIncome = positive(period.grossMonthlyIncome) * 12;
  const finalYearIncome = positive(period.grossMonthlyIncome) * growth ** Math.max(0, endAge - startAge) * 12;
  const overlaps = profile.employmentPeriods
    .filter((item) => item.id !== period.id)
    .some((item) => {
      const itemStart = positive(item.startAge) || positive(profile.age);
      const itemEnd = positive(item.endAge) || positive(profile.retirementAge) || positive(profile.endAge);
      return startAge <= itemEnd && endAge >= itemStart;
    });

  return (
    <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-4">
      <DecisionPreview
        title="Employment Timeline Preview"
        description="This period replaces the Step 2 gross income only during its age range. Leave this section empty if the current income should simply continue to retirement."
        items={[
          { label: "First-Year Gross Income", value: currency(firstYearIncome), tone: firstYearIncome > 0 ? "info" : "default" },
          { label: "Final-Year Gross Income", value: currency(finalYearIncome), tone: finalYearIncome > 0 ? "good" : "default" },
          { label: "CPF Treatment", value: period.cpfApplies ? "CPF Applies" : "No CPF", tone: period.cpfApplies ? "good" : "default" },
          { label: "Timeline Check", value: overlaps ? "Overlaps Another Period" : "No Overlap", tone: overlaps ? "bad" : "good" }
        ]}
      />
      <TextField label="Job / Period Label" value={period.label} onChange={(label) => update({ label })} />
      <NumberField label="Start Age" value={period.startAge} onChange={(startAge) => update({ startAge })} />
      <NumberField label="End Age" value={period.endAge} onChange={(endAge) => update({ endAge })} />
      <NumberField label="Gross Monthly Income" value={period.grossMonthlyIncome} onChange={(grossMonthlyIncome) => update({ grossMonthlyIncome })} />
      <NumberField label="Annual Income Growth %" value={period.annualGrowth} onChange={(annualGrowth) => update({ annualGrowth })} />
      <div className="md:col-span-2">
        <ToggleRow label="CPF Applies To This Period" checked={period.cpfApplies} onChange={(cpfApplies) => update({ cpfApplies })} />
      </div>
      <Button className="md:col-span-2 xl:col-span-4" variant="outline" onClick={remove}>Delete Employment Period</Button>
    </div>
  );
}

function monthlyIncomePreview(profile: SingaporePlannerProfile, age: number, excludeEventId?: string) {
  const currentAge = positive(profile.age);
  const growth = 1 + toNumber(profile.incomeInf) / 100;
  const base = monthlyIncome(profile) * growth ** Math.max(0, age - currentAge);
  const events = profile.events
    .filter((item) => item.id !== excludeEventId && age >= positive(item.age) && !item.zeroIncome)
    .reduce((total, item) => total + toNumber(item.incomeChange) * growth ** Math.max(0, age - currentAge), 0);
  const retired = profile.events.some((item) => item.id !== excludeEventId && item.type === "Retirement" && item.zeroIncome && age >= positive(item.age));
  return retired ? 0 : Math.max(0, base + events);
}

function monthlyExpensesPreview(profile: SingaporePlannerProfile, age: number, excludeEventId?: string) {
  const currentAge = positive(profile.age);
  const growth = 1 + toNumber(profile.expenseInf) / 100;
  const base = monthlyExpenses(profile) * growth ** Math.max(0, age - currentAge);
  const events = profile.events
    .filter((item) => item.id !== excludeEventId && age >= positive(item.age))
    .reduce((total, item) => total + toNumber(item.expenseChange) * growth ** Math.max(0, age - currentAge), 0);
  return Math.max(0, base + events);
}

function LifeEventEditor({ event, profile, update, remove }: { event: LifeEvent; profile: SingaporePlannerProfile; update: (patch: Partial<LifeEvent>) => void; remove: () => void }) {
  const isRetirement = event.type === "Retirement";
  const isHouse = event.type === "House";
  const eventAge = positive(event.age) || positive(profile.retirementAge) || positive(profile.age);
  const incomeGrowth = 1 + toNumber(profile.incomeInf) / 100;
  const expenseGrowth = 1 + toNumber(profile.expenseInf) / 100;
  const yearsFromToday = Math.max(0, eventAge - positive(profile.age));
  const beforeIncome = monthlyIncomePreview(profile, eventAge, event.id);
  const incomeDelta = toNumber(event.incomeChange) * incomeGrowth ** yearsFromToday;
  const afterIncome = event.zeroIncome ? 0 : Math.max(0, beforeIncome + incomeDelta);
  const beforeExpenses = monthlyExpensesPreview(profile, eventAge, event.id);
  const expenseDelta = toNumber(event.expenseChange) * expenseGrowth ** yearsFromToday;
  const afterExpenses = Math.max(0, beforeExpenses + expenseDelta);
  const housing = event.housing;
  const purchasePrice = positive(housing?.purchasePrice);
  const cpfDownpayment = Math.min(purchasePrice, positive(housing?.cpfOaDownpayment));
  const cashDownpayment = Math.min(Math.max(0, purchasePrice - cpfDownpayment), positive(housing?.cashDownpayment));
  const housingLoan = positive(housing?.loan) || Math.max(0, purchasePrice - cpfDownpayment - cashDownpayment);
  const purchaseMortgage = monthlyMortgage({ rate: housing?.rate ?? "", term: housing?.term ?? "" }, housingLoan, eventAge, eventAge);
  const availableCpfOa = positive(projectSingaporeProfile({ ...profile, events: profile.events.filter((item) => item.id !== event.id) }).find((row) => row.age === eventAge)?.cpf.oa);
  const estimatedCpfUpfront = Math.min(availableCpfOa, cpfDownpayment);
  const estimatedCashUpfront = Math.max(0, purchasePrice - housingLoan - estimatedCpfUpfront) + positive(event.cost);

  return (
    <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-4">
      <SelectField
        label="Type"
        value={event.type}
        options={["Custom", "Car", "House", "Wedding", "Child", "Pet", "Promotion", "Retirement"] as const}
        onChange={(type) => update(type === "Retirement"
          ? { ...retirementEvent(event.age), id: event.id }
          : type === "House"
            ? { type, label: event.label || "House Purchase", housing: event.housing ?? { purchasePrice: "", cashDownpayment: "", cpfOaDownpayment: "", loan: "", rate: 2.6, term: 25, appreciation: 2, annualPropertyTax: "", saleAge: "" } }
            : { type, housing: undefined })}
      />
      <TextField label="Label" value={event.label} onChange={(label) => update({ label })} />
      <NumberField label="Age" value={event.age} onChange={(age) => update({ age })} />
      <NumberField label={isHouse ? "Additional Purchase Costs" : "One-Time Cost"} value={event.cost} onChange={(cost) => update({ cost })} />
      {!isHouse && !event.zeroIncome ? <NumberField label="Monthly Income Change In Today's Dollars" value={event.incomeChange} onChange={(incomeChange) => update({ incomeChange })} /> : null}
      <NumberField label={isHouse ? "Other Monthly Housing Expense Change In Today's Dollars" : "Monthly Expense Change In Today's Dollars"} value={event.expenseChange} onChange={(expenseChange) => update({ expenseChange })} />
      {!isHouse ? <ToggleRow label="Set Active Income To Zero" checked={event.zeroIncome} onChange={(zeroIncome) => update({ zeroIncome, incomeChange: zeroIncome ? 0 : event.incomeChange })} /> : null}
      {isHouse && housing ? (
        <div className="retirement-preview">
          <div>
            <strong>Future Home Purchase</strong>
            <p>Amounts are applied at age {eventAge || "-"}. CPF OA is used for the planned upfront amount up to the projected available balance; any shortfall is funded from cash or other enabled drawdown sources.</p>
          </div>
          <div className="retirement-preview__grid">
            <MetricCard label="Purchase Price" value={currency(purchasePrice)} />
            <MetricCard label="Estimated CPF OA Upfront" value={currency(estimatedCpfUpfront)} tone="info" />
            <MetricCard label="Estimated Cash Upfront" value={currency(estimatedCashUpfront)} tone={estimatedCashUpfront > 0 ? "bad" : "default"} />
            <MetricCard label="Housing Loan" value={currency(housingLoan)} />
            <MetricCard label="Estimated Monthly Mortgage" value={currency(purchaseMortgage)} tone={purchaseMortgage > 0 ? "bad" : "default"} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NumberField label="Purchase Price" value={housing.purchasePrice} onChange={(purchasePrice) => update({ housing: { ...housing, purchasePrice } })} />
            <NumberField label="Cash Downpayment" value={housing.cashDownpayment} onChange={(cashDownpayment) => update({ housing: { ...housing, cashDownpayment } })} />
            <NumberField label="CPF OA Downpayment" value={housing.cpfOaDownpayment} onChange={(cpfOaDownpayment) => update({ housing: { ...housing, cpfOaDownpayment } })} />
            <NumberField label="Housing Loan (Auto If Blank)" value={housing.loan} onChange={(loan) => update({ housing: { ...housing, loan } })} />
            <NumberField label="Mortgage Rate %" value={housing.rate} onChange={(rate) => update({ housing: { ...housing, rate } })} />
            <NumberField label="Loan Term (Years)" value={housing.term} onChange={(term) => update({ housing: { ...housing, term } })} />
            <NumberField label="Annual Appreciation %" value={housing.appreciation} onChange={(appreciation) => update({ housing: { ...housing, appreciation } })} />
            <NumberField label="Annual Property Tax Payable" value={housing.annualPropertyTax} onChange={(annualPropertyTax) => update({ housing: { ...housing, annualPropertyTax } })} />
            <NumberField label="Optional Sale Age" value={housing.saleAge ?? ""} onChange={(saleAge) => update({ housing: { ...housing, saleAge } })} />
          </div>
          <p className="retirement-preview__hint">Additional purchase costs can include buyer's stamp duty, legal fees, renovation, and other cash costs. Ongoing mortgage payments use projected OA contributions first, with the remainder shown as cash outflow.</p>
        </div>
      ) : null}
      {isRetirement ? (
        <div className="retirement-preview">
          <div>
            <strong>Retirement Cash Flow Preview</strong>
            <p>Income and expense changes are entered in today's dollars, then inflated to age {eventAge || "-"} using your income and expense inflation assumptions.</p>
          </div>
          <div className="retirement-preview__grid">
            <MetricCard label="Projected Income Before Retirement Event" value={currency(beforeIncome)} />
            <MetricCard label="Active Income After Event" value={currency(afterIncome)} tone={afterIncome > 0 ? "info" : "bad"} />
            <MetricCard label="Projected Expenses Before Change" value={currency(beforeExpenses)} />
            <MetricCard label="Expense Change At Event Age" value={currency(expenseDelta)} tone={expenseDelta <= 0 ? "good" : "bad"} />
            <MetricCard label="Projected Expenses After Change" value={currency(afterExpenses)} tone="info" />
          </div>
          <p className="retirement-preview__hint">Tip: use a negative expense change if retirement reduces spending. CPF LIFE, dividends, SRS withdrawals, and drawdowns are handled separately in the projection.</p>
        </div>
      ) : null}
      <Button variant="outline" className="self-end" onClick={remove}>Delete</Button>
    </div>
  );
}

function GlidepathEditor({ profile, update }: StepProps) {
  const glide = profile.shifts[0];
  if (!glide) {
    return <Button variant="outline" onClick={() => update({ shifts: [{ id: uid("glide"), label: "Retirement Glidepath", age: profile.retirementAge, pct: 100, glideYears: 0, futureContrib: true, scope: "all", targetAlloc: { Bonds: 60, "Funds / ETFs": 25, "Cash holdings": 15 }, targetAssumptions: {} }] })}>Add Retirement Glidepath</Button>;
  }
  const patch = (next: Partial<typeof glide>) => update({ shifts: profile.shifts.map((row) => (row.id === glide.id ? { ...row, ...next } : row)) });
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <TextField label="Strategy Name" value={glide.label} onChange={(label) => patch({ label })} />
        <NumberField label="Re-Allocation Age" value={glide.age} onChange={(age) => patch({ age })} />
        <NumberField label="Amount To Re-Allocate %" value={glide.pct} onChange={(pct) => patch({ pct: Math.min(100, positive(pct)) })} />
        <NumberField label="Glidepath Duration" value={glide.glideYears} onChange={(glideYears) => patch({ glideYears: positive(glideYears) })} />
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {investmentTypes.map((type) => (
          <NumberField key={type} label={`${type} Target %`} value={glide.targetAlloc[type] ?? ""} onChange={(pct) => patch({ targetAlloc: { ...glide.targetAlloc, [type]: pct === "" ? 0 : positive(pct) } })} />
        ))}
      </div>
      <ToggleRow label="Future Contributions Follow This Allocation" checked={glide.futureContrib} onChange={(futureContrib) => patch({ futureContrib })} />
      <details className="glide-advanced rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">Advanced Return And Dividend Assumptions</summary>
        <div className="glide-assumption-list mt-4">
          {investmentTypes.map((type) => {
            const assumption = glide.targetAssumptions[type] ?? { ret: investmentReturnDefaults[type], divEnabled: false, divYield: "", divTreat: "Take dividends as cash", drawdown: true };
            const setAssumption = (next: Partial<typeof assumption>) => patch({ targetAssumptions: { ...glide.targetAssumptions, [type]: { ...assumption, ...next } } });
            return (
              <div className="glide-assumption-row rounded-md border p-3" key={type}>
                <strong className="self-center">{type}</strong>
                <NumberField label="Return %" value={assumption.ret} onChange={(ret) => setAssumption({ ret })} />
                <ToggleRow label="Dividend" checked={assumption.divEnabled} onChange={(divEnabled) => setAssumption({ divEnabled })} />
                {assumption.divEnabled ? <NumberField label="Dividend Yield %" value={assumption.divYield} onChange={(divYield) => setAssumption({ divYield })} /> : null}
                <ToggleRow label="Drawdown" checked={assumption.drawdown} onChange={(drawdown) => setAssumption({ drawdown })} />
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

type StepProps = {
  profile: SingaporePlannerProfile;
  update: (patch: Partial<SingaporePlannerProfile>) => void;
};

function cloneProfile(profile: SingaporePlannerProfile): SingaporePlannerProfile {
  return normalizeProfile(JSON.parse(JSON.stringify(profile)) as Partial<SingaporePlannerProfile>);
}

function scenarioProfile(profile: SingaporePlannerProfile, kind: "conservative" | "optimistic") {
  const next = cloneProfile(profile);
  const shift = kind === "conservative" ? -2 : 1.5;
  const inflationShift = kind === "conservative" ? 1 : -0.5;
  next.incomeInf = Math.max(0, next.incomeInf + (kind === "conservative" ? -1 : 0.5));
  next.expenseInf = Math.max(0, next.expenseInf + inflationShift);
  next.assets = next.assets.map((asset) => ({ ...asset, ret: Math.max(-20, toNumber(asset.ret) + shift) }));
  next.srs = { ...next.srs, expectedReturn: Math.max(-20, toNumber(next.srs.expectedReturn) + shift) };
  next.homes = next.homes.map((home) => ({ ...home, appreciation: Math.max(-10, toNumber(home.appreciation) + shift / 2) }));
  if (next.couple?.partner) {
    next.couple = {
      ...next.couple,
      partner: scenarioProfile(next.couple.partner, kind)
    };
  }
  return normalizeProfile(next);
}

function projectionRowsForProfile(profile: SingaporePlannerProfile) {
  return profile.planningMode === "Couple" ? householdProjectionRows(profile) : projectSingaporeProfile(profile);
}

function projectionNarrative(profile: SingaporePlannerProfile, rows: ProjectionYear[]) {
  const start = rows[0];
  const end = rows.at(-1);
  const retirementAge = positive(profile.retirementAge) || 65;
  const firstGap = rows.find((row) => row.age >= retirementAge && row.retirementCashFlowGap > 0);
  const firstShortfall = rows.find((row) => row.annualUnfundedShortfall > 0);
  const firstDeficit = rows.find((row) => row.netCashFlow < 0);
  const firstCpfLife = rows.find((row) => row.cpfLifeIncome > 0);
  return [
    end ? `Projected net worth moves from ${currency(start?.totalAssets ?? 0)} at age ${start?.age ?? "-"} to ${currency(end.totalAssets)} at age ${end.age}.` : "Projection is ready once profile details are entered.",
    firstDeficit ? `Annual nett cash flow first turns negative at age ${firstDeficit.age}.` : "Annual nett cash flow stays non-negative across the projection.",
    firstGap ? `Retirement cash-flow gap begins at age ${firstGap.age} before drawdown sources are applied.` : "No retirement cash-flow gap is projected after retirement.",
    firstShortfall ? `True unfunded shortfall appears from age ${firstShortfall.age}, after allowed drawdown sources are exhausted.` : "Allowed drawdown sources cover projected retirement shortfalls through the projection horizon.",
    firstCpfLife ? `CPF LIFE payouts start at age ${firstCpfLife.age} and are included as retirement income.` : "CPF LIFE payouts are not triggered within the current projection horizon."
  ];
}

function planningWarnings(profile: SingaporePlannerProfile, rows: ProjectionYear[]) {
  const warnings: string[] = [];
  const currentExpenses = monthlyExpenses(profile);
  const freeCashMonths = currentExpenses ? positive(profile.freeCash) / currentExpenses : 0;
  if (currentExpenses > 0 && freeCashMonths < 3) warnings.push(`Emergency cash is ${freeCashMonths.toFixed(1)} months; consider building toward at least 3-6 months.`);
  if (profile.homes.length && positive(profile.tax.propertyTaxAnnual) === 0) warnings.push("Housing assets were added but Annual Property Tax Payable is blank.");
  profile.assets.forEach((asset) => {
    if (positive(asset.contribEnd) > positive(profile.retirementAge || 0) && positive(profile.retirementAge)) warnings.push(`${asset.label || asset.type} contributions continue after retirement age.`);
  });
  profile.cars.forEach((car) => {
    if (positive(car.term) > positive(car.coeYearsLeft) && positive(car.coeYearsLeft)) warnings.push(`${car.label || "Car"} loan duration exceeds COE years left.`);
  });
  profile.employmentPeriods.forEach((period, index) => {
    if (positive(period.endAge) < positive(period.startAge)) warnings.push(`${period.label || `Employment period ${index + 1}`} ends before it starts.`);
  });
  const retirementAge = positive(profile.retirementAge) || 65;
  const firstGap = rows.find((row) => row.age >= retirementAge && row.retirementCashFlowGap > 0);
  if (firstGap) warnings.push(`Retirement cash-flow gap starts at age ${firstGap.age}; review income, expenses, or drawdown settings.`);
  return [...new Set(warnings)];
}

const assumptionSourceLinks = [
  ["CPF Contribution Rates 2026", "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf"],
  ["CPF Allocation Rates 2026", "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf"],
  ["CPF Contribution Rates 2027", "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfcontributionrates.pdf"],
  ["CPF Allocation Rates 2027", "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfallocationrates.pdf"],
  ["IRAS Individual Income Tax Rates", "https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-rates"],
  ["IRAS Reliefs And Rebates", "https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions"],
  ["IRAS Property Tax Rates", "https://www.iras.gov.sg/taxes/property-tax/property-owners/property-tax-rates"]
];

function AssumptionsSourcesContent() {
  return (
    <div className="grid gap-4 text-sm text-muted-foreground">
      <p>Projection assumptions use the values entered by the user. CPF uses official 2026 tables and published 2027 rate changes where applicable. MediShield subsidies are assumed at $0 unless changed in future modelling.</p>
      <div className="assumptions-source-grid">
        <div>
          <strong>CPF And CPF LIFE</strong>
          <span>CPF balances use the app's current CPF contribution, allocation, interest, retirement-sum, and CPF LIFE assumptions.</span>
        </div>
        <div>
          <strong>Tax And Reliefs</strong>
          <span>Resident tax is estimated from projected gross income less employee CPF, donations, SRS relief, selected reliefs capped at SGD 80,000, then less rebates.</span>
        </div>
        <div>
          <strong>Healthcare Premiums</strong>
          <span>MediShield Life and CareShield Life are estimates. Actual subsidies, loadings, and plan details should be checked with CPF e-services or the insurer.</span>
        </div>
        <div>
          <strong>Investments And Assets</strong>
          <span>Returns, dividend yields, inflation, property appreciation, loan rates, and depreciation are user assumptions unless a default was shown in the input step.</span>
        </div>
      </div>
      <div className="grid gap-2">
        {assumptionSourceLinks.map(([label, href]) => <a className="underline" key={href} href={href} target="_blank" rel="noreferrer">{label}</a>)}
      </div>
    </div>
  );
}

function SourcesDrawer() {
  return (
    <details className="sources-drawer rounded-lg border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">Assumptions & Sources</summary>
      <div className="mt-3">
        <AssumptionsSourcesContent />
      </div>
    </details>
  );
}

function AssumptionsSourcesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Assumptions & Sources</DialogTitle>
          <DialogDescription>A plain-English audit trail for the projection assumptions and Singapore references used in this app.</DialogDescription>
        </DialogHeader>
        <AssumptionsSourcesContent />
      </DialogContent>
    </Dialog>
  );
}

function ScenarioComparison({ profile }: { profile: SingaporePlannerProfile }) {
  const scenarios = [
    { label: "Base", profile, returnShift: "0.0%", incomeGrowthShift: "0.0%", expenseInflationShift: "0.0%" },
    { label: "Conservative", profile: scenarioProfile(profile, "conservative"), returnShift: "-2.0%", incomeGrowthShift: "-1.0%", expenseInflationShift: "+1.0%" },
    { label: "Optimistic", profile: scenarioProfile(profile, "optimistic"), returnShift: "+1.5%", incomeGrowthShift: "+0.5%", expenseInflationShift: "-0.5%" }
  ].map((scenario) => {
    const rows = projectionRowsForProfile(scenario.profile);
    const ending = rows.at(-1);
    const ready = retirementReadiness(scenario.profile, rows);
    const peak = rows.reduce((best, row) => (row.totalAssets > best.totalAssets ? row : best), rows[0]);
    return { ...scenario, ending, ready, peak };
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Comparison</CardTitle>
        <CardDescription>Shows how the ending net worth and retirement readiness move when return, inflation, and income-growth assumptions change.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="scenario-table">
          <div className="scenario-table__row scenario-table__head">
            <span>Scenario</span>
            <span>Return Shift</span>
            <span>Income Growth</span>
            <span>Expense Inflation</span>
            <span>Peak Net Worth</span>
            <span>Age {scenarios[0]?.ending?.age ?? profile.endAge}</span>
            <span>Readiness</span>
          </div>
          {scenarios.map((scenario) => (
            <div className="scenario-table__row" key={scenario.label}>
              <strong>{scenario.label}</strong>
              <span>{scenario.returnShift}</span>
              <span>{scenario.incomeGrowthShift}</span>
              <span>{scenario.expenseInflationShift}</span>
              <span>{scenario.peak ? `${currency(scenario.peak.totalAssets)} at ${scenario.peak.age}` : "-"}</span>
              <span>{currency(scenario.ending?.totalAssets ?? 0)}</span>
              <span className={scenario.ready.firstShortfall ? "text-destructive" : "text-success"}>{scenario.ready.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StressTestCard({ profile, rows, selected }: { profile: SingaporePlannerProfile; rows: ProjectionYear[]; selected: ProjectionYear }) {
  const [stressAge, setStressAge] = useState<number | "">(selected.age);
  const [marketDropPct, setMarketDropPct] = useState<number | "">(30);
  const [incomePauseMonths, setIncomePauseMonths] = useState<number | "">(6);
  const [extraExpensePct, setExtraExpensePct] = useState<number | "">(25);
  const [dragRatePct, setDragRatePct] = useState<number | "">(3);
  const age = positive(stressAge) || selected.age;
  const basePoint = rows.find((row) => row.age === age) ?? selected;
  const annualExpenses = basePoint.annualExpenses || monthlyExpenses(profile) * 12;
  const marketShock = basePoint.investmentValue * (positive(marketDropPct) / 100);
  const jobLossShock = (basePoint.activeIncome || monthlyIncome(profile) * 12) * (positive(incomePauseMonths) / 12);
  const expenseShock = annualExpenses * (positive(extraExpensePct) / 100);
  const immediateShock = marketShock + jobLossShock + expenseShock;
  const dragRate = positive(dragRatePct) / 100;
  const stressedRows = rows.map((row) => {
    if (row.age < age) return { ...row, stressedAssets: row.totalAssets, stressedCashFlow: row.netCashFlow };
    const drag = immediateShock * (1 + dragRate) ** Math.max(0, row.age - age);
    const oneYearCashDrag = row.age === age ? jobLossShock + expenseShock : 0;
    return {
      ...row,
      stressedAssets: row.totalAssets - drag,
      stressedCashFlow: row.netCashFlow - oneYearCashDrag
    };
  });
  const stressedPoint = stressedRows.find((row) => row.age === age);
  const stressedEnd = stressedRows.at(-1);
  const baseEnd = rows.at(-1);
  const firstStressedShortfall = stressedRows.find((row) => row.age >= (positive(profile.retirementAge) || 65) && row.stressedAssets < 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Projection Stress Test</CardTitle>
        <CardDescription>Apply a one-year shock at a chosen age, then carry its future drag through the remaining projection.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-5">
          <NumberField label="Stress Age" value={stressAge} onChange={setStressAge} />
          <NumberField label="Investment Drop %" value={marketDropPct} onChange={setMarketDropPct} />
          <NumberField label="Income Pause Months" value={incomePauseMonths} onChange={setIncomePauseMonths} />
          <NumberField label="Extra Expenses %" value={extraExpensePct} onChange={setExtraExpensePct} />
          <NumberField label="Future Drag Rate %" value={dragRatePct} onChange={setDragRatePct} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Market Shock" value={currency(marketShock)} tone="bad" />
        <MetricCard label="Income Disruption" value={currency(jobLossShock)} tone="bad" />
          <MetricCard label="Expense Shock" value={currency(expenseShock)} tone="bad" />
          <MetricCard label="Immediate Shock" value={currency(immediateShock)} tone="bad" />
        </div>
        <div className="scenario-table scenario-table--stress">
          <div className="scenario-table__row scenario-table__head">
            <span>Checkpoint</span>
            <span>Base Net Worth</span>
            <span>Stressed Net Worth</span>
            <span>Difference</span>
            <span>Cash Flow Impact</span>
          </div>
          <div className="scenario-table__row">
            <strong>Age {age}</strong>
            <span>{currency(basePoint.totalAssets)}</span>
            <span>{currency(stressedPoint?.stressedAssets ?? basePoint.totalAssets)}</span>
            <span className="text-destructive">{currency((stressedPoint?.stressedAssets ?? basePoint.totalAssets) - basePoint.totalAssets)}</span>
            <span className="text-destructive">{currency((stressedPoint?.stressedCashFlow ?? basePoint.netCashFlow) - basePoint.netCashFlow)}</span>
          </div>
          <div className="scenario-table__row">
            <strong>Age {baseEnd?.age ?? "-"}</strong>
            <span>{currency(baseEnd?.totalAssets ?? 0)}</span>
            <span>{currency(stressedEnd?.stressedAssets ?? 0)}</span>
            <span className="text-destructive">{currency((stressedEnd?.stressedAssets ?? 0) - (baseEnd?.totalAssets ?? 0))}</span>
            <span>{firstStressedShortfall ? `Shortfall risk from age ${firstStressedShortfall.age}` : "No negative stressed assets"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ProjectionChartDatum = {
  age: number;
  assets: number;
  income: number;
  outflow: number;
  cashflow: number;
};

function ProjectionCharts({
  chartData,
  selectedAge,
  onSelectAge,
  onOpenSnapshot
}: {
  chartData: ProjectionChartDatum[];
  selectedAge: number;
  onSelectAge: (age: number) => void;
  onOpenSnapshot: () => void;
}) {
  const { ref: chartContainerRef, width: chartContainerWidth } = useElementWidth<HTMLDivElement>();
  const isCompactChart = chartContainerWidth === 0 || chartContainerWidth < 1120;
  const windowSize = chartContainerWidth > 0 && chartContainerWidth < 520 ? 8 : chartContainerWidth < 760 ? 12 : 16;
  const [windowStart, setWindowStart] = useState(0);
  const maxStart = Math.max(0, chartData.length - windowSize);

  useEffect(() => {
    if (!isCompactChart) return;
    const selectedIndex = chartData.findIndex((point) => point.age === selectedAge);
    if (selectedIndex < 0) return;
    setWindowStart((current) => {
      if (selectedIndex < current) return Math.max(0, selectedIndex);
      if (selectedIndex >= current + windowSize) return Math.min(maxStart, Math.max(0, selectedIndex - windowSize + 1));
      return Math.min(current, maxStart);
    });
  }, [chartData, isCompactChart, maxStart, selectedAge, windowSize]);

  const visibleData = isCompactChart ? chartData.slice(windowStart, windowStart + windowSize) : chartData;
  const selectedPoint = chartData.find((point) => point.age === selectedAge) ?? visibleData[0];
  const visibleStartAge = visibleData[0]?.age;
  const visibleEndAge = visibleData.at(-1)?.age;
  const chartClick = (data: { activeLabel?: string | number; activePayload?: { payload?: { age?: number } }[] } | undefined) => {
    const age = Number(data?.activePayload?.[0]?.payload?.age ?? data?.activeLabel);
    if (!Number.isFinite(age)) return;
    onSelectAge(age);
    if (!isCompactChart) onOpenSnapshot();
  };

  return (
    <Card className="projection-chart-card">
      <CardHeader>
        <CardTitle>Projection</CardTitle>
        <CardDescription>Tap or click any age to inspect that year. Mobile shows a focused age range so the chart stays readable.</CardDescription>
      </CardHeader>
      <CardContent ref={chartContainerRef} className={`projection-chart-content grid gap-4 xl:grid-cols-2 ${isCompactChart ? "is-compact" : ""}`}>
        <div className="mobile-chart-window-controls">
          <Button variant="outline" size="sm" disabled={windowStart === 0} onClick={() => setWindowStart((start) => Math.max(0, start - windowSize))}>Earlier</Button>
          <span>{visibleStartAge && visibleEndAge ? `Age ${visibleStartAge}-${visibleEndAge}` : "Age range"}</span>
          <Button variant="outline" size="sm" disabled={windowStart >= maxStart} onClick={() => setWindowStart((start) => Math.min(maxStart, start + windowSize))}>Later</Button>
        </div>
        <div className="chart-panel-react">
          <h3>Net Worth By Age</h3>
          <div className="chart-scroll-lane" role="region" aria-label="Inspect net worth by age">
            <div className="chart-scroll-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={visibleData} margin={{ top: 10, right: 12, bottom: 16, left: 2 }} onClick={chartClick}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.14} />
                  <XAxis dataKey="age" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => compactCurrency(Number(value)).replace("SGD ", "")} tickLine={false} axisLine={false} width={isCompactChart ? 52 : 70} domain={[0, "dataMax"]} />
                  {!isCompactChart ? <Tooltip formatter={(value) => [currency(Number(value)), "Total Assets"]} labelFormatter={(label) => `Age ${label}`} /> : null}
                  <Bar dataKey="assets" name="Total Assets" fill="hsl(var(--ui-success))" radius={[5, 5, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="chart-panel-react">
          <h3>Cash Flow By Age</h3>
          <div className="chart-scroll-lane" role="region" aria-label="Inspect cash flow by age">
            <div className="chart-scroll-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={visibleData} margin={{ top: 10, right: 12, bottom: 16, left: 2 }} onClick={chartClick}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.14} />
                  <XAxis dataKey="age" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => compactCurrency(Number(value)).replace("SGD ", "")} tickLine={false} axisLine={false} width={isCompactChart ? 52 : 70} />
                  {!isCompactChart ? <Tooltip formatter={(value, name) => [currency(Number(value)), String(name)]} labelFormatter={(label) => `Age ${label}`} /> : null}
                  {!isCompactChart ? <Legend /> : null}
                  <Line dataKey="income" name="Total Income" stroke="hsl(var(--ui-info))" strokeWidth={2.4} dot={false} />
                  <Line dataKey="outflow" name="Total Outflow" stroke="hsl(var(--ui-destructive))" strokeWidth={2.4} dot={false} />
                  <Line dataKey="cashflow" name="Nett Cash Flow" stroke="hsl(var(--ui-success))" strokeWidth={2.4} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mobile-chart-legend" aria-label="Cash flow chart legend">
            <span><i className="legend-info" />Inflow</span>
            <span><i className="legend-bad" />Outflow</span>
            <span><i className="legend-good" />Nett</span>
          </div>
        </div>
        <div className="mobile-chart-year-summary">
          <div>
            <span>Selected Age</span>
            <strong>Age {selectedPoint?.age ?? selectedAge}</strong>
          </div>
          <div>
            <span>Net Worth</span>
            <strong className="text-success">{compactCurrency(selectedPoint?.assets ?? 0)}</strong>
          </div>
          <div>
            <span>Nett Cash Flow</span>
            <strong className={(selectedPoint?.cashflow ?? 0) >= 0 ? "text-success" : "text-destructive"}>{compactCurrency(selectedPoint?.cashflow ?? 0)}</strong>
          </div>
          <Button onClick={onOpenSnapshot}>Open Snapshot</Button>
        </div>
        <p className="chart-mobile-hint">Use Earlier / Later to move through age ranges. Tap a bar or line point to update the selected year.</p>
      </CardContent>
    </Card>
  );
}

function ProjectionDashboard({
  profile,
  rows,
  selected,
  onSelectAge,
  onOpenSnapshot,
  onPropertyNetWorthChange
}: {
  profile: SingaporePlannerProfile;
  rows: ProjectionYear[];
  selected: ProjectionYear;
  onSelectAge: (age: number) => void;
  onOpenSnapshot: () => void;
  onPropertyNetWorthChange: (checked: boolean) => void;
}) {
  const readiness = retirementReadiness(profile, rows);
  const chartData = rows.map((row) => ({ age: row.age, assets: Math.round(row.totalAssets), income: Math.round(row.annualIncome), outflow: Math.round(row.annualCashOutflows), cashflow: Math.round(row.netCashFlow) }));
  const firstDeficit = rows.find((row) => row.retirementCashFlowGap > 0);
  const firstCpfLife = rows.find((row) => row.cpfLifeIncome > 0);
  const ending = rows.at(-1) ?? selected;
  const selectedMonthlyOutflow = selected.annualCashOutflows / 12;
  const freeCashRatio = selectedMonthlyOutflow > 0 ? selected.freeCash / selectedMonthlyOutflow : 0;
  const totalInflow = selected.annualIncome + selected.annualDividendIncome;
  const narrative = projectionNarrative(profile, rows);
  return (
    <section className="projection-dashboard grid gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Property In Net Worth</p>
            <p className="text-sm text-muted-foreground">
              {profile.includePropertyInNetWorth ? "Housing equity is included in the net-worth figures below." : "Housing is tracked separately and excluded from net worth."}
            </p>
          </div>
          <Switch
            aria-label="Include property equity in net worth"
            checked={profile.includePropertyInNetWorth}
            onCheckedChange={onPropertyNetWorthChange}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net Worth" value={currency(selected.totalAssets)} compactValue={compactCurrency(selected.totalAssets)} note={`At Age ${selected.age}`} tone="good" />
        <MetricCard label="Total Inflow" value={currency(totalInflow)} compactValue={compactCurrency(totalInflow)} note="Income, CPF LIFE, SRS withdrawals, and dividends" tone="info" />
        <MetricCard label="Total Outflow" value={currency(selected.annualCashOutflows)} compactValue={compactCurrency(selected.annualCashOutflows)} note="Expenses, tax, CPF, insurance, loans, events, and investments" tone="bad" />
        <MetricCard
          label="Free Cash Ratio"
          value={`${freeCashRatio.toFixed(1)}x`}
          note={`Free cash / average monthly outflow at age ${selected.age}`}
          tone={freeCashRatio >= 6 ? "good" : freeCashRatio >= 3 ? "info" : "bad"}
        />
      </div>
      <ProjectionCharts chartData={chartData} selectedAge={selected.age} onSelectAge={onSelectAge} onOpenSnapshot={onOpenSnapshot} />
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Retirement Cash Flow Gap</p>
            <strong className="mt-1 block text-lg tabular-nums">{currency(readiness.totalGap)}</strong>
            <small className="text-muted-foreground">Total annual gaps from age {readiness.retirementAge} onward.</small>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Drawdown Used</p>
            <strong className="mt-1 block text-lg tabular-nums text-info">{currency(readiness.totalDrawdown)}</strong>
            <small className="text-muted-foreground">Free cash, investments, SRS, other assets, and CPF OA.</small>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">True Unfunded Shortfall</p>
            <strong className={`mt-1 block text-lg tabular-nums ${readiness.totalShortfall > 0 ? "text-destructive" : "text-success"}`}>{currency(readiness.totalShortfall)}</strong>
            <small className="text-muted-foreground">Only appears after allowed drawdown sources run out.</small>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Note Worthy Pointers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {narrative.map((line) => <p className="text-sm text-muted-foreground" key={line}>{line}</p>)}
        </CardContent>
      </Card>
      <ScenarioComparison profile={profile} />
      <StressTestCard profile={profile} rows={rows} selected={selected} />
      <SourcesDrawer />
      <div className="projection-insights">
        <div>
          <span>Cash Flow Pressure</span>
          <strong>{firstDeficit ? `Gap starts at age ${firstDeficit.age}` : "No retirement gap projected"}</strong>
        </div>
        <div>
          <span>CPF LIFE</span>
          <strong>{firstCpfLife ? `Payout starts at age ${firstCpfLife.age}` : "No payout projected yet"}</strong>
        </div>
        <div>
          <span>Age {ending.age} Net Worth</span>
          <strong>{currency(ending.totalAssets)}</strong>
        </div>
      </div>
    </section>
  );
}

type ProjectionDataPreset =
  | "overview"
  | "cashflow"
  | "cpf"
  | "assets"
  | "investments"
  | "insurance"
  | "housingLoans"
  | "tax"
  | "srs"
  | "events"
  | "retirement"
  | "assumptions"
  | "cpfSums";
type ProjectionDataCell = { label: string; value: number | string; format?: "currency" | "percent" | "number" | "text" };

const projectionDataPresetLabels: Record<ProjectionDataPreset, string> = {
  overview: "Overview",
  cashflow: "Cash Flow",
  cpf: "CPF",
  assets: "Assets",
  investments: "Investments",
  insurance: "Insurance",
  housingLoans: "Housing & Loans",
  tax: "Tax",
  srs: "SRS",
  events: "Life Events",
  retirement: "Retirement",
  assumptions: "Assumptions",
  cpfSums: "CPF LIFE Sums"
};

function weightedInvestmentRate(row: ProjectionYear, key: "ret" | "divYield") {
  const holdings = row.assets.filter((asset) => asset.projected > 0);
  const total = holdings.reduce((sum, asset) => sum + asset.projected, 0);
  if (!total) return 0;
  return holdings.reduce((sum, asset) => sum + asset.projected * toNumber(asset[key]), 0) / total;
}

function policyDataLabel(policy: InsurancePolicy) {
  return policy.name || `${policy.insurer || "Policy"} ${policy.type}`.trim();
}

function investmentDataCells(row: ProjectionYear, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  const cells: ProjectionDataCell[] = [
    { label: "Total Investment Value", value: row.investmentValue },
    { label: "Annual Contributions", value: row.annualInvestmentContributions },
    { label: "Dividend Income", value: row.annualDividendIncome },
    { label: "Dividends Paid Out", value: row.annualDividendsPaidOut },
    { label: "Investment Drawdown", value: row.annualDrawdown },
    { label: "Weighted Return", value: weightedInvestmentRate(row, "ret"), format: "percent" },
    { label: "Weighted Dividend Yield", value: weightedInvestmentRate(row, "divYield"), format: "percent" }
  ];
  profile.assets.forEach((asset) => {
    const projected = row.assets.find((item) => item.id === asset.id);
    const label = asset.label || asset.type;
    cells.push({ label: `${label} Value`, value: projected?.projected ?? 0 });
    cells.push({ label: `${label} Contribution`, value: projected?.yearContribution ?? 0 });
    cells.push({ label: `${label} Dividend`, value: projected?.yearDividend ?? 0 });
    cells.push({ label: `${label} Return Assumption`, value: toNumber(asset.ret), format: "percent" });
    cells.push({ label: `${label} Dividend Yield`, value: asset.divEnabled ? toNumber(asset.divYield) : 0, format: "percent" });
  });
  return cells;
}

function insuranceDataCells(row: ProjectionYear, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  const cells: ProjectionDataCell[] = [
    { label: "Total Insurance Premiums", value: row.annualInsurancePremiums },
    { label: "Cash Premiums", value: protectionAtAge(profile, row.age).cashPremiums },
    { label: "MediSave Premiums", value: row.annualInsuranceMedisavePremiums },
    { label: "CareShield Premiums", value: row.annualCareShieldPremiums },
    { label: "MediShield Premiums", value: row.annualMediShieldPremiums },
    { label: "MediShield Base Premium", value: row.annualMediShieldBasePremium },
    { label: "MediShield Subsidy", value: row.annualMediShieldSubsidy },
    { label: "MediShield Loading", value: row.annualMediShieldAdditionalPremium }
  ];
  profile.protection.policies.forEach((policy) => {
    const active = policyPremiumActive(profile, policy, row.age);
    const premium = active ? policyPremiumAtSnapshot(policy, row.age) : { cash: 0, medisave: 0, total: 0 };
    const label = policyDataLabel(policy);
    cells.push({ label: `${label} Cash`, value: premium.cash });
    cells.push({ label: `${label} MediSave`, value: premium.medisave });
    cells.push({ label: `${label} Total`, value: premium.total });
  });
  return cells;
}

function housingLoanDataCells(row: ProjectionYear, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  const cells: ProjectionDataCell[] = [
    { label: "Housing Value", value: row.housingValue },
    { label: "Housing Debt", value: row.housingDebt },
    { label: "Housing Equity", value: row.housingEquity },
    { label: "Car Value", value: row.carValue },
    { label: "Car Debt", value: row.carDebt },
    { label: "Car Equity", value: row.carEquity },
    { label: "Other Asset Value", value: row.customValue },
    { label: "Other Asset Debt", value: row.customDebt },
    { label: "Other Asset Equity", value: row.customEquity },
    { label: "Mortgage From Cash", value: row.annualMortgageCash },
    { label: "Mortgage From CPF OA", value: row.annualMortgageCpf },
    { label: "Home Purchase From Cash", value: row.annualHomePurchaseCash },
    { label: "Home Purchase From CPF OA", value: row.annualHomePurchaseCpf },
    { label: "Car Loan Cash", value: row.annualCarLoanCash },
    { label: "Car Running Expenses", value: row.annualCarExpenses }
  ];
  row.homes.forEach((projected) => {
    const asset = projected.item;
    const label = asset.label || "Property";
    cells.push({ label: `${label} Value`, value: projected?.projected ?? 0 });
    cells.push({ label: `${label} Loan`, value: projected?.loan ?? 0 });
    cells.push({ label: `${label} Equity`, value: projected?.equity ?? 0 });
    cells.push({ label: `${label} Monthly Mortgage`, value: projected?.monthlyMortgage ?? 0 });
  });
  profile.cars.forEach((asset) => {
    const projected = row.cars.find((item) => item.item.id === asset.id);
    const label = asset.label || "Car";
    cells.push({ label: `${label} Value`, value: projected?.projected ?? 0 });
    cells.push({ label: `${label} Loan`, value: projected?.loan ?? 0 });
    cells.push({ label: `${label} Equity`, value: projected?.equity ?? 0 });
  });
  profile.customAssets.forEach((asset) => {
    const projected = row.customAssets.find((item) => item.item.id === asset.id);
    const label = asset.label || "Other Asset";
    cells.push({ label: `${label} Value`, value: projected?.projected ?? 0 });
    cells.push({ label: `${label} Liability`, value: projected?.liability ?? 0 });
    cells.push({ label: `${label} Equity`, value: projected?.equity ?? 0 });
  });
  return cells;
}

function taxDataCells(row: ProjectionYear, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  const employeeCpfRelief = cpfContribution(profile, row.age, row.activeIncome).employee;
  const donationRelief = positive(profile.tax.donations) * 2.5;
  const srsRelief = srsContributionAtAge(profile, row.age);
  const otherReliefs = positive(profile.tax.otherReliefs) + taxReliefSelectionsTotal(profile);
  const reliefBeforeCap = employeeCpfRelief + donationRelief + srsRelief + otherReliefs;
  const reliefApplied = Math.min(80_000, reliefBeforeCap);
  const estimatedChargeable = Math.max(0, row.activeIncome + row.annualSrsWithdrawal - reliefApplied);
  return [
    { label: "Gross Active Income", value: row.activeIncome },
    { label: "Employee CPF Relief", value: employeeCpfRelief },
    { label: "Donation Relief", value: donationRelief },
    { label: "SRS Relief", value: srsRelief },
    { label: "Other / Selected Reliefs", value: otherReliefs },
    { label: "Relief Before Cap", value: reliefBeforeCap },
    { label: "Relief Applied", value: reliefApplied },
    { label: "Estimated Chargeable Income", value: estimatedChargeable },
    { label: "Tax Rebates", value: positive(profile.tax.rebates) + taxRebateSelectionsTotal(profile) },
    { label: "Income Tax Payable", value: row.annualIncomeTax },
    { label: "Property Tax", value: positive(profile.tax.propertyTaxAnnual) }
  ];
}

function srsDataCells(row: ProjectionYear, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  return [
    { label: "SRS Enabled", value: profile.srs.enabled ? "Yes" : "No", format: "text" },
    { label: "SRS Balance", value: row.srsBalance },
    { label: "SRS Contribution", value: row.annualSrsContribution },
    { label: "SRS Contribution Relief", value: srsContributionAtAge(profile, row.age) },
    { label: "SRS Withdrawal", value: row.annualSrsWithdrawal },
    { label: "SRS Deficit Drawdown", value: row.annualSrsDeficitDrawdown },
    { label: "SRS Return Assumption", value: toNumber(profile.srs.expectedReturn), format: "percent" },
    { label: "SRS Drawdown Allowed", value: profile.srs.drawdown ? "Yes" : "No", format: "text" }
  ];
}

function eventDataCells(row: ProjectionYear, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  const cells: ProjectionDataCell[] = [
    { label: "Life Event Costs", value: row.annualLifeEventCosts },
    { label: "Home Purchase From Cash", value: row.annualHomePurchaseCash },
    { label: "Home Purchase From CPF OA", value: row.annualHomePurchaseCpf },
    { label: "Home Sale Cash Proceeds", value: row.annualHomeSaleCash },
    { label: "Home Sale CPF OA Refund", value: row.annualHomeSaleCpfRefund },
    { label: "Triggered Events", value: row.triggeredLifeEvents.map((event) => event.label || event.type).join(", ") || "-", format: "text" }
  ];
  profile.events.forEach((event) => {
    const active = positive(event.age) === row.age;
    const label = event.label || event.type;
    cells.push({ label: `${label} Cost`, value: active ? positive(event.cost) : 0 });
    cells.push({ label: `${label} Monthly Income Change`, value: active ? positive(event.incomeChange) : 0 });
    cells.push({ label: `${label} Monthly Expense Change`, value: active ? positive(event.expenseChange) : 0 });
    cells.push({ label: `${label} Zero Income`, value: active && event.zeroIncome ? "Yes" : "No", format: "text" });
    if (event.type === "House" && event.housing) {
      cells.push({ label: `${label} Purchase Price`, value: active ? positive(event.housing.purchasePrice) : 0 });
      cells.push({ label: `${label} Housing Loan`, value: active ? (positive(event.housing.loan) || Math.max(0, positive(event.housing.purchasePrice) - positive(event.housing.cashDownpayment) - positive(event.housing.cpfOaDownpayment))) : 0 });
      cells.push({ label: `${label} Mortgage Rate`, value: toNumber(event.housing.rate), format: "percent" });
    }
  });
  profile.shifts.forEach((shift) => {
    const active = positive(shift.age) === row.age;
    cells.push({ label: `${shift.label || "Retirement Glidepath"} Triggered`, value: active ? "Yes" : "No", format: "text" });
    cells.push({ label: `${shift.label || "Retirement Glidepath"} Reallocation`, value: active ? shift.pct : 0, format: "percent" });
  });
  return cells;
}

function projectionDataCells(row: ProjectionYear, preset: ProjectionDataPreset, profile: SingaporePlannerProfile): ProjectionDataCell[] {
  if (preset === "cashflow") {
    return [
      { label: "Active Income", value: row.activeIncome },
      { label: "CPF LIFE", value: row.cpfLifeIncome },
      { label: "Dividends", value: row.annualDividendIncome },
      { label: "SRS Withdrawal", value: row.annualSrsWithdrawal },
      { label: "Living Expenses", value: row.annualExpenses },
      { label: "Insurance", value: row.annualInsurancePremiums },
      { label: "Income Tax", value: row.annualIncomeTax },
      { label: "Nett Cash Flow", value: row.netCashFlow }
    ];
  }
  if (preset === "cpf") {
    return [
      { label: "CPF OA", value: row.cpf.oa },
      { label: "CPF SA", value: row.cpf.sa },
      { label: "CPF RA", value: row.cpf.ra },
      { label: "CPF LIFE / RA Reserve", value: row.cpfLifeReserve },
      { label: "CPF MA", value: row.cpf.ma },
      { label: "Employee CPF", value: row.employeeCpfContribution },
      { label: "Employer CPF", value: row.employerCpfContribution },
      { label: "CPF Total", value: row.cpfTotal }
    ];
  }
  if (preset === "assets") {
    return [
      { label: "Investments", value: row.investmentValue },
      { label: "Housing Equity", value: row.housingEquity },
      { label: "Car Equity", value: row.carEquity },
      { label: "Other Asset Equity", value: row.customEquity },
      { label: "SRS", value: row.srsBalance },
      { label: "Free Cash", value: row.freeCash },
      { label: "Net Worth", value: row.totalAssets }
    ];
  }
  if (preset === "investments") return investmentDataCells(row, profile);
  if (preset === "insurance") return insuranceDataCells(row, profile);
  if (preset === "housingLoans") return housingLoanDataCells(row, profile);
  if (preset === "tax") return taxDataCells(row, profile);
  if (preset === "srs") return srsDataCells(row, profile);
  if (preset === "events") return eventDataCells(row, profile);
  if (preset === "retirement") {
    return [
      { label: "Cash Flow Gap", value: row.retirementCashFlowGap },
      { label: "Free Cash Drawdown", value: row.annualFreeCashDrawdown },
      { label: "Investment Drawdown", value: row.annualDrawdown },
      { label: "SRS Drawdown", value: row.annualSrsDeficitDrawdown },
      { label: "Other Asset Drawdown", value: row.annualOtherAssetDrawdown },
      { label: "CPF OA Drawdown", value: row.annualCpfDeficitDrawdown },
      { label: "Unfunded Shortfall", value: row.annualUnfundedShortfall }
    ];
  }
  if (preset === "assumptions") {
    const cpfLifeStarted = row.cpfLifeIncome > 0;
    return [
      { label: "CPF OA Interest", value: 2.5, format: "percent" },
      { label: "CPF SA Interest", value: 4, format: "percent" },
      { label: "CPF MA Interest", value: 4, format: "percent" },
      { label: "CPF RA Interest", value: cpfLifeStarted && profile.cpf.lifePlan !== "Basic" ? 0 : 4, format: "percent" },
      { label: "Extra CPF Interest", value: row.age < 55 ? "Extra 1% on first 60K" : "Extra 2% first 30K, +1% next 30K", format: "text" },
      { label: "Weighted Investment Return", value: weightedInvestmentRate(row, "ret"), format: "percent" },
      { label: "Weighted Dividend Yield", value: weightedInvestmentRate(row, "divYield"), format: "percent" },
      { label: "Dividend Income", value: row.annualDividendIncome }
    ];
  }
  if (preset === "cpfSums") {
    const calendarYear = projectionYear(profile, row.age);
    const sums = retirementSumsForYear(calendarYear);
    const age55Year = projectionYear(profile, 55);
    return [
      { label: "Basic Retirement Sum", value: sums.brs },
      { label: "Full Retirement Sum", value: sums.frs },
      { label: "Enhanced Retirement Sum", value: sums.ers },
      { label: "Age 55 Marker", value: row.age === 55 ? "RA Formation Year" : calendarYear < age55Year ? `Before RA formation (${age55Year})` : "After RA formation", format: "text" },
      { label: "Selected CPF LIFE Sum", value: profile.cpf.lifeSum, format: "text" },
      { label: "CPF LIFE Plan", value: profile.cpf.lifePlan, format: "text" },
      { label: "Projected CPF RA", value: row.cpf.ra },
      { label: "CPF LIFE / RA Reserve", value: row.cpfLifeReserve }
    ];
  }
  return [
    { label: "Net Worth", value: row.totalAssets },
    { label: "Total Income", value: row.annualIncome },
    { label: "Total Outflow", value: row.annualCashOutflows },
    { label: "Nett Cash Flow", value: row.netCashFlow },
    { label: "CPF Total", value: row.cpfTotal },
    { label: "Investments", value: row.investmentValue },
    { label: "Free Cash", value: row.freeCash },
    { label: "Unfunded Shortfall", value: row.annualUnfundedShortfall }
  ];
}

const projectionDataHelperNotes: Record<ProjectionDataPreset, string> = {
  overview: "Balances are projected end-of-year values. Income and outflows are annual totals for that age.",
  cashflow: "Income and expenses are annual figures after inflation, life events, CPF LIFE, SRS withdrawals, and dividends.",
  cpf: "CPF balances are projected end-of-year balances after contributions, deductions, interest, and CPF LIFE movements.",
  assets: "Asset values, liabilities, and net worth are projected end-of-year balances.",
  investments: "Investment values are projected end-of-year balances. Contributions, dividends, and drawdowns are annual figures.",
  insurance: "Premiums are annual outflows. Cash premiums affect cash flow; MediSave premiums reduce CPF MA where applicable.",
  housingLoans: "Asset values, debt, and equity are projected end-of-year values. Mortgage and loan figures are annual payments.",
  tax: "Tax is estimated using projected annual income, CPF relief, SRS relief, donations, selected reliefs, and rebates.",
  srs: "SRS balance is projected end-of-year. Contributions, reliefs, withdrawals, and drawdowns are annual figures.",
  events: "Events are shown in the age they trigger. Recurring income or expense changes affect following years.",
  retirement: "Retirement gaps are annual shortfalls after income, outflows, and selected drawdown sources.",
  assumptions: "Rates shown are the assumptions used for that year's projection. CPF rates are displayed for transparency.",
  cpfSums: "BRS, FRS, and ERS are shown by calendar year. The age-55 year is the key year for RA formation."
};

function formatProjectionDataCell(cell: ProjectionDataCell) {
  if (cell.format === "text") return String(cell.value);
  if (cell.format === "percent") return `${Number(cell.value).toFixed(Number(cell.value) % 1 === 0 ? 0 : 2)}%`;
  if (cell.format === "number") return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 2 }).format(Number(cell.value));
  return currency(Number(cell.value));
}

function ProjectionDataDialog({ profile, rows, open, onOpenChange }: { profile: SingaporePlannerProfile; rows: ProjectionYear[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [preset, setPreset] = useState<ProjectionDataPreset>("overview");
  const [query, setQuery] = useState("");
  const [nonZeroOnly, setNonZeroOnly] = useState(false);
  const headers = rows[0] ? projectionDataCells(rows[0], preset, profile).map((cell) => cell.label) : [];
  const displayHeaders = headers.filter((header) => {
    const matches = !query.trim() || header.toLowerCase().includes(query.trim().toLowerCase());
    if (!matches) return false;
    if (!nonZeroOnly) return true;
    return rows.some((row) => {
      const cell = projectionDataCells(row, preset, profile).find((item) => item.label === header);
      return typeof cell?.value === "number" ? Math.abs(cell.value) > 0.5 : Boolean(cell?.value && cell.value !== "-" && cell.value !== "No");
    });
  });
  const filteredCells = (row: ProjectionYear) => projectionDataCells(row, preset, profile).filter((cell) => displayHeaders.includes(cell.label));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="projection-data-dialog max-h-[92vh] max-w-7xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Year-By-Year Projection Data</DialogTitle>
          <DialogDescription>Review the full projection by age without crowding the main chart view.</DialogDescription>
        </DialogHeader>
        <div className="projection-data-sticky">
          <Tabs value={preset} onValueChange={(value) => setPreset(value as ProjectionDataPreset)} className="projection-data-tabs">
            <TabsList>
              {(Object.keys(projectionDataPresetLabels) as ProjectionDataPreset[]).map((key) => (
                <TabsTrigger key={key} value={key}>{projectionDataPresetLabels[key]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="projection-data-toolbar">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fields in this tab" aria-label="Search year-by-year fields" />
            <ToggleRow label="Hide Zero Values" checked={nonZeroOnly} onChange={setNonZeroOnly} />
          </div>
          <p className="projection-data-note">{projectionDataHelperNotes[preset]}</p>
        </div>
        <div className="projection-data-table-wrap">
          <table className="projection-data-table">
            <thead>
              <tr>
                <th>Age</th>
                <th>Calendar Year</th>
                {displayHeaders.map((header) => <th key={header}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${preset}-${row.age}`}>
                  <th scope="row">{row.age}</th>
                  <td>{projectionYear(profile, row.age)}</td>
                  {filteredCells(row).map((cell) => (
                    <td key={cell.label} className={typeof cell.value === "number" && cell.value < 0 ? "is-negative" : ""}>{formatProjectionDataCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="projection-data-cards">
          {rows.map((row) => (
            <details key={`${preset}-card-${row.age}`} className="projection-data-card">
              <summary>
                <span>Age {row.age}</span>
                <strong>{currency(row.totalAssets)}</strong>
              </summary>
              <div className="projection-data-card__body">
                <div><span>Calendar Year</span><strong>{projectionYear(profile, row.age)}</strong></div>
                {filteredCells(row).map((cell) => (
                  <div key={cell.label}>
                    <span>{cell.label}</span>
                    <strong className={typeof cell.value === "number" && cell.value < 0 ? "is-negative" : ""}>{formatProjectionDataCell(cell)}</strong>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function YearSnapshot({
  profile,
  point,
  previous,
  open,
  onOpenChange,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext
}: {
  profile: SingaporePlannerProfile;
  point: ProjectionYear;
  previous?: ProjectionYear;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  const delta = (current: number, last?: number) => (previous ? `${current - (last ?? 0) >= 0 ? "+" : ""}${currency(current - (last ?? 0))}` : "Entry year");
  const livingRows = livingExpenseBreakdown(profile, point.age);
  const insuranceRows = insurancePremiumBreakdown(profile, point);
  const showLivingBreakdown = profile.expenseMode === "breakdown" && livingRows.length > 0;
  const showInsuranceBreakdown = insuranceRows.length > 0 && point.annualInsurancePremiums > 0;
  const slices = [
    { name: "Investments", value: point.investmentValue },
    ...(profile.includePropertyInNetWorth ? [{ name: "Housing", value: point.housingEquity }] : []),
    { name: "Cars", value: point.carEquity },
    { name: "Other Assets", value: point.customEquity },
    { name: "SRS", value: point.srsBalance },
    { name: "CPF", value: point.cpfTotal },
    { name: "Free Cash", value: point.freeCash }
  ].filter((item) => item.value > 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-auto">
        <div className="snapshot-dialog-header">
          <DialogHeader>
            <DialogTitle>Year Snapshot: Age {point.age}</DialogTitle>
            <DialogDescription>A concise overview first, with detailed values below.</DialogDescription>
          </DialogHeader>
          <div className="snapshot-year-controls" aria-label="Year snapshot navigation">
            <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={onPrevious}>Previous Year</Button>
            <span className="snapshot-year-controls__age">Age {point.age}</span>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>Next Year</Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Net Worth" value={currency(point.totalAssets)} note={delta(point.totalAssets, previous?.totalAssets)} tone="good" />
              <MetricCard label="Total Income" value={currency(point.annualIncome)} note={delta(point.annualIncome, previous?.annualIncome)} tone="info" />
              <MetricCard label="Total Outflow" value={currency(point.annualCashOutflows)} note={delta(point.annualCashOutflows, previous?.annualCashOutflows)} tone="bad" />
              <MetricCard label="Nett Cash Flow" value={currency(point.netCashFlow)} note={delta(point.netCashFlow, previous?.netCashFlow)} tone={point.netCashFlow >= 0 ? "good" : "bad"} />
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">What Changed This Year</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {point.triggeredLifeEvents.length
                    ? point.triggeredLifeEvents.map((event) => `${event.label || event.type} at age ${event.age}`).join(", ")
                    : point.annualHomeSaleCash || point.annualHomeSaleCpfRefund
                      ? `Property sale proceeds were modelled: ${currency(point.annualHomeSaleCash)} to free cash and ${currency(point.annualHomeSaleCpfRefund)} refunded to CPF OA.`
                    : point.annualFreeCashDrawdown || point.annualDrawdown || point.annualSrsDeficitDrawdown || point.annualOtherAssetDrawdown || point.annualCpfDeficitDrawdown
                      ? "Deficit funding was triggered through free cash, investment, SRS, other asset, or CPF OA drawdown."
                      : "No major life events or drawdowns triggered this year."}
                </p>
              </CardContent>
            </Card>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Money In And Out</p>
              </div>
              <SnapshotList title="Income" rows={[["Active Income", point.activeIncome], ["CPF LIFE", point.cpfLifeIncome], ["SRS Withdrawal", point.annualSrsWithdrawal], ["Dividends", point.annualDividendIncome]]} />
              <SnapshotList title="Outflows" rows={[["Living Expenses", point.annualExpenses], ["Income Tax", point.annualIncomeTax], ["Employee CPF", point.employeeCpfContribution], ["Insurance", point.annualInsurancePremiums], ["CareShield", point.annualCareShieldPremiums], ["MediShield", point.annualMediShieldPremiums], ["SRS Contribution", point.annualSrsContribution], ["Investments", point.annualInvestmentContributions], ["Home Purchase - Cash", point.annualHomePurchaseCash], ["Home Purchase - CPF OA", point.annualHomePurchaseCpf], ["Mortgage Cash", point.annualMortgageCash], ["Mortgage CPF OA", point.annualMortgageCpf], ["Car", point.annualCarLoanCash + point.annualCarExpenses]]} />
              {showLivingBreakdown ? <SnapshotList title="Living Expenses Breakdown" rows={livingRows} /> : null}
              {showInsuranceBreakdown ? <SnapshotList title="Insurance Premiums Breakdown" rows={insuranceRows} /> : null}
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Balances And Holdings</p>
              </div>
              <SnapshotList title="CPF Balances" rows={[["OA", point.cpf.oa], ["SA", point.cpf.sa], ["RA", point.cpf.ra], ["CPF LIFE / RA Reserve", point.cpfLifeReserve], ["MA", point.cpf.ma]]} />
              <SnapshotList title="Investment Holdings" rows={point.assets.filter((asset) => !asset.isShiftTarget || asset.projected > 0).map((asset): [string, number] => [asset.label || asset.type, asset.projected])} />
              <SnapshotList
                title="Assets And Liabilities"
                rows={[
                  ...point.homes.map((asset): [string, number] => [`${asset.item.label || "Housing"} Equity`, asset.equity]),
                  ...point.cars.map((asset): [string, number] => [`${asset.item.label || "Car"} Equity`, asset.equity]),
                  ...point.customAssets.map((asset): [string, number] => [`${asset.item.label || "Other Asset"} Equity`, asset.equity])
                ]}
              />
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Events, Drawdowns, And Readiness</p>
              </div>
              <SnapshotList
                title="Events And Glidepaths"
                rows={[
                  ["Life Event Costs", point.annualLifeEventCosts],
                  ["Home Sale Cash Proceeds", point.annualHomeSaleCash],
                  ["Home Sale CPF OA Refund", point.annualHomeSaleCpfRefund],
                  ["Investment Drawdown", point.annualDrawdown],
                  ["CPF OA Deficit Draw", point.annualCpfDeficitDrawdown]
                ]}
              />
              <SnapshotList
                title="Retirement Readiness"
                totalOverride={point.annualUnfundedShortfall}
                rows={[
                  ["Cash Flow Gap", point.retirementCashFlowGap],
                  ["Free Cash Drawdown", point.annualFreeCashDrawdown],
                  ["Investment Drawdown", point.annualDrawdown],
                  ["SRS Drawdown", point.annualSrsDeficitDrawdown],
                  ["Other Asset Drawdown", point.annualOtherAssetDrawdown],
                  ["CPF OA Drawdown", point.annualCpfDeficitDrawdown],
                  ["True Unfunded Shortfall", point.annualUnfundedShortfall]
                ]}
              />
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Asset Allocation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={100} paddingAngle={2}>
                      {slices.map((_, index) => (
                        <Cell key={index} fill={allocationColors[index % allocationColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => currency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2">
                {slices.map((slice, index) => (
                  <div key={slice.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: allocationColors[index % allocationColors.length] }} />{slice.name}</span>
                    <strong className="tabular-nums">{currency(slice.value)}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotList({ title, rows, totalOverride }: { title: string; rows: [string, number][]; totalOverride?: number }) {
  const visible = rows.filter(([, value]) => Math.abs(value) > 0.5);
  const total = totalOverride ?? visible.reduce((sum, [, value]) => sum + value, 0);
  return (
    <details className="rounded-lg border bg-card p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
        <span>{title}: {currency(total)}</span>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">+</span>
      </summary>
      <div className="mt-4 grid max-h-72 gap-2 overflow-auto pr-1">
        {visible.length ? visible.map(([label, value]) => (
          <div className="flex justify-between gap-3 border-b pb-2 text-sm last:border-b-0" key={label}>
            <span className="text-muted-foreground">{label}</span>
            <strong className="tabular-nums">{currency(value)}</strong>
          </div>
        )) : <p className="text-sm text-muted-foreground">No items this year.</p>}
      </div>
    </details>
  );
}

function App() {
  const [store, setStore] = useState(() => loadProfileStore());
  const [profile, setProfile] = useState<SingaporePlannerProfile>(() => activeStoredProfile(loadProfileStore()).profile);
  const [step, setStep] = useState(1);
  const [dashboard, setDashboard] = useState(false);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [coupleInputPerson, setCoupleInputPerson] = useState<CouplePersonKey>("person1");
  const [projectionScope, setProjectionScope] = useState<ProjectionScope>("combined");
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [profileNaming, setProfileNaming] = useState<null | {
    mode: "new" | "rename";
    id?: string;
    name: string;
  }>(null);
  const [pendingProfileAction, setPendingProfileAction] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    action: () => void;
  }>(null);

  const normalized = useMemo(() => normalizeProfile(profile), [profile]);
  const primaryProjectionProfile = useMemo(() => primarySoloProfile(normalized), [normalized]);
  const partnerProjectionProfile = useMemo(() => partnerProfile(normalized), [normalized]);
  const combinedRows = useMemo(() => householdProjectionRows(normalized), [normalized]);
  const person1Rows = useMemo(() => projectSingaporeProfile(primaryProjectionProfile), [primaryProjectionProfile]);
  const person2Rows = useMemo(() => partnerProjectionProfile ? projectSingaporeProfile(partnerProjectionProfile) : [], [partnerProjectionProfile]);
  const rows = projectionScope === "person1" ? person1Rows : projectionScope === "person2" && person2Rows.length ? person2Rows : combinedRows;
  const activeProjectionProfile = projectionScope === "person1" ? primaryProjectionProfile : projectionScope === "person2" && partnerProjectionProfile ? partnerProjectionProfile : normalized;
  const selected = rows.find((row) => row.age === (selectedAge ?? positive(activeProjectionProfile.age))) ?? rows[0];
  const previousSelected = rows.find((row) => selected && row.age === selected.age - 1);
  const errors = validateProfile(normalized);

  useEffect(() => {
    document.documentElement.dataset.theme = normalized.dark ? "dark" : "light";
  }, [normalized.dark]);

  useEffect(() => {
    if (normalized.planningMode !== "Couple") {
      setCoupleInputPerson("person1");
      setProjectionScope("combined");
    }
  }, [normalized.planningMode]);

  useEffect(() => {
    const firstAge = rows[0]?.age;
    const lastAge = rows.at(-1)?.age;
    if (firstAge == null || lastAge == null) return;
    setSelectedAge((current) => {
      if (current == null) return firstAge;
      return Math.min(lastAge, Math.max(firstAge, current));
    });
  }, [rows]);

  useEffect(() => {
    if (!dashboard) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [step, dashboard]);

  const update = (patch: Partial<SingaporePlannerProfile>) => setProfile((current) => normalizeProfile({ ...current, ...patch }));
  const activeStep = steps.find((item) => item.id === step) ?? steps[0];
  const activeStoredName = store.profiles.find((item) => item.id === store.activeId)?.name || "Untitled Profile";

  const goToStep = (nextStep: number) => {
    setStep(Math.min(steps.length, Math.max(1, nextStep)));
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const save = () => {
    const next = saveProfileStore(upsertActiveProfile(store, normalized));
    setStore(next);
    setSaveMessage("Profile saved successfully.");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const switchProfile = (activeId: string) => {
    const next = saveProfileStore({ ...store, activeId });
    setStore(next);
    setProfile(activeStoredProfile(next).profile);
  };

  const addNewProfile = (name: string) => {
    const next = saveProfileStore(addProfile(
      store,
      normalizeProfile({ ...createDefaultProfile(), welcomed: true }),
      name
    ));
    setStore(next);
    setProfile(activeStoredProfile(next).profile);
    setSaveMessage(`Created "${activeStoredProfile(next).name}".`);
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const renameSavedProfile = (id: string, name: string) => {
    const next = saveProfileStore(renameProfile(store, id, name));
    setStore(next);
    setSaveMessage(`Profile renamed to "${name.trim()}".`);
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const saveProfileName = () => {
    const name = profileNaming?.name.trim();
    if (!profileNaming || !name) return;
    if (profileNaming.mode === "new") addNewProfile(name);
    else if (profileNaming.id) renameSavedProfile(profileNaming.id, name);
    setProfileNaming(null);
  };

  const confirmProfileAction = (config: {
    title: string;
    description: string;
    confirmLabel: string;
    action: () => void;
  }) => {
    setPendingProfileAction(config);
  };

  const runPendingProfileAction = () => {
    const action = pendingProfileAction?.action;
    setPendingProfileAction(null);
    action?.();
  };

  const deleteCurrentProfile = (id = store.activeId) => {
    const next = saveProfileStore(removeProfile(store, id));
    setStore(next);
    setProfile(activeStoredProfile(next).profile);
  };

  const exportProfiles = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `singapore-wealth-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveReport = () => {
    const blob = createInputSummaryReport(normalized, combinedRows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFilename(normalized);
    link.click();
    URL.revokeObjectURL(url);
    setSaveMessage("PDF report generated.");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const importProfiles = async (file: File) => {
    try {
      const imported = normalizeProfileStore(JSON.parse(await file.text()));
      const next = saveProfileStore(imported);
      setStore(next);
      setProfile(activeStoredProfile(next).profile);
      setSaveMessage("Profiles imported successfully.");
    } catch {
      setSaveMessage("Could not import that profile file.");
    } finally {
      window.setTimeout(() => setSaveMessage(""), 2200);
    }
  };

  const startBlank = () => {
    setProfile(normalizeProfile({ ...createDefaultProfile(), welcomed: true }));
    setStep(1);
    setDashboard(false);
    setShowWelcome(false);
  };

  const startTemplate = () => {
    setProfile(normalizeProfile({ ...createQuickStartProfile(), welcomed: true }));
    setStep(1);
    setDashboard(false);
    setShowWelcome(false);
  };

  const startCoupleBlank = () => {
    setProfile(normalizeProfile({ ...createDefaultCoupleProfile(), welcomed: true }));
    setStep(1);
    setDashboard(false);
    setShowWelcome(false);
  };

  const startCoupleTemplate = () => {
    setProfile(normalizeProfile({ ...createQuickStartCoupleProfile(), welcomed: true }));
    setStep(1);
    setDashboard(false);
    setShowWelcome(false);
  };

  const openProjection = () => {
    setDashboard(true);
    setSelectedAge(positive(activeProjectionProfile.age));
  };

  const renderStepFor = (personProfile: SingaporePlannerProfile, updatePerson: (patch: Partial<SingaporePlannerProfile>) => void) => {
    const props = { profile: personProfile, update: updatePerson };
    if (step === 1) return <ProfileStep {...props} />;
    if (step === 2) return <IncomeStep {...props} />;
    if (step === 3) return <ExpensesStep {...props} />;
    if (step === 4) return <ProtectionStep {...props} />;
    if (step === 5) return <AssetsStep {...props} />;
    if (step === 6) return <TaxesStep {...props} />;
    if (step === 7) return <InvestmentsStep {...props} />;
    return <LifeEventsStep {...props} />;
  };

  const renderStep = () => {
    if (normalized.planningMode === "Couple" && step > 1) {
      return (
        <CouplePersonTabs
          profile={normalized}
          update={update}
          active={coupleInputPerson}
          onActiveChange={setCoupleInputPerson}
          render={(personProfile, updatePerson) => renderStepFor(personProfile, updatePerson)}
        />
      );
    }
    return renderStepFor(normalized, update);
  };

  if (!normalized.welcomed || showWelcome) {
    return (
      <WelcomeScreen
        startBlank={startBlank}
        startTemplate={startTemplate}
        startCoupleBlank={startCoupleBlank}
        startCoupleTemplate={startCoupleTemplate}
        resume={normalized.welcomed ? () => setShowWelcome(false) : undefined}
      />
    );
  }

  return (
    <main className="react-app-shell">
      <header className="react-appbar">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Difficult Dollars To Common Cents</p>
          <h1 className="text-xl font-semibold">Your Personal Finance, Simplified.</h1>
        </div>
        <div className="mobile-account-summary">
          <span>{activeStoredName}</span>
          <Button variant="outline" onClick={() => setMobileAccountOpen(true)}>
            <Menu className="h-4 w-4" />
            Actions
          </Button>
        </div>
        <div className="react-appbar-actions flex flex-wrap items-center gap-2">
          <select className="react-select w-auto min-w-44" value={store.activeId} onChange={(event) => switchProfile(event.target.value)}>
            {store.profiles.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <Button variant="outline" aria-label="Home" title="Home" onClick={() => { setDashboard(false); setShowWelcome(true); }}>
            <Home className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => update({ dark: !normalized.dark })}>{normalized.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button
            variant="outline"
            onClick={() => confirmProfileAction({
              title: "Start A New Profile?",
              description: "This creates and switches to a blank profile. Any unsaved entries in the current profile may be lost.",
              confirmLabel: "Create New Profile",
              action: () => setProfileNaming({ mode: "new", name: "" })
            })}
          >
            New
          </Button>
          <Button
            variant="outline"
            onClick={() => confirmProfileAction({
              title: "Load Quick Start Template?",
              description: "This replaces the current inputs with sample figures. Any data entered so far in this profile will be overwritten.",
              confirmLabel: "Load Quick Start",
              action: () => setProfile(normalizeProfile({ ...createQuickStartProfile(), welcomed: true }))
            })}
          >
            Quick Start
          </Button>
          <Button
            variant="outline"
            onClick={() => confirmProfileAction({
              title: "Reset Current Profile?",
              description: "This clears the current profile and returns it to blank defaults. Any data entered so far will be lost.",
              confirmLabel: "Reset Profile",
              action: () => setProfile(normalizeProfile({ ...createDefaultProfile(), welcomed: true }))
            })}
          >
            Reset
          </Button>
          <Button variant="outline" onClick={() => setProfileManagerOpen(true)}>Manage</Button>
          <Button variant="outline" disabled={store.profiles.length <= 1} onClick={() => deleteCurrentProfile()}>Delete</Button>
          <Button variant="outline" onClick={saveReport}><Download className="h-4 w-4" /> Save Report</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </header>
      {mobileAccountOpen ? (
        <div className="mobile-nav-backdrop" onClick={() => setMobileAccountOpen(false)}>
          <aside className="mobile-nav-drawer mobile-account-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <strong>Profile Actions</strong>
                <p className="mt-1 text-xs text-muted-foreground">Save, manage, reset, export, or return home when you need it.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMobileAccountOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="mobile-account-stack">
              <select
                className="react-select"
                value={store.activeId}
                onChange={(event) => {
                  switchProfile(event.target.value);
                  setMobileAccountOpen(false);
                }}
              >
                {store.profiles.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <Button variant="outline" onClick={() => { setDashboard(false); setShowWelcome(true); setMobileAccountOpen(false); }}>
                <Home className="h-4 w-4" />
                Home
              </Button>
              <Button variant="outline" onClick={() => update({ dark: !normalized.dark })}>
                {normalized.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {normalized.dark ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMobileAccountOpen(false);
                  confirmProfileAction({
                    title: "Start A New Profile?",
                    description: "This creates and switches to a blank profile. Any unsaved entries in the current profile may be lost.",
                    confirmLabel: "Create New Profile",
                    action: () => setProfileNaming({ mode: "new", name: "" })
                  });
                }}
              >
                New
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMobileAccountOpen(false);
                  confirmProfileAction({
                    title: "Load Quick Start Template?",
                    description: "This replaces the current inputs with sample figures. Any data entered so far in this profile will be overwritten.",
                    confirmLabel: "Load Quick Start",
                    action: () => setProfile(normalizeProfile({ ...createQuickStartProfile(), welcomed: true }))
                  });
                }}
              >
                Quick Start
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMobileAccountOpen(false);
                  confirmProfileAction({
                    title: "Reset Current Profile?",
                    description: "This clears the current profile and returns it to blank defaults. Any data entered so far will be lost.",
                    confirmLabel: "Reset Profile",
                    action: () => setProfile(normalizeProfile({ ...createDefaultProfile(), welcomed: true }))
                  });
                }}
              >
                Reset
              </Button>
              <Button variant="outline" onClick={() => { setProfileManagerOpen(true); setMobileAccountOpen(false); }}>Manage</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setProfileNaming({ mode: "rename", id: store.activeId, name: activeStoredName });
                  setMobileAccountOpen(false);
                }}
              >
                <Pencil className="h-4 w-4" />
                Rename Profile
              </Button>
              <Button variant="outline" disabled={store.profiles.length <= 1} onClick={() => { deleteCurrentProfile(); setMobileAccountOpen(false); }}>Delete</Button>
              <Button variant="outline" onClick={() => { saveReport(); setMobileAccountOpen(false); }}>
                <Download className="h-4 w-4" />
                Save Report
              </Button>
              <Button onClick={() => { save(); setMobileAccountOpen(false); }}>Save</Button>
            </div>
          </aside>
        </div>
      ) : null}
      <ProfileManagerDialog
        open={profileManagerOpen}
        onOpenChange={setProfileManagerOpen}
        store={store}
        switchProfile={(id) => {
          switchProfile(id);
          setProfileManagerOpen(false);
        }}
        renameSavedProfile={renameSavedProfile}
        deleteProfile={deleteCurrentProfile}
        exportProfiles={exportProfiles}
        importProfiles={importProfiles}
      />
      <Dialog open={Boolean(profileNaming)} onOpenChange={(open) => !open && setProfileNaming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{profileNaming?.mode === "new" ? "Name Your New Profile" : "Rename Profile"}</DialogTitle>
            <DialogDescription>
              Use a clear label such as “Bryan - Base Plan” or “Household Retirement Plan” so saved projections are easy to identify.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="saved-profile-name">Profile Name</Label>
            <Input
              id="saved-profile-name"
              autoFocus
              maxLength={60}
              placeholder="Enter a profile name"
              value={profileNaming?.name ?? ""}
              onChange={(event) => setProfileNaming((current) => current ? { ...current, name: event.target.value } : current)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveProfileName();
              }}
            />
            <p className="text-xs text-muted-foreground">This label is separate from the client name used inside the financial plan.</p>
          </div>
          <div className="dialog-action-row">
            <Button variant="outline" onClick={() => setProfileNaming(null)}>Cancel</Button>
            <Button disabled={!profileNaming?.name.trim()} onClick={saveProfileName}>
              {profileNaming?.mode === "new" ? "Create Profile" : "Save Name"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingProfileAction)} onOpenChange={(open) => !open && setPendingProfileAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingProfileAction?.title}</DialogTitle>
            <DialogDescription>{pendingProfileAction?.description}</DialogDescription>
          </DialogHeader>
          <div className="profile-action-warning" role="alert">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <strong>Please confirm before continuing.</strong>
              <p>This action changes the current profile inputs. Choose Cancel to keep working where you are.</p>
            </div>
          </div>
          <div className="dialog-action-row">
            <Button variant="outline" onClick={() => setPendingProfileAction(null)}>Cancel</Button>
            <Button className="danger-action-button" onClick={runPendingProfileAction}>
              {pendingProfileAction?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="react-mobile-controls">
        <Button variant="outline" onClick={() => setMobileNavOpen(true)}><Menu className="h-4 w-4" /> Menu</Button>
        {!dashboard ? <StepStatus step={step} /> : null}
        <Button className="projection-cta projection-cta--compact" onClick={openProjection}><ChartNoAxesCombined className="h-4 w-4" /> Projection</Button>
      </div>
      {mobileNavOpen ? (
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)}>
          <aside className="mobile-nav-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <strong>Planner Steps</strong>
                <p className="mt-1 text-xs text-muted-foreground">Jump to any section. Your current inputs stay saved on screen.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMobileNavOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <nav className="react-step-rail mobile"><StepRail step={step} setStep={goToStep} close={() => setMobileNavOpen(false)} /></nav>
          </aside>
        </div>
      ) : null}
      {saveMessage ? <div className="mb-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">{saveMessage}</div> : null}

      {!dashboard ? (
        <section className="react-workspace">
          <aside className="react-step-rail">
            <StepRail step={step} setStep={goToStep} />
          </aside>
          <div className="react-step-content min-w-0" key={step}>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Step {activeStep.id}</p>
                <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{activeStep.label}</h2>
              </div>
              <Button className="projection-cta" onClick={openProjection}>
                <ChartNoAxesCombined className="h-4 w-4" />
                View Projection
              </Button>
            </div>
            {errors.length ? (
              <Card className="mb-4 border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 text-sm text-destructive">{errors.join(" ")}</CardContent>
              </Card>
            ) : null}
            {renderStep()}
            <div className="react-wizard-actions">
              <Button variant="outline" disabled={step === 1} onClick={() => goToStep(step - 1)}>Back</Button>
              {step < steps.length ? <Button onClick={() => goToStep(step + 1)}>Next</Button> : (
                <Button className="projection-cta projection-cta--wide" onClick={openProjection}>
                  <ChartNoAxesCombined className="h-4 w-4" />
                  Build Wealth Chart
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setDashboard(false)}>Back To Inputs</Button>
            {normalized.planningMode === "Couple" ? (
              <Tabs
                value={projectionScope}
                onValueChange={(value) => {
                  const nextScope = value as ProjectionScope;
                  const nextProfile = nextScope === "person1" ? primaryProjectionProfile : nextScope === "person2" && partnerProjectionProfile ? partnerProjectionProfile : normalized;
                  setProjectionScope(nextScope);
                  setSelectedAge(positive(nextProfile.age));
                }}
              >
                <TabsList className="projection-view-tabs">
                  <TabsTrigger value="person1">{personName(primaryProjectionProfile, "Person 1")}</TabsTrigger>
                  <TabsTrigger value="person2">{personName(partnerProjectionProfile ?? createDefaultCoupleProfile().couple!.partner, "Person 2")}</TabsTrigger>
                  <TabsTrigger value="combined">Combined</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
            <div className="flex items-center gap-2 rounded-md border bg-card p-1">
              <Button variant="ghost" disabled={!selected || selected.age <= rows[0].age} onClick={() => setSelectedAge((selected?.age ?? rows[0].age) - 1)}>Previous</Button>
              <strong className="px-3 text-sm">Age {selected?.age ?? "-"}</strong>
              <Button variant="ghost" disabled={!selected || selected.age >= rows.at(-1)!.age} onClick={() => setSelectedAge((selected?.age ?? rows[0].age) + 1)}>Next</Button>
            </div>
            <Button variant="outline" onClick={() => setSourcesOpen(true)}>Assumptions & Sources</Button>
            <Button variant="outline" onClick={() => setDataOpen(true)}>View Year-By-Year Data</Button>
            <Button onClick={() => setSnapshotOpen(true)}>Open Year Snapshot</Button>
          </div>
          {selected ? (
            <ProjectionDashboard
              profile={activeProjectionProfile}
              rows={rows}
              selected={selected}
              onSelectAge={(age) => {
                setSelectedAge(age);
              }}
              onOpenSnapshot={() => setSnapshotOpen(true)}
              onPropertyNetWorthChange={(includePropertyInNetWorth) => update({ includePropertyInNetWorth })}
            />
          ) : null}
          {selected ? (
            <YearSnapshot
              profile={activeProjectionProfile}
              point={selected}
              previous={previousSelected}
              open={snapshotOpen}
              onOpenChange={setSnapshotOpen}
              hasPrevious={selected.age > rows[0].age}
              hasNext={selected.age < rows.at(-1)!.age}
              onPrevious={() => setSelectedAge(Math.max(rows[0].age, selected.age - 1))}
              onNext={() => setSelectedAge(Math.min(rows.at(-1)!.age, selected.age + 1))}
            />
          ) : null}
          <ProjectionDataDialog profile={activeProjectionProfile} rows={rows} open={dataOpen} onOpenChange={setDataOpen} />
          <AssumptionsSourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} />
        </section>
      )}

      <footer className="mt-6 text-sm text-muted-foreground">
        Projections are estimates and are not financial advice. React migration preview preserves the current published app until feature parity is complete.
      </footer>
    </main>
  );
}

export default App;
