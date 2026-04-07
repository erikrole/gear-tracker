export type ShiftConfig = {
  area: "VIDEO" | "PHOTO" | "GRAPHICS" | "COMMS";
  homeCount: number;
  awayCount: number;
};

export type SportConfig = {
  id: string;
  sportCode: string;
  active: boolean;
  callTimeBefore: number;
  callTimeAfter: number;
  shiftConfigs: ShiftConfig[];
};

export const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

export const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

export function defaultShiftConfigs(): ShiftConfig[] {
  return AREAS.map((area) => ({ area, homeCount: 1, awayCount: 1 }));
}

/** Big 6 sports that are NOT grouped by gender */
export const BIG_6 = new Set(["FB", "MBB", "MHKY", "WHKY", "WBB", "VB"]);

export type SportGroup = {
  label: string;
  codes: string[];
};

/**
 * Grouping rules:
 * - Big 6 are standalone (each gets its own card)
 * - All other sports group men's/women's variants together
 * - Standalone sports with no pairing (Wrestling, Softball) stay solo
 */
export const SPORT_GROUPS: SportGroup[] = [
  // Big 6 — standalone
  { label: "Football", codes: ["FB"] },
  { label: "Men's Basketball", codes: ["MBB"] },
  { label: "Women's Basketball", codes: ["WBB"] },
  { label: "Men's Hockey", codes: ["MHKY"] },
  { label: "Women's Hockey", codes: ["WHKY"] },
  { label: "Volleyball", codes: ["VB"] },
  // Grouped sports
  { label: "Cross Country", codes: ["MXC", "WXC"] },
  { label: "Golf", codes: ["MGOLF", "WGOLF"] },
  { label: "Rowing", codes: ["MROW", "WROW", "LROW"] },
  { label: "Soccer", codes: ["MSOC", "WSOC"] },
  { label: "Swimming & Diving", codes: ["MSWIM", "WSWIM"] },
  { label: "Tennis", codes: ["MTEN", "WTEN"] },
  { label: "Track & Field", codes: ["MTRACK", "WTRACK"] },
  // Solo — no gender pair
  { label: "Wrestling", codes: ["WRES"] },
  { label: "Softball", codes: ["SB"] },
];
