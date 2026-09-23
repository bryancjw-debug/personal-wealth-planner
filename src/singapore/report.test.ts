import { describe, expect, it } from "vitest";
import { createQuickStartCoupleProfile, createQuickStartProfile } from "./defaults";
import { projectSingaporeProfile } from "./projection";
import { createInputSummaryReport, reportFilename } from "./report";

describe("PDF report generation", () => {
  it("creates a PDF blob with the requested client filename", async () => {
    const profile = createQuickStartProfile();
    profile.name = "Alicia Tan";
    const report = createInputSummaryReport(profile, projectSingaporeProfile(profile));

    expect(report.type).toBe("application/pdf");
    expect(report.size).toBeGreaterThan(1000);
    expect(await report.slice(0, 5).text()).toBe("%PDF-");
    expect(reportFilename(profile, new Date(2026, 4, 21))).toBe("Alicia-Tan's-Personal-Wealth-Planning-2026-05-21.pdf");
  });

  it("creates a PDF blob and filename for both parties in couple mode", async () => {
    const profile = createQuickStartCoupleProfile();
    profile.name = "Alicia Tan";
    profile.couple!.partner.name = "Ben Lim";
    const report = createInputSummaryReport(profile, projectSingaporeProfile(profile));

    expect(report.type).toBe("application/pdf");
    expect(report.size).toBeGreaterThan(1500);
    expect(await report.slice(0, 5).text()).toBe("%PDF-");
    expect(reportFilename(profile, new Date(2026, 4, 21))).toBe("Alicia-Tan-and-Ben-Lim's-Personal-Wealth-Planning-2026-05-21.pdf");
  });
});
