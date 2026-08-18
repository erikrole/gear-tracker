import { z } from "zod";

export const SIGNATURE_MBB_SPORT_CODE = "MBB" as const;
export const SIGNATURE_FOOTBALL_SPORT_CODE = "FB" as const;
export const SIGNATURE_VOLLEYBALL_SPORT_CODE = "VB" as const;
export const SIGNATURE_MENS_HOCKEY_SPORT_CODE = "MHKY" as const;
export const SIGNATURE_WOMENS_HOCKEY_SPORT_CODE = "WHKY" as const;
export const SIGNATURE_WBB_SPORT_CODE = "WBB" as const;
export const SIGNATURE_WRESTLING_SPORT_CODE = "WRES" as const;
export const SIGNATURE_CREATIVE_STAFF_SPORT_CODE = "CREATIVE" as const;
export const SIGNATURE_AD_HOC_SPORT_CODE = "ADHOC" as const;
export type SignatureRosterSourceConfig = {
  sourceKey: string;
  parserVersion: string;
  rosterPath: string;
  usesStartYearPath: boolean;
};

export const SIGNATURE_SPORT_REGISTRY = {
  [SIGNATURE_MBB_SPORT_CODE]: {
    label: "Men’s Basketball",
    source: {
      sourceKey: "UW_BADGERS_MBB",
      parserVersion: "uwbadgers-mbb-v5",
      rosterPath: "/sports/mens-basketball/roster",
      usesStartYearPath: false,
    },
  },
  [SIGNATURE_FOOTBALL_SPORT_CODE]: {
    label: "Football",
    source: {
      sourceKey: "UW_BADGERS_FB",
      parserVersion: "uwbadgers-fb-v2",
      rosterPath: "/sports/football/roster",
      usesStartYearPath: true,
    },
  },
  [SIGNATURE_VOLLEYBALL_SPORT_CODE]: {
    label: "Volleyball",
    source: {
      sourceKey: "UW_BADGERS_VB",
      parserVersion: "uwbadgers-vb-v2",
      rosterPath: "/sports/womens-volleyball/roster",
      usesStartYearPath: true,
    },
  },
  [SIGNATURE_MENS_HOCKEY_SPORT_CODE]: {
    label: "Men’s Hockey",
    source: {
      sourceKey: "UW_BADGERS_MHKY",
      parserVersion: "uwbadgers-mhky-v2",
      rosterPath: "/sports/mens-ice-hockey/roster",
      usesStartYearPath: false,
    },
  },
  [SIGNATURE_WOMENS_HOCKEY_SPORT_CODE]: {
    label: "Women’s Hockey",
    source: {
      sourceKey: "UW_BADGERS_WHKY",
      parserVersion: "uwbadgers-whky-v2",
      rosterPath: "/sports/womens-ice-hockey/roster",
      usesStartYearPath: false,
    },
  },
  [SIGNATURE_WBB_SPORT_CODE]: {
    label: "Women’s Basketball",
    source: {
      sourceKey: "UW_BADGERS_WBB",
      parserVersion: "uwbadgers-wbb-v2",
      rosterPath: "/sports/womens-basketball/roster",
      usesStartYearPath: false,
    },
  },
  [SIGNATURE_WRESTLING_SPORT_CODE]: {
    label: "Wrestling",
    source: {
      sourceKey: "UW_BADGERS_WRES",
      parserVersion: "uwbadgers-wres-v2",
      rosterPath: "/sports/wrestling/roster",
      usesStartYearPath: false,
    },
  },
  [SIGNATURE_CREATIVE_STAFF_SPORT_CODE]: {
    label: "Creative Staff",
  },
  [SIGNATURE_AD_HOC_SPORT_CODE]: {
    label: "Ad-hoc signatures",
  },
} as const;

type SignatureSportRegistry = typeof SIGNATURE_SPORT_REGISTRY;
export type SignatureCollectionSportCode = keyof SignatureSportRegistry;
export type SignatureImportedSportCode = {
  [SportCode in SignatureCollectionSportCode]:
    SignatureSportRegistry[SportCode] extends { source: SignatureRosterSourceConfig } ? SportCode : never;
}[SignatureCollectionSportCode];

export const SIGNATURE_IMPORTED_SPORT_CODES = Object.keys(SIGNATURE_SPORT_REGISTRY)
  .filter((sportCode) => "source" in SIGNATURE_SPORT_REGISTRY[sportCode as SignatureCollectionSportCode]) as [
  SignatureImportedSportCode,
  ...SignatureImportedSportCode[],
];
export const SIGNATURE_COLLECTION_SPORT_CODES = Object.keys(SIGNATURE_SPORT_REGISTRY) as [
  SignatureCollectionSportCode,
  ...SignatureCollectionSportCode[],
];
export const DEFAULT_SIGNATURE_SEASON = "2026-27";

export function getSignatureRosterSourceConfig(sportCode: string) {
  const definition = SIGNATURE_SPORT_REGISTRY[sportCode as SignatureCollectionSportCode];
  if (!definition || !("source" in definition)) throw new Error(`Unsupported signature roster sport: ${sportCode}`);
  return definition.source;
}

export function signatureCollectionTitle(sportCode: string): string {
  return SIGNATURE_SPORT_REGISTRY[sportCode as SignatureCollectionSportCode]?.label ?? sportCode;
}

