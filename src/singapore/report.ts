import type { ProjectionYear, SingaporePlannerProfile } from "./types";
import { monthlyExpenses, monthlyIncome, normalizeProfile, positive, projectSingaporeProfile, retirementSumsForYear, projectionYear } from "./projection";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 42;

type PdfPage = string[];
let activeReportDark = false;

function reportColor(kind: "text" | "muted" | "border" | "panel" | "soft" | "primary" | "success" | "danger" | "info") {
  const dark = {
    text: "0.91 0.93 0.91",
    muted: "0.62 0.66 0.63",
    border: "0.18 0.20 0.19",
    panel: "0.08 0.09 0.09",
    soft: "0.10 0.12 0.11",
    primary: "0.31 0.60 0.64",
    success: "0.25 0.68 0.42",
    danger: "0.82 0.32 0.34",
    info: "0.38 0.58 0.83"
  };
  const light = {
    text: "0.05 0.07 0.10",
    muted: "0.38 0.42 0.50",
    border: "0.86 0.86 0.86",
    panel: "0.995 0.995 0.985",
    soft: "0.965 0.988 0.985",
    primary: "0.31 0.60 0.64",
    success: "0.20 0.58 0.36",
    danger: "0.82 0.32 0.34",
    info: "0.24 0.53 0.70"
  };
  return (activeReportDark ? dark : light)[kind];
}

function esc(text: string | number) {
  return String(text)
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function money(value: number) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function pct(value: number | "") {
  return value === "" ? "-" : `${value}%`;
}

function safe(value: string | number | "") {
  return value === "" ? "-" : String(value);
}

function line(page: PdfPage, x1: number, y1: number, x2: number, y2: number, color = reportColor("border"), width = 0.6) {
  page.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
}

function rect(page: PdfPage, x: number, y: number, w: number, h: number, stroke = reportColor("border"), fill?: string) {
  if (fill) page.push(`${fill} rg ${stroke} RG ${x} ${y} ${w} ${h} re B`);
  else page.push(`${stroke} RG ${x} ${y} ${w} ${h} re S`);
}

function text(page: PdfPage, x: number, y: number, value: string | number, size = 10, font = "F1", color = reportColor("text")) {
  page.push(`BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${esc(value)}) Tj ET`);
}

function multiline(page: PdfPage, x: number, y: number, value: string, width = 70, size = 9, leading = 13) {
  const words = value.split(/\s+/);
  let current = "";
  let cy = y;
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      text(page, x, cy, current, size, "F1", reportColor("muted"));
      cy -= leading;
      current = word;
    } else {
      current = next;
    }
  });
  if (current) text(page, x, cy, current, size, "F1", reportColor("muted"));
  return cy - leading;
}

function heading(page: PdfPage, y: number, title: string, subtitle?: string) {
  text(page, M, y, title, 18, "F2", reportColor("text"));
  if (subtitle) text(page, M, y - 18, subtitle, 9, "F1", reportColor("muted"));
  line(page, M, y - 28, PAGE_W - M, y - 28, reportColor("border"));
  return y - 48;
}

function keyValue(page: PdfPage, x: number, y: number, label: string, value: string, w = 240) {
  rect(page, x, y - 28, w, 36, reportColor("border"), reportColor("soft"));
  text(page, x + 10, y - 3, label.toUpperCase(), 7, "F2", reportColor("muted"));
  text(page, x + 10, y - 19, value, 10, "F2", reportColor("text"));
}

function kpiStrip(page: PdfPage, x: number, y: number, rows: Array<[string, string]>) {
  const gap = 10;
  const w = (PAGE_W - M * 2 - gap * (rows.length - 1)) / rows.length;
  rows.forEach(([label, value], index) => {
    const bx = x + index * (w + gap);
    rect(page, bx, y - 42, w, 48, reportColor("border"), index === 1 ? reportColor("panel") : reportColor("soft"));
    text(page, bx + 10, y - 6, label.toUpperCase(), 7, "F2", index === 1 ? reportColor("danger") : reportColor("primary"));
    text(page, bx + 10, y - 27, value, 12, "F2", index === 1 ? reportColor("danger") : reportColor("primary"));
  });
}

