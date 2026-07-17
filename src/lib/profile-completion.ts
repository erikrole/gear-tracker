import type { GraduationTermValue, StudentYearValue } from "@/lib/student-profile";

export const PROFILE_COMPLETION_STEPS = ["EMAIL", "PHONES", "WISCARD", "STUDENT", "APPAREL"] as const;

export type ProfileCompletionStep = (typeof PROFILE_COMPLETION_STEPS)[number];
export type ProfileCompletionField =
  | "campusEmail"
  | "athleticsEmail"
  | "personalPhone"
  | "workPhone"
  | "wiscard"
  | "studentYear"
  | "anticipatedGraduation"
  | "clothingSize"
  | "shoeSize";

export type ProfileCompletionProfile = {
  role: "ADMIN" | "STAFF" | "STUDENT" | "COLLABORATOR";
  email: string;
  athleticsEmail: string | null;
  phone: string | null;
  personalPhone: string | null;
  workPhone: string | null;
  workPhoneNotApplicable: boolean;
  wiscardCardNumber: string | null;
  wiscardIssueCode: string | null;
  studentYearOverride: StudentYearValue | null;
  gradYear: number | null;
  graduationTerm: GraduationTermValue | null;
  topSizeFit: "UNISEX" | "WOMENS" | "MENS" | null;
  topSize: string | null;
  shoeSizeSystem: "US_WOMENS" | "US_MENS" | null;
  shoeSize: string | null;
  profilePromptSnoozedUntil: Date | string | null;
};

const FIELD_STEP: Record<ProfileCompletionField, ProfileCompletionStep> = {
  campusEmail: "EMAIL",
  athleticsEmail: "EMAIL",
  personalPhone: "PHONES",
  workPhone: "PHONES",
  wiscard: "WISCARD",
  studentYear: "STUDENT",
  anticipatedGraduation: "STUDENT",
  clothingSize: "APPAREL",
  shoeSize: "APPAREL",
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function isCampusLoginEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@wisc.edu");
}

export function isAthleticsEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith("@athletics.wisc.edu"));
}

export function getProfileCompletion(profile: ProfileCompletionProfile, now = new Date()) {
  const completeByField: Record<ProfileCompletionField, boolean> = {
    campusEmail: isCampusLoginEmail(profile.email),
    athleticsEmail: isAthleticsEmail(profile.athleticsEmail),
    personalPhone: hasText(profile.personalPhone),
    workPhone: hasText(profile.workPhone) || profile.workPhoneNotApplicable,
    wiscard: hasText(profile.wiscardCardNumber) && hasText(profile.wiscardIssueCode),
    studentYear: profile.role !== "STUDENT" || Boolean(profile.studentYearOverride),
    anticipatedGraduation: profile.role !== "STUDENT" || Boolean(profile.gradYear && profile.graduationTerm),
    clothingSize: Boolean(profile.topSizeFit) && hasText(profile.topSize),
    shoeSize: Boolean(profile.shoeSizeSystem) && hasText(profile.shoeSize),
  };
  const applicableFields = (Object.keys(completeByField) as ProfileCompletionField[])
    .filter((field) => profile.role === "STUDENT"
      ? field !== "workPhone"
      : field !== "studentYear" && field !== "anticipatedGraduation");
  const missingFields = applicableFields
    .filter((field) => !completeByField[field]);
  const completedCount = applicableFields.filter((field) => completeByField[field]).length;
  const snoozedUntil = profile.profilePromptSnoozedUntil
    ? new Date(profile.profilePromptSnoozedUntil)
    : null;
  const isSnoozed = Boolean(snoozedUntil && snoozedUntil.getTime() > now.getTime());
  const firstIncompleteStep = PROFILE_COMPLETION_STEPS.find((step) =>
    missingFields.some((field) => FIELD_STEP[field] === step),
  ) ?? null;

  return {
    isComplete: missingFields.length === 0,
    isSnoozed,
    shouldPrompt: missingFields.length > 0 && !isSnoozed,
    snoozedUntil: snoozedUntil?.toISOString() ?? null,
    completedCount,
    totalCount: applicableFields.length,
    missingFields,
    firstIncompleteStep,
    completeByField,
  };
}
