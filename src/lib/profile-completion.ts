export const PROFILE_COMPLETION_STEPS = ["EMAIL", "PHONES", "WISCARD", "APPAREL"] as const;

export type ProfileCompletionStep = (typeof PROFILE_COMPLETION_STEPS)[number];
export type ProfileCompletionField =
  | "campusEmail"
  | "athleticsEmail"
  | "personalPhone"
  | "workPhone"
  | "wiscard"
  | "clothingSize"
  | "shoeSize";

export type ProfileCompletionProfile = {
  email: string;
  athleticsEmail: string | null;
  phone: string | null;
  personalPhone: string | null;
  workPhone: string | null;
  workPhoneNotApplicable: boolean;
  wiscardCardNumber: string | null;
  wiscardIssueCode: string | null;
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
    clothingSize: Boolean(profile.topSizeFit) && hasText(profile.topSize),
    shoeSize: Boolean(profile.shoeSizeSystem) && hasText(profile.shoeSize),
  };
  const missingFields = (Object.keys(completeByField) as ProfileCompletionField[])
    .filter((field) => !completeByField[field]);
  const completedCount = Object.values(completeByField).filter(Boolean).length;
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
    totalCount: Object.keys(completeByField).length,
    missingFields,
    firstIncompleteStep,
    completeByField,
  };
}