function bulletRows(page: PdfPage, x: number, y: number, rows: Array<[string, string]>, title: string) {
  text(page, x, y, title, 12, "F2", reportColor("text"));
  let cy = y - 20;
  rows.forEach(([label, value]) => {
    text(page, x, cy, label, 8.5, "F1", reportColor("muted"));
    text(page, x + 150, cy, value, 8.5, "F2", reportColor("text"));
    cy -= 15;
  });
  return cy - 8;
}

function noteBox(page: PdfPage, x: number, y: number, w: number, title: string, body: string) {
  rect(page, x, y - 78, w, 88, reportColor("border"), reportColor("soft"));
  text(page, x + 12, y - 10, title.toUpperCase(), 8, "F2", reportColor("primary"));
  return multiline(page, x + 12, y - 28, body, Math.max(42, Math.floor(w / 5.6)), 8.5, 12);
}

function numberedPrompts(page: PdfPage, x: number, y: number, prompts: string[]) {
  let cy = y;
  prompts.forEach((prompt, index) => {
    text(page, x, cy, `${index + 1}.`, 9, "F2", reportColor("primary"));
    cy = multiline(page, x + 20, cy, prompt, 84, 9, 13) + 1;
  });
  return cy;
}

function chartPanel(page: PdfPage, x: number, y: number, w: number, h: number, title: string) {
  rect(page, x, y - h, w, h, reportColor("border"), reportColor("panel"));
  text(page, x + 12, y - 20, title, 11, "F2", reportColor("text"));
  return { x: x + 34, y: y - h + 42, w: w - 54, h: h - 86 };
}

function chartAxisLabels(page: PdfPage, area: { x: number; y: number; w: number; h: number }, yLabel: string, xLabel = "Age") {
  text(page, area.x, area.y + area.h + 10, yLabel, 7, "F1", reportColor("muted"));
  text(page, area.x + area.w / 2 - 10, area.y - 28, xLabel, 7, "F2", reportColor("muted"));
  text(page, area.x - 14, area.y - 2, "0", 7, "F1", reportColor("muted"));
}

function drawNetWorthChart(page: PdfPage, rows: ProjectionYear[], x: number, y: number, w: number, h: number) {
  const area = chartPanel(page, x, y, w, h, "Net Worth By Age");
  const max = Math.max(...rows.map((r) => r.totalAssets), 1);
  const peak = rows.reduce((best, row) => (row.totalAssets > best.totalAssets ? row : best), rows[0]);
  chartAxisLabels(page, area, "Net Worth (SGD)");
  line(page, area.x, area.y, area.x, area.y + area.h, reportColor("border"));
  line(page, area.x, area.y, area.x + area.w, area.y, reportColor("border"));
  [0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const gy = area.y + area.h * ratio;
    line(page, area.x, gy, area.x + area.w, gy, reportColor("border"), 0.35);
    if (ratio < 1) text(page, area.x - 28, gy - 2, money(max * ratio).replace("SGD", ""), 6.5, "F1", reportColor("muted"));
  });
  const step = Math.max(1, Math.ceil(rows.length / 42));
  const data = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
  const barGap = 1.2;
  const barW = Math.max(2, area.w / data.length - barGap);
  data.forEach((row, i) => {
    const bh = Math.max(1, (row.totalAssets / max) * area.h);
    const bx = area.x + i * (barW + barGap);
    page.push(`${reportColor("success")} rg ${bx} ${area.y} ${barW} ${bh} re f`);
  });
  text(page, area.x, area.y - 16, `Age ${rows[0]?.age ?? "-"}`, 7, "F1", reportColor("muted"));
  text(page, area.x + area.w - 38, area.y - 16, `Age ${rows.at(-1)?.age ?? "-"}`, 7, "F1", reportColor("muted"));
  text(page, area.x + area.w - 144, area.y + area.h + 10, `Peak ${money(max)} at age ${peak?.age ?? "-"}`, 7, "F2", reportColor("success"));
}