export const SIGNATURE_SOURCE_KEY = getSignatureRosterSourceConfig(SIGNATURE_MBB_SPORT_CODE).sourceKey;
export const SIGNATURE_PARSER_VERSION = getSignatureRosterSourceConfig(SIGNATURE_MBB_SPORT_CODE).parserVersion;
export const SIGNATURE_MAX_PAYLOAD_BYTES = 1_000_000;
export const SIGNATURE_MAX_STROKES = 32;
export const SIGNATURE_MAX_POINTS_PER_STROKE = 2_000;
export const SIGNATURE_MAX_COORDINATE = 5_000;

export const SIGNATURE_MEMBER_GROUPS = [
  "PLAYER",
  "COACHING_STAFF",
  "CREATIVE_STAFF",
  "SUPPORT_STAFF",
] as const;

export type SignatureMemberGroup = (typeof SIGNATURE_MEMBER_GROUPS)[number];

export const penSettingsSchema = z.object({
  strokeColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color"),
  strokeWidth: z.number().finite().min(1).max(24),
  cropPadding: z.number().finite().min(0).max(128),
  maxWidth: z.number().int().min(128).max(2_000),
  maxHeight: z.number().int().min(128).max(2_000),
});

export type SignaturePenSettings = z.infer<typeof penSettingsSchema>;

export const DEFAULT_SIGNATURE_PEN_SETTINGS: SignaturePenSettings = {
  strokeColor: "#111827",
  strokeWidth: 4,
  cropPadding: 24,
  maxWidth: 1_600,
  maxHeight: 900,
};

export const signaturePointSchema = z.object({
  x: z.number().finite().min(0).max(SIGNATURE_MAX_COORDINATE),
  y: z.number().finite().min(0).max(SIGNATURE_MAX_COORDINATE),
});

export const signatureStrokeSchema = z.object({
  points: z
    .array(signaturePointSchema)
    .min(1)
    .max(SIGNATURE_MAX_POINTS_PER_STROKE),
});

export const signatureSaveRequestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{16,100}$/);

export const captureSaveRequestSchema = z.object({
  requestId: signatureSaveRequestIdSchema,
  expectedCaptureVersion: z.number().int().min(0),
  settingsVersion: z.number().int().min(1),
  strokes: z.array(signatureStrokeSchema).min(1).max(SIGNATURE_MAX_STROKES),
});

export type SignatureStroke = z.infer<typeof signatureStrokeSchema>;
export type CaptureSaveRequest = z.infer<typeof captureSaveRequestSchema>;

export const signatureRosterEntrySchema = z.object({
  sourceExternalId: z.string().min(1).max(160),
  sourceProfileUrl: z.string().url().max(500),
  name: z.string().trim().min(1).max(160),
  normalizedName: z.string().min(1).max(160),
  jerseyNumber: z.number().int().min(0).max(999).nullable(),
  roleGroup: z.enum(SIGNATURE_MEMBER_GROUPS),
  title: z.string().trim().max(160).nullable(),
  // Older persisted snapshots do not have this field; keeping it optional
  // makes them replayable while new imports can seed the player profile form.
  hometown: z.string().trim().max(160).nullable().optional(),
});

export type SignatureRosterEntry = z.infer<typeof signatureRosterEntrySchema>;

export const signatureSeasonSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Season must use YYYY-YY format");

export const signatureCollectionInputSchema = z.object({
  sportCode: z.enum(SIGNATURE_COLLECTION_SPORT_CODES),
  season: signatureSeasonSchema,
});

export const signatureRosterImportSchema = z.object({
  sportCode: z.enum(SIGNATURE_IMPORTED_SPORT_CODES),
  season: signatureSeasonSchema,
});

export const signatureCreativeStaffCollectionSchema = z.object({
  season: signatureSeasonSchema,
});

export const signatureAdHocMemberSchema = z.object({
  season: signatureSeasonSchema,
  name: z.string().trim().min(1, "Name is required").max(160),
  category: z.string().trim().min(1, "Sport or category is required").max(160),
});

function isValidSignatureDateOnly(value: string) {
  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const signatureBirthdaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must use YYYY-MM-DD format")
  .refine(isValidSignatureDateOnly, "Enter a valid birthday");

const signatureHandleValueSchema = z
  .string()
  .trim()
  .max(80, "Handle must be 80 characters or fewer")
  .transform((value) => value.replace(/^@+/, ""))
  .refine((value) => /^[A-Za-z0-9._-]+$/.test(value), "Enter a handle, not a link");

export const signatureHandleSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  signatureHandleValueSchema.nullable(),
);

export const signatureAthleteProfileSchema = z.object({
  expectedCollectionVersion: z.number().int().min(1),
  birthday: signatureBirthdaySchema,
  hometown: z.string().trim().min(1, "Hometown is required").max(160, "Hometown must be 160 characters or fewer"),
  instagramHandle: signatureHandleSchema.optional(),
  tiktokHandle: signatureHandleSchema.optional(),
  xHandle: signatureHandleSchema.optional(),
});

export type SignatureAthleteProfile = z.infer<typeof signatureAthleteProfileSchema>;

export const signatureSettingsUpdateSchema = penSettingsSchema.extend({
  expectedSettingsVersion: z.number().int().min(1),
  expectedCollectionVersion: z.number().int().min(1),
});

export const signatureRequiredUpdateSchema = z.object({
  required: z.boolean(),
  expectedCollectionVersion: z.number().int().min(1),
});

export const signatureApplySchema = z.object({
  snapshotId: z.string().cuid(),
  expectedCollectionVersion: z.number().int().min(1),
});

export const signatureCollectionVersionSchema = z.object({
  expectedCollectionVersion: z.number().int().min(1),
});

export function normalizeSignatureName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function isRequiredSignatureGroup(group: SignatureMemberGroup): boolean {
  return group === "PLAYER";
}
