/** Shift area definitions — shared between schedule and sports-settings domains */

export const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};
