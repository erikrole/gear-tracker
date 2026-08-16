import { z } from "zod";

export const SIGNATURE_MBB_SPORT_CODE = "MBB" as const;
export const SIGNATURE_FOOTBALL_SPORT_CODE = "FB" as const;
export const SIGNATURE_VOLLEYBALL_SPORT_CODE = "VB" as const;
export const SIGNATURE_CREATIVE_STAFF_SPORT_CODE = "CREATIVE" as const;
export const SIGNATURE_AD_HOC_SPORT_CODE = "ADHOC" as const;
export const SIGNATURE_IMPORTED_SPORT_CODES = [
  SIGNATURE_MBB_SPORT_CODE,
  SIGNATURE_FOOTBALL_SPORT_CODE,
  SIGNATURE_VOLLEYBALL_SPORT_CODE,
] as const;
export const SIGNATURE_COLLECTION_SPORT_CODES = [
  ...SIGNATURE_IMPORTED_SPORT_CODES,
  SIGNATURE_CREATIVE_STAFF_SPORT_CODE,
  SIGNATURE_AD_HOC_SPORT_CODE,
] as const;
export const DEFAULT_SIGNATURE_SEASON = "2026-27";
export const SIGNATURE_SOURCE_KEY = "UW_BADGERS_MBB";
export const SIGNATURE_PARSER_VERSION = "uwbadgers-mbb-v4";

export type SignatureImportedSportCode = (typeof SIGNATURE_IMPORTED_SPORT_CODES)[number];

export const SIGNATURE_ROSTER_SOURCE_CONFIG: Record<SignatureImportedSportCode, {
  sourceKey: string;
  parserVersion: string;
  rosterPath: string;
  usesStartYearPath: boolean;
}> = {
  [SIGNATURE_MBB_SPORT_CODE]: {
    sourceKey: "UW_BADGERS_MBB",
    parserVersion: SIGNATURE_PARSER_VERSION,
    rosterPath: "/sports/mens-basketball/roster",
    usesStartYearPath: false,
  },
  [SIGNATURE_FOOTBALL_SPORT_CODE]: {
    sourceKey: "UW_BADGERS_FB",
    parserVersion: "uwbadgers-fb-v1",
    rosterPath: "/sports/football/roster",
    usesStartYearPath: true,
  },
  [SIGNATURE_VOLLEYBALL_SPORT_CODE]: {
    sourceKey: "UW_BADGERS_VB",
    parserVersion: "uwbadgers-vb-v1",
    rosterPath: "/sports/womens-volleyball/roster",
    usesStartYearPath: true,
  },
};

export function getSignatureRosterSourceConfig(sportCode: string) {
  const source = SIGNATURE_ROSTER_SOURCE_CONFIG[sportCode as SignatureImportedSportCode];
  if (!source) throw new Error(`Unsupported signature roster sport: ${sportCode}`);
  return source;
}
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

export const captureSaveRequestSchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
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
  return group !== "SUPPORT_STAFF";
}
