/**
 * Equipment section definitions for guided checkout picker.
 *
 * 9 tabs mapped to inventory categories:
 *   Cameras, Lenses, Batteries, Audio, Monitors, Tripods, Lighting, Media Storage, Office
 *
 * Classification priority:
 *   1. Asset's DB category name (via categoryId → Category.name)
 *   2. Fallback: keyword matching on asset `type` string
 */

export type EquipmentSectionKey =
  | "cameras"
  | "lenses"
  | "batteries"
  | "audio"
  | "monitors"
  | "tripods"
  | "lighting"
  | "media_storage"
  | "office";

export type EquipmentSection = {
  key: EquipmentSectionKey;
  label: string;
  description: string;
};

export const EQUIPMENT_SECTIONS: EquipmentSection[] = [
  { key: "cameras", label: "Cameras", description: "Camera bodies and camcorders" },
  { key: "lenses", label: "Lenses", description: "Camera lenses" },
  { key: "batteries", label: "Batteries", description: "Batteries, chargers, and power" },
  { key: "audio", label: "Audio", description: "Microphones, mixers, and audio gear" },
  { key: "monitors", label: "Monitors", description: "Monitors and recorders" },
  { key: "tripods", label: "Tripods", description: "Tripods and support" },
  { key: "lighting", label: "Lighting", description: "Lights, reflectors, and diffusers" },
  { key: "media_storage", label: "Media Storage", description: "Cards, drives, and readers" },
  { key: "office", label: "Office", description: "Office supplies and misc gear" },
];

/** Index lookup for section ordering. */
export function sectionIndex(key: EquipmentSectionKey): number {
  return EQUIPMENT_SECTIONS.findIndex((s) => s.key === key);
}

/**
 * Check if a section tab should be enabled given the highest section the user has reached.
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
 * Keys are lowercased category names (or parent category names).
 */
const CATEGORY_MAP: Record<string, EquipmentSectionKey> = {
  cameras: "cameras",
  camera: "cameras",
  "camera bodies": "cameras",
  bodies: "cameras",
  lenses: "lenses",
  lens: "lenses",
  batteries: "batteries",
  battery: "batteries",
  audio: "audio",
  microphones: "audio",
  monitors: "monitors",
  monitor: "monitors",
  recorders: "monitors",
  tripods: "tripods",
  tripod: "tripods",
  support: "tripods",
  lighting: "lighting",
  lights: "lighting",
  "media storage": "media_storage",
  "media cards": "media_storage",
  storage: "media_storage",
  office: "office",
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
  audio: [
    "microphone", "mic", "audio", "mixer", "headphone", "speaker",
    "wireless audio", "lavalier", "shotgun mic",
  ],
  monitors: [
    "monitor", "recorder", "transmitter", "receiver", "wireless video",
  ],
  tripods: [
    "tripod", "monopod", "gimbal", "stabilizer", "rig", "cage",
    "follow focus", "matte box", "slider",
  ],
  lighting: [
    "light", "lighting", "led panel", "reflector", "diffuser",
    "gel", "softbox", "fresnel", "strobe",
  ],
  media_storage: [
    "card", "cf card", "sd card", "ssd", "hard drive", "reader",
    "card reader", "storage", "media",
  ],
  office: [], // catch-all — never matched by keywords
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
  const orderedKeys: EquipmentSectionKey[] = [
    "cameras", "lenses", "batteries", "audio", "monitors", "tripods", "lighting", "media_storage",
  ];
  for (const key of orderedKeys) {
    for (const keyword of BUCKET_KEYWORDS[key]) {
      if (normalized.includes(keyword)) {
        return key;
      }
    }
  }

  return "office";
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
    audio: [],
    monitors: [],
    tripods: [],
    lighting: [],
    media_storage: [],
    office: [],
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
    audio: [],
    monitors: [],
    tripods: [],
    lighting: [],
    media_storage: [],
    office: [],
  };

  for (const sku of skus) {
    const section = classifyBulkCategory(sku.category, sku.categoryName);
    groups[section].push(sku);
  }

  return groups;
}
