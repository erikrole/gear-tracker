/** UW Athletics sport codes */
export const SPORT_CODES = [
  { code: "FB", label: "Football" },
  { code: "MBB", label: "Men's Basketball" },
  { code: "WBB", label: "Women's Basketball" },
  { code: "VB", label: "Volleyball" },
  { code: "MHO", label: "Men's Hockey" },
  { code: "WHO", label: "Women's Hockey" },
  { code: "WSOC", label: "Women's Soccer" },
  { code: "SB", label: "Softball" },
  { code: "BASE", label: "Baseball" },
  { code: "WRES", label: "Wrestling" },
  { code: "SWIM", label: "Swimming & Diving" },
  { code: "TF", label: "Track & Field" },
  { code: "XC", label: "Cross Country" },
  { code: "GOLF", label: "Golf" },
  { code: "ROW", label: "Rowing" },
  { code: "TEN", label: "Tennis" },
  { code: "GYM", label: "Gymnastics" },
] as const;

export type SportCode = (typeof SPORT_CODES)[number]["code"];

export function sportLabel(code: string): string {
  return SPORT_CODES.find((s) => s.code === code)?.label ?? code;
}

/**
 * Generate a checkout title from an event.
 * - Home: "{sportCode} vs {opponent}"
 * - Away: "{sportCode} at {opponent}"
 * - Neutral/unknown: "{sportCode} vs {opponent} (Neutral)"
 */
export function generateEventTitle(
  sportCode: string,
  opponent: string | null | undefined,
  isHome: boolean | null | undefined
): string {
  const opp = opponent || "TBD";
  if (isHome === true) return `${sportCode} vs ${opp}`;
  if (isHome === false) return `${sportCode} at ${opp}`;
  return `${sportCode} vs ${opp} (Neutral)`;
}
