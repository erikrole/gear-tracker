/**
 * Prisma WHERE clause builders for equipment section filtering.
 *
 * Encodes the same classification logic as `classifyAssetType` in
 * equipment-sections.ts but as database-level filters for use in queries.
 */
import { Prisma } from "@prisma/client";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";

/** Category names that map to each section (lowercased for matching). */
const SECTION_CATEGORIES: Record<EquipmentSectionKey, string[]> = {
  cameras: ["cameras", "camera", "camera bodies", "bodies"],
  lenses: ["lenses", "lens"],
  batteries: ["batteries", "battery"],
  audio: ["audio", "microphones", "microphone", "recorders", "recorder", "wireless"],
  tripods: ["tripods", "tripod", "support"],
  lighting: ["lighting", "lights", "light"],
  other: [
    "monitors", "monitor", "media storage", "media cards", "storage", "office",
  ],
};

/** Type-field keywords for fallback classification (same as BUCKET_KEYWORDS). */
const SECTION_TYPE_KEYWORDS: Record<EquipmentSectionKey, string[]> = {
  cameras: [
    "camera", "camcorder", "cinema camera", "dslr", "mirrorless",
    "video camera", "camera body",
  ],
  lenses: ["lens", "lenses"],
  batteries: [
    "battery", "batteries", "charger", "power supply", "power",
    "v-mount", "vmount", "gold mount",
  ],
  audio: [
    "microphone", "mic", "audio", "mixer", "headphone",
    "lavalier", "shotgun mic", "recorder", "transmitter", "receiver", "wireless",
  ],
  tripods: ["tripod", "monopod", "slider"],
  lighting: ["lighting", "light", "led panel", "fresnel", "strobe"],
  other: [], // catch-all
};

/**
 * Build a Prisma WHERE clause that matches assets belonging to a section.
 *
 * For "other" (catch-all): matches assets NOT in any other section.
 */
export function sectionWhere(section: EquipmentSectionKey): Prisma.AssetWhereInput {
  if (section === "other") {
    // "Other" is the catch-all — assets not matching any specific section
    const excludeSections: EquipmentSectionKey[] = ["cameras", "lenses", "batteries", "audio", "tripods", "lighting"];
    const excludeClauses = excludeSections.map((s) => sectionMatchClause(s));
    return { NOT: { OR: excludeClauses } };
  }

  return sectionMatchClause(section);
}

/** Build a positive match clause for a non-catch-all section. */
function sectionMatchClause(section: EquipmentSectionKey): Prisma.AssetWhereInput {
  const categoryNames = SECTION_CATEGORIES[section];
  const typeKeywords = SECTION_TYPE_KEYWORDS[section];

  const conditions: Prisma.AssetWhereInput[] = [];

  // Match by category name (case-insensitive via IN on known values)
  if (categoryNames.length > 0) {
    conditions.push({
      category: { name: { in: categoryNames, mode: "insensitive" } },
    });
  }

  // Fallback: match by type keywords
  for (const keyword of typeKeywords) {
    conditions.push({
      type: { contains: keyword, mode: "insensitive" },
    });
  }

  return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

/** All section keys for iteration. */
export const ALL_SECTION_KEYS: EquipmentSectionKey[] = [
  "cameras", "lenses", "batteries", "audio", "tripods", "lighting", "other",
];
