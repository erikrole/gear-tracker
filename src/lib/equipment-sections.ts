/**
 * Equipment section definitions for guided checkout picker.
 *
 * 5 tabs with DB-category batching:
 *   Cameras  ← "Cameras" category
 *   Lenses   ← "Lenses" category
 *   Batteries ← "Batteries" category
 *   Accessories ← "Monitors", "Audio", "Tripods" categories
 *   Others   ← "Lighting", "Media Storage", "Office" categories
 *
 * Classification priority:
 *   1. Asset's DB category name (via categoryId → Category.name)
 *   2. Fallback: keyword matching on asset `type` string
 */

export type EquipmentSectionKey =
  | "cameras"
  | "lenses"
  | "batteries"
  | "accessories"
  | "others";

export type EquipmentSection = {
  key: EquipmentSectionKey;
  label: string;
  description: string;
};

export const EQUIPMENT_SECTIONS: EquipmentSection[] = [
  { key: "cameras", label: "Cameras", description: "Camera bodies and camcorders" },
  { key: "lenses", label: "Lenses", description: "Camera lenses" },
  { key: "batteries", label: "Batteries", description: "Batteries, chargers, and power" },
  { key: "accessories", label: "Accessories", description: "Monitors, audio, and tripods" },
  { key: "others", label: "Others", description: "Lighting, media storage, and office" },
];

/** Index lookup for section ordering. */
export function sectionIndex(key: EquipmentSectionKey): number {
  return EQUIPMENT_SECTIONS.findIndex((s) => s.key === key);
}

/**
 * All tabs are always reachable (no forward-lock).
 */
export function isSectionReachable(
  _sectionKey: EquipmentSectionKey,
  _highestReachedKey: EquipmentSectionKey
): boolean {
  return true;
}

/**
 * Category name → equipment section mapping.
 * Keys are lowercased category names.
 */
const CATEGORY_MAP: Record<string, EquipmentSectionKey> = {
  // Cameras tab
  cameras: "cameras",
  camera: "cameras",
  "camera bodies": "cameras",
  bodies: "cameras",
  // Lenses tab
  lenses: "lenses",
  lens: "lenses",
  // Batteries tab
  batteries: "batteries",
  battery: "batteries",
  // Accessories tab (Monitors, Audio, Tripods)
  monitors: "accessories",
  monitor: "accessories",
  recorders: "accessories",
  audio: "accessories",
  microphones: "accessories",
  tripods: "accessories",
  tripod: "accessories",
  support: "accessories",
  // Others tab (Lighting, Media Storage, Office)
  lighting: "others",
  lights: "others",
  "media storage": "others",
  "media cards": "others",
  storage: "others",
  office: "others",
};

/**
 * Normalized keyword sets for type-based fallback classification.
 */
const BUCKET_KEYWORDS: Record<EquipmentSectionKey, string[]> = {
  cameras: [
    "camera", "camcorder", "cinema camera", "dslr", "mirrorless",
    "video camera", "camera body",
  ],
  lenses: ["lens", "lenses"],
  batteries: [
    "battery", "batteries", "charger", "power supply", "power",
    "v-mount", "vmount", "gold mount",
  ],
  accessories: [
    "monitor", "recorder", "rig", "cage", "gimbal", "stabilizer",
    "follow focus", "matte box", "accessory", "accessories",
    "transmitter", "receiver", "wireless",
    "microphone", "mic", "audio", "mixer", "headphone",
    "lavalier", "shotgun mic",
    "tripod", "monopod", "slider",
  ],
  others: [], // catch-all — never matched by keywords
};

/**
 * Classify an asset into an equipment section.
 * Checks category name first, then falls back to keyword matching on type.
 */
export function classifyAssetType(type: string, categoryName?: string | null): EquipmentSectionKey {
  // 1. Try category name mapping
  if (categoryName) {
    const catKey = CATEGORY_MAP[categoryName.toLowerCase().trim()];
    if (catKey) return catKey;
  }

  // 2. Fallback to keyword matching on type
  const normalized = type.toLowerCase().trim();
  const orderedKeys: EquipmentSectionKey[] = ["cameras", "lenses", "batteries", "accessories"];
  for (const key of orderedKeys) {
    for (const keyword of BUCKET_KEYWORDS[key]) {
      if (normalized.includes(keyword)) {
        return key;
      }
    }
  }

  return "others";
}

/**
 * Classify a bulk SKU category string into an equipment section.
 */
export function classifyBulkCategory(category: string, categoryName?: string | null): EquipmentSectionKey {
  return classifyAssetType(category, categoryName);
}

type SerializedAssetLike = { id: string; type: string; categoryName?: string | null; [k: string]: unknown };
type BulkSkuLike = { id: string; category: string; categoryName?: string | null; [k: string]: unknown };

/**
 * Group serialized assets by equipment section.
 */
export function groupAssetsBySection<T extends SerializedAssetLike>(
  assets: T[]
): Record<EquipmentSectionKey, T[]> {
  const groups: Record<EquipmentSectionKey, T[]> = {
    cameras: [],
    lenses: [],
    batteries: [],
    accessories: [],
    others: [],
  };

  for (const asset of assets) {
    const section = classifyAssetType(asset.type, asset.categoryName);
    groups[section].push(asset);
  }

  return groups;
}

/**
 * Group bulk SKUs by equipment section.
 */
export function groupBulkBySection<T extends BulkSkuLike>(
  skus: T[]
): Record<EquipmentSectionKey, T[]> {
  const groups: Record<EquipmentSectionKey, T[]> = {
    cameras: [],
    lenses: [],
    batteries: [],
    accessories: [],
    others: [],
  };

  for (const sku of skus) {
    const section = classifyBulkCategory(sku.category, sku.categoryName);
    groups[section].push(sku);
  }

  return groups;
}