function drawCashFlowChart(page: PdfPage, rows: ProjectionYear[], x: number, y: number, w: number, h: number) {
  const area = chartPanel(page, x, y, w, h, "Cash Flow By Age");
  const values = rows.flatMap((r) => [r.annualIncome, r.annualCashOutflows, r.netCashFlow]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const yFor = (value: number) => area.y + ((value - min) / (max - min || 1)) * area.h;
  const xFor = (index: number) => area.x + (index / Math.max(1, rows.length - 1)) * area.w;
  chartAxisLabels(page, area, "Annual Cash Flow (SGD)");
  [0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const value = min + (max - min) * ratio;
    const gy = yFor(value);
    line(page, area.x, gy, area.x + area.w, gy, reportColor("border"), 0.35);
    if (ratio < 1) text(page, area.x - 28, gy - 2, money(value).replace("SGD", ""), 6.5, "F1", reportColor("muted"));
  });
  line(page, area.x, yFor(0), area.x + area.w, yFor(0), reportColor("muted"));
  line(page, area.x, area.y, area.x, area.y + area.h, reportColor("border"));
  const drawPath = (getter: (row: ProjectionYear) => number, color: string) => {
    const ops = rows.map((row, i) => `${xFor(i)} ${yFor(getter(row))} ${i === 0 ? "m" : "l"}`).join(" ");
    page.push(`${color} RG 1.4 w ${ops} S`);
  };
  drawPath((r) => r.annualIncome, reportColor("info"));
  drawPath((r) => r.annualCashOutflows, reportColor("danger"));
  drawPath((r) => r.netCashFlow, reportColor("success"));
  text(page, area.x, area.y - 16, `Age ${rows[0]?.age ?? "-"}`, 7, "F1", reportColor("muted"));
  text(page, area.x + area.w - 38, area.y - 16, `Age ${rows.at(-1)?.age ?? "-"}`, 7, "F1", reportColor("muted"));
  text(page, area.x + 110, area.y - 16, "Income", 7, "F2", reportColor("info"));
  text(page, area.x + 164, area.y - 16, "Outflow", 7, "F2", reportColor("danger"));
  text(page, area.x + 226, area.y - 16, "Nett Cash Flow", 7, "F2", reportColor("success"));
}

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageRefs: number[] = [];
  const contents: number[] = [];
  pages.forEach((page) => {
    const stream = page.join("\n");
    contents.push(add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
  });
  pages.forEach((_, i) => {
    pageRefs.push(add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contents[i]} 0 R >>`));
  });
  const pagesRef = add(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);
  pageRefs.forEach((ref) => {
    objects[ref - 1] = objects[ref - 1].replace("/Parent 0 0 R", `/Parent ${pagesRef} 0 R`);
  });
  const catalog = add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function footer(page: PdfPage, note = "Created by bryancjw. Not financial advice. Values depend on client inputs and simplified projection assumptions.") {
  text(page, M, 34, note, 8, "F1", reportColor("muted"));
}

export function reportFilename(profile: SingaporePlannerProfile, date = new Date()) {
  const partner = reportPartnerProfile(profile);
  const householdName = partner
    ? `${profile.name || "Client"} and ${partner.name || "Partner"}`
    : profile.name || "Client";
  const name = householdName.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
  const localDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  return `${name}'s-Personal-Wealth-Planning-${localDate}.pdf`;
}

function reportPrimaryProfile(profile: SingaporePlannerProfile) {
  return normalizeProfile({ ...profile, planningMode: "Individual", couple: undefined, welcomed: true });
}

function reportPartnerProfile(profile: SingaporePlannerProfile) {
  return profile.planningMode === "Couple" && profile.couple?.partner
    ? normalizeProfile({ ...profile.couple.partner, planningMode: "Individual", couple: undefined, welcomed: true, dark: profile.dark, endAge: profile.endAge })
    : null;
}

function displayName(profile: SingaporePlannerProfile, fallback: string) {
  return profile.name?.trim() || fallback;
}

function personStartRows(profile: SingaporePlannerProfile) {
  return projectSingaporeProfile(reportPrimaryProfile(profile));
}

function personInputRows(profile: SingaporePlannerProfile): Array<[string, string]> {
  const retirementYear = projectionYear(profile, Math.max(55, positive(profile.age) || 55));
  const sums = retirementSumsForYear(retirementYear);
  return [
    ["Occupation", profile.occupation || "-"],
    ["Gender", profile.gender],
    ["Current Age", safe(profile.age)],
    ["Expected Retirement Age", safe(profile.retirementAge)],
    ["Gross Monthly Income", money(monthlyIncome(profile))],
    ["Income Growth", pct(profile.incomeInf)],
    ["Monthly Expenses", money(monthlyExpenses(profile))],
    ["Expense Inflation", pct(profile.expenseInf)],
    ["Free Cash", money(positive(profile.freeCash))],
    ["Free Cash Rate", pct(profile.freeCashRate)],
    ["Work Status", profile.cpf.status],
    ["CPF Residency", profile.cpf.residency],
    ["PR CPF Treatment", profile.cpf.residency === "Permanent Resident" ? `${profile.cpf.prYear} / ${profile.cpf.prRateType}` : "Not applicable"],
    ["CPF OA", money(positive(profile.cpf.oa))],
    ["CPF SA", money(positive(profile.cpf.sa))],
    ["CPF MA", money(positive(profile.cpf.ma))],
    ["CPF RA", money(positive(profile.cpf.ra))],
    [`Estimated FRS ${retirementYear}`, money(sums.frs)],
    ["CPF LIFE Start Age", String(profile.cpf.lifeStart)],
    ["CPF LIFE Choice", `${profile.cpf.lifeSum} / ${profile.cpf.lifePlan}`],
    ["CPF LIFE Monthly Override", positive(profile.cpf.lifeMonthlyOverride) > 0 ? money(positive(profile.cpf.lifeMonthlyOverride)) : "Not used"]
  ];
}

function personProtectionRows(profile: SingaporePlannerProfile): Array<[string, string]> {
  return [
    ["Protection Policies", String(profile.protection.policies.length)],
    ["Manual Death Cover", money(positive(profile.protection.death))],
    ["Manual TPD Cover", money(positive(profile.protection.tpd))],
    ["Manual Major CI Cover", money(positive(profile.protection.majorCi))],
    ["Manual Early CI Cover", money(positive(profile.protection.earlyCi))],
    ["Manual Accident Cover", money(positive(profile.protection.accident))],
    ["Disability Monthly Cover", money(positive(profile.protection.disabilityMonthly))],
    ["CareShield Life", profile.healthcare.careShield.enabled ? "Included" : "Not included"],
    ["CareShield Supplement", profile.healthcare.careShield.enhancement ? "Included" : "Not included"],
    ["MediShield Life", profile.healthcare.mediShield.enabled ? "Included" : "Not included"],
    ["Shield Plan", profile.protection.shieldCovered || profile.healthcare.mediShield.enabled ? "Covered" : "Not covered"]
  ];
}

function personPortfolioRows(profile: SingaporePlannerProfile): Array<[string, string]> {
  return [
    ["Investments", String(profile.assets.filter((asset) => !asset.isShiftTarget).length)],
    ["Total Starting Investment Value", money(profile.assets.reduce((sum, asset) => sum + positive(asset.value), 0))],
    ["Existing Housing Assets", String(profile.homes.length)],
    ["Future House Purchases", String(profile.events.filter((event) => event.type === "House").length)],
    ["Cars", String(profile.cars.length)],
    ["Other Assets", String(profile.customAssets.length)],
    ["SRS Planning", profile.srs.enabled ? "Enabled" : "Not enabled"],
    ["SRS Retirement Drawdown", profile.srs.drawdown ? "Available" : "Not available"],
    ["Annual SRS Contribution", money(positive(profile.srs.annualContribution))],
    ["Employment Periods", profile.employmentPeriods.length ? String(profile.employmentPeriods.length) : "Baseline income until retirement"],
    ["Life Events", String(profile.events.length)],
    ["Retirement Glidepaths", String(profile.shifts.length)]
  ];
}

function personTaxRows(profile: SingaporePlannerProfile): Array<[string, string]> {
  return [
    ["Eligible Donations", money(positive(profile.tax.donations))],
    ["Other Reliefs", money(positive(profile.tax.otherReliefs))],
    ["Tax Rebates", money(positive(profile.tax.rebates))],
    ["Property Tax Payable", money(positive(profile.tax.propertyTaxAnnual))],
    ["Tax Payment Mode", profile.taxMode]
  ];
}

function drawPersonSummary(page: PdfPage, x: number, y: number, title: string, profile: SingaporePlannerProfile) {
  const rows = personStartRows(profile);
  const start = rows[0];
  rect(page, x, y - 100, 240, 112, reportColor("border"), reportColor("soft"));
  text(page, x + 12, y - 10, title.toUpperCase(), 8, "F2", reportColor("primary"));
  text(page, x + 12, y - 28, displayName(profile, title), 13, "F2", reportColor("text"));
  text(page, x + 12, y - 45, `${safe(profile.age)} years old / ${profile.occupation || "Occupation not set"}`, 8.5, "F1", reportColor("muted"));
  text(page, x + 12, y - 64, "Starting Net Worth", 7.5, "F2", reportColor("muted"));
  text(page, x + 130, y - 64, money(start?.totalAssets ?? 0), 8.5, "F2", reportColor("text"));
  text(page, x + 12, y - 80, "Starting CPF Total", 7.5, "F2", reportColor("muted"));
  text(page, x + 130, y - 80, money(start?.cpfTotal ?? 0), 8.5, "F2", reportColor("text"));
  text(page, x + 12, y - 96, "Starting Cash Flow", 7.5, "F2", reportColor("muted"));
  text(page, x + 130, y - 96, money(start?.netCashFlow ?? 0), 8.5, "F2", reportColor("text"));
}

function addPersonInputPage(pages: PdfPage[], profile: SingaporePlannerProfile, label: string) {
  const page: PdfPage = [];
  if (activeReportDark) page.push(`0.04 0.05 0.04 rg 0 0 ${PAGE_W} ${PAGE_H} re f`);
  let y = heading(page, 790, `${label}: ${displayName(profile, label)}`, "Personal inputs captured for this person.");
  y = bulletRows(page, M, y, personInputRows(profile), "Profile, Income, Expenses, CPF");
  y -= 8;
  y = bulletRows(page, M, y, personProtectionRows(profile), "Protection And Healthcare");
  footer(page, "Created by bryancjw. Person-specific inputs are shown separately for couple planning clarity.");
  pages.push(page);
}

function addPersonPortfolioPage(pages: PdfPage[], profile: SingaporePlannerProfile, label: string) {
  const page: PdfPage = [];
  if (activeReportDark) page.push(`0.04 0.05 0.04 rg 0 0 ${PAGE_W} ${PAGE_H} re f`);
  let y = heading(page, 790, `${label}: Portfolio, Assets, Taxes, And Goals`, "Portfolio inputs captured for this person.");
  y = bulletRows(page, M, y, personPortfolioRows(profile), "Assets And Investments");
  y -= 8;
  y = bulletRows(page, M, y, personTaxRows(profile), "Taxes");
  footer(page, "Created by bryancjw. Review detailed analytics in the interactive planner.");
  pages.push(page);
}

export function createInputSummaryReport(profile: SingaporePlannerProfile, rows: ProjectionYear[]) {
  activeReportDark = Boolean(profile.dark);
  const primary = reportPrimaryProfile(profile);
  const partner = reportPartnerProfile(profile);
  const pages: PdfPage[] = [[], []];
  if (activeReportDark) pages.forEach((page) => page.push(`0.04 0.05 0.04 rg 0 0 ${PAGE_W} ${PAGE_H} re f`));
  const start = rows[0];
  const end = rows.at(-1);
  const retirementAge = positive(profile.retirementAge) || 65;
  const retirementPoint = rows.find((row) => row.age >= retirementAge) ?? end ?? start;
  const firstShortfall = rows.find((row) => row.age >= retirementAge && row.annualUnfundedShortfall > 0.5);
  const retirementRows = rows.filter((row) => row.age >= retirementAge);
  const totalRetirementGap = retirementRows.reduce((sum, row) => sum + row.retirementCashFlowGap, 0);
  const totalRetirementDrawdown = retirementRows.reduce((sum, row) => sum + row.annualFreeCashDrawdown + row.annualDrawdown + row.annualSrsDeficitDrawdown + row.annualOtherAssetDrawdown + row.annualCpfDeficitDrawdown, 0);
  const totalUnfundedShortfall = retirementRows.reduce((sum, row) => sum + row.annualUnfundedShortfall, 0);
  const readinessLabel = firstShortfall ? `Shortfall From Age ${firstShortfall.age} Onwards` : `Funded Through Age ${end?.age ?? "-"}`;
  const expenseMonths = monthlyExpenses(profile) ? positive(profile.freeCash) / monthlyExpenses(profile) : 0;

  let y = heading(pages[0], 790, "Difficult Dollars To Common Cents Planning Snapshot", "Your Personal Finance, Simplified.");
  keyValue(pages[0], M, y, partner ? "Planning Mode" : "Client", partner ? "Couple / Household" : profile.name || "-");
  keyValue(pages[0], M + 260, y, "Prepared By", "bryancjw");
  y -= 54;
  keyValue(pages[0], M, y, "Prepared Date", new Date().toLocaleDateString("en-SG"));
  keyValue(pages[0], M + 260, y, "Primary Client", displayName(primary, "Person 1"));
  y -= 54;
  keyValue(pages[0], M, y, "Partner", partner ? displayName(partner, "Person 2") : "-");
  keyValue(pages[0], M + 260, y, "Expected Retirement Age", partner ? `${safe(primary.retirementAge)} / ${safe(partner.retirementAge)}` : safe(primary.retirementAge));
  y -= 54;
  kpiStrip(pages[0], M, y, [
    [`Age ${start?.age ?? safe(profile.age)} Net Worth`, money(start?.totalAssets ?? 0)],
    [`Age ${start?.age ?? safe(profile.age)} Net Cash Flow`, money(start?.netCashFlow ?? 0)],
    [`Age ${start?.age ?? safe(profile.age)} CPF Total`, money(start?.cpfTotal ?? 0)]
  ]);
  y -= 64;
  if (partner) {
    drawPersonSummary(pages[0], M, y, "Person 1", primary);
    drawPersonSummary(pages[0], M + 260, y, "Person 2", partner);
    y -= 128;
    keyValue(pages[0], M, y, "Ownership Split", `${safe(profile.couple?.propertyOwnershipA ?? "")}:${safe(profile.couple?.propertyOwnershipB ?? "")}`);
    keyValue(pages[0], M + 260, y, "Loan Servicing Split", `${safe(profile.couple?.loanShareA ?? "")}:${safe(profile.couple?.loanShareB ?? "")}`);
    y -= 62;
  }
  text(pages[0], M, y, "Planning Snapshot", 13, "F2", reportColor("text"));
  y -= 22;
  keyValue(pages[0], M, y, "Emergency Cash Months", `${expenseMonths.toFixed(1)} months`);
  keyValue(pages[0], M + 260, y, "Retirement Readiness", readinessLabel);
  y -= 54;
  keyValue(pages[0], M, y, "Retirement Year Cash Flow", money(retirementPoint?.netCashFlow ?? 0));
  keyValue(pages[0], M + 260, y, "Final Projected Net Worth", money(end?.totalAssets ?? 0));
  y -= 62;
  noteBox(
    pages[0],
    M,
    y,
    PAGE_W - M * 2,
    "How To Read This Report",
    "This PDF gives the client a professional summary of inputs and headline projection visuals. The detailed year-by-year analytics and scenario interpretation remain in the interactive Difficult Dollars To Common Cents planner."
  );
  footer(pages[0], "Created by bryancjw. This report is a client-facing summary generated from Difficult Dollars To Common Cents.");

  y = heading(pages[1], 790, "Projection Visuals", "Headline analytics based on the inputs captured in the planner.");
  kpiStrip(pages[1], M, y, [
    [`Age ${start?.age ?? safe(profile.age)} Net Worth`, money(start?.totalAssets ?? 0)],
    [`Age ${start?.age ?? safe(profile.age)} Net Cash Flow`, money(start?.netCashFlow ?? 0)],
    [`Age ${start?.age ?? safe(profile.age)} CPF Total`, money(start?.cpfTotal ?? 0)]
  ]);
  y -= 66;
  drawNetWorthChart(pages[1], rows, M, y, 510, 210);
  y -= 230;
  drawCashFlowChart(pages[1], rows, M, y, 510, 210);
  y -= 232;
  noteBox(
    pages[1],
    M,
    y,
    PAGE_W - M * 2,
    "Projection Assumptions",
    "The charts use the income, expenses, CPF, protection premiums, SRS, investments, assets, liabilities, taxes, healthcare premiums, life events, and retirement glidepath assumptions entered by the user."
  );
  footer(pages[1], "Created by bryancjw. Projection visuals are estimates based on the inputs provided.");

  addPersonInputPage(pages, primary, partner ? "Person 1" : "Client");
  addPersonPortfolioPage(pages, primary, partner ? "Person 1" : "Client");
  if (partner) {
    addPersonInputPage(pages, partner, "Person 2");
    addPersonPortfolioPage(pages, partner, "Person 2");
  }

  const summaryPage: PdfPage = [];
  if (activeReportDark) summaryPage.push(`0.04 0.05 0.04 rg 0 0 ${PAGE_W} ${PAGE_H} re f`);
  pages.push(summaryPage);
  y = heading(summaryPage, 790, "Household Retirement Readiness", "Summary of the combined plan and discussion points.");
  y = bulletRows(summaryPage, M, y, partner
    ? [
        ["Planning Mode", "Couple / Household"],
        ["Person 1", displayName(primary, "Person 1")],
        ["Person 2", displayName(partner, "Person 2")],
        ["Property Ownership Split", `${safe(profile.couple?.propertyOwnershipA ?? "")}:${safe(profile.couple?.propertyOwnershipB ?? "")}`],
        ["Loan Servicing Split", `${safe(profile.couple?.loanShareA ?? "")}:${safe(profile.couple?.loanShareB ?? "")}`]
      ]
    : [["Planning Mode", "Individual"], ["Client", displayName(primary, "Client")]],
    "Planning Scope"
  );
  y -= 8;
  y = bulletRows(summaryPage, M, y, [
    ["Retirement Readiness", readinessLabel],
    ["Total Retirement Cash Flow Gap", money(totalRetirementGap)],
    ["Total Drawdown Used", money(totalRetirementDrawdown)],
    ["True Unfunded Shortfall", money(totalUnfundedShortfall)],
    ["Drawdown Sources", "Free cash, selected investments, SRS, selected other assets, CPF OA"]
  ], "Retirement Readiness");
  y -= 8;
  text(summaryPage, M, y, "Glossary", 12, "F2", reportColor("text"));
  y -= 20;
  y = multiline(summaryPage, M, y, "Net cash flow is yearly income less expenses, CPF employee contributions, insurance premiums, SRS contributions, investment contributions, debt payments, tax, and other outflows.", 92, 8.5, 12);
  y = multiline(summaryPage, M, y, "For couple planning, each person is projected separately using their own CPF, SRS, protection, tax, investment, asset, and life-event inputs. The household view combines the two projections for charts and readiness.", 92, 8.5, 12);
  y = multiline(summaryPage, M, y, "Retirement cash-flow gap is the yearly shortfall before drawing down assets. Drawdown used shows how much of that gap was funded from available retirement sources. True unfunded shortfall appears only after available sources are exhausted.", 92, 8.5, 12);
  y = multiline(summaryPage, M, y, "CPF Total includes projected CPF balances according to the planner's CPF assumptions, including CPF LIFE reserve treatment after payouts begin.", 92, 8.5, 12);
  y -= 8;
  text(summaryPage, M, y, "Discussion Points", 12, "F2", reportColor("text"));
  y -= 20;
  y = numberedPrompts(summaryPage, M, y, [
    "Review whether retirement cash flow is supported by sustainable drawdowns from free cash, investments, SRS, CPF, and other liquid assets.",
    partner ? "Review whether both parties' CPF LIFE start ages, retirement sums, protection coverage, and drawdown sources are aligned with the household plan." : "Review whether CPF LIFE start age, retirement sum, protection coverage, and drawdown sources are aligned with the plan.",
    "Check if emergency cash, healthcare premiums, and protection coverage are suitable before increasing long-term investment commitments.",
    "Use the interactive planner to review sensitive years such as retirement, CPF LIFE start, major life events, property changes, and portfolio glidepaths."
  ]);
  y -= 8;
  multiline(
    summaryPage,
    M,
    y,
    `Starting projected net worth is ${money(start?.totalAssets ?? 0)} and the final projected net worth at age ${end?.age ?? "-"} is ${money(end?.totalAssets ?? 0)}. Full analytics, sensitivity checks, and year-by-year interpretation remain in the interactive planner.`,
    92,
    10,
    15
  );
  footer(summaryPage);

  return buildPdf(pages);
}
