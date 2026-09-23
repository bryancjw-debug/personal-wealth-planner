import { createDefaultProfile, createQuickStartProfile, retirementEvent } from "./defaults";
import type { SingaporePlannerProfile } from "./types";

export function quickStartFixture(): SingaporePlannerProfile {
  return createQuickStartProfile();
}

export function retirementFixture(): SingaporePlannerProfile {
  const profile = createQuickStartProfile();
  profile.age = 54;
  profile.retirementAge = 62;
  profile.endAge = 70;
  profile.cpf.oa = 180_000;
  profile.cpf.sa = 120_000;
  profile.cpf.ma = 60_000;
  profile.cpf.lifeStart = 65;
  profile.events = [retirementEvent(62)];
  return profile;
}

export function srsAndHealthcareFixture(): SingaporePlannerProfile {
  const profile = createQuickStartProfile();
  profile.endAge = 68;
  profile.healthcare.careShield.enabled = true;
  profile.healthcare.careShield.enhancement = true;
  profile.healthcare.mediShield.enabled = true;
  profile.healthcare.mediShield.subsidyMode = "None";
  profile.healthcare.mediShield.manualSubsidyPct = "";
  profile.srs.enabled = true;
  profile.srs.currentBalance = 30_000;
  profile.srs.annualContribution = 15_300;
  profile.srs.contributionStartAge = 35;
  profile.srs.contributionStopAge = 55;
  profile.srs.withdrawalStartAge = 63;
  profile.srs.expectedReturn = 4;
  return profile;
}

export function emptyFixture(): SingaporePlannerProfile {
  return createDefaultProfile();
}
