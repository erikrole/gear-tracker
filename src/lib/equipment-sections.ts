/**
 * Equipment section definitions for guided checkout picker.
 *
 * Maps asset type/category to ordered equipment sections:
 * 1. Bodies
 * 2. Lenses
 * 3. Batteries
 * 4. Accessories
 * 5. Others
 *
 * Progression is locked forward: users must advance in order.
 * Users may always return to previously reached sections.
 *
 * Uses the `type` field on serialized assets (sourced from Cheqroom "Category")
 * and the `category` field on bulk SKUs.
 */

export type EquipmentSectionKey =
  | "camera_body"
  | "lenses"
  | "batteries"
  | "accessories"
  | "other";

export type EquipmentSection = {
  key: EquipmentSectionKey;
  label: string;
  description: string;
};

export const EQUIPMENT_SECTIONS: EquipmentSection[] = [
  { key: "camera_body", label: "Bodies", description: "Select camera bodies" },
  { key: "lenses", label: "Lenses", description: "Select lenses" },
  { key: "batteries", label: "Batteries", description: "Batteries, chargers, and power" },
  { key: "accessories", label: "Accessories", description: "Monitors, rigs, and camera accessories" },
  { key: "other", label: "Others", description: "Cables, audio, tripods, and other gear" },
];

/** Index lookup for section ordering. */
export function sectionIndex(key: EquipmentSectionKey): number {
  return EQUIPMENT_SECTIONS.findIndex((s) => s.key === key);
}

/**
 * Check if a section tab should be enabled given the highest section the user has reached.
 * A section is reachable if its index <= highestReachedIndex.
 */
export function isSectionReachable(
  sectionKey: EquipmentSectionKey,
  highestReachedKey: EquipmentSectionKey
): boolean {
  return sectionIndex(sectionKey) <= sectionIndex(highestReachedKey);
}

/**
 * Normalized keyword sets for each section bucket.
 * Matching is case-insensitive and uses substring containment.
 */
const BUCKET_KEYWORDS: Record<EquipmentSectionKey, string[]> = {
  camera_body: [
    "camera", "camcorder", "cinema camera", "dslr", "mirrorless",
    "video camera", "camera body",
  ],
  accessories: [
    "monitor", "recorder", "rig", "cage", "gimbal", "stabilizer",
    "follow focus", "matte box", "accessory", "accessories",
    "transmitter", "receiver", "wireless",
  ],
  lenses: [
    "lens", "lenses",
  ],
  batteries: [
    "battery", "batteries", "charger", "power supply", "power",
    "v-mount", "vmount", "gold mount",
  ],
  other: [], // catch-all — never matched by keywords
};

/**
 * Classify a serialized asset type string into an equipment section.
 */
export function classifyAssetType(type: string): EquipmentSectionKey {
  const normalized = type.toLowerCase().trim();

  // Check each bucket in priority order (not "other")
  const orderedKeys: EquipmentSectionKey[] = ["camera_body", "lenses", "batteries", "accessories"];
  for (const key of orderedKeys) {
    for (const keyword of BUCKET_KEYWORDS[key]) {
      if (normalized.includes(keyword)) {
        return key;
      }
    }
  }

  return "other";
}

/**
 * Classify a bulk SKU category string into an equipment section.
 */
export function classifyBulkCategory(category: string): EquipmentSectionKey {
  return classifyAssetType(category); // Same logic applies
}

type SerializedAssetLike = { id: string; type: string; [k: string]: unknown };
type BulkSkuLike = { id: string; category: string; [k: string]: unknown };

/**
 * Group serialized assets by equipment section.
 */
export function groupAssetsBySection<T extends SerializedAssetLike>(
  assets: T[]
): Record<EquipmentSectionKey, T[]> {
  const groups: Record<EquipmentSectionKey, T[]> = {
    camera_body: [],
    accessories: [],
    lenses: [],
    batteries: [],
    other: [],
  };

  for (const asset of assets) {
    const section = classifyAssetType(asset.type);
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
    camera_body: [],
    accessories: [],
    lenses: [],
    batteries: [],
    other: [],
  };

  for (const sku of skus) {
    const section = classifyBulkCategory(sku.category);
    groups[section].push(sku);
  }

  return groups;
}
