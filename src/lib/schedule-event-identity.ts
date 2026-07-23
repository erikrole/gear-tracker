/** Known team-name prefixes to strip from ICS summaries (case-insensitive). */
const SOURCE_TEAM_PREFIXES = ["Wisconsin Athletics", "Wisconsin Badgers"];

export type SourceEventResult = "WIN" | "LOSS";

/** Extract the upstream game result without coupling source evidence to display titles. */
export function extractSourceEventResult(raw: string): SourceEventResult | null {
  const match = raw.trim().match(/^\[(W|L)\](?=\s|$)/i);
  if (!match) return null;
  return match[1]!.toUpperCase() === "W" ? "WIN" : "LOSS";
}

/** Words that are event metadata, not opponent identity. */
const TRAILING_EVENT_TYPE_PATTERN =
  /\s*\((home|away|neutral|exhibition|scrimmage)\)\s*$/i;

/** Common source spelling aliases for venue/location text. */
const VENUE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bWis\./gi, "WI"],
  [/\bWisc\./gi, "WI"],
  [/\bMcclimon\b/gi, "McClimon"],
];

export function cleanSourceSummary(raw: string): string {
  let cleaned = raw.trim().replace(/^\s*\[[A-Z]\]\s*/i, "");
  for (const prefix of SOURCE_TEAM_PREFIXES) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim().replace(/^[-–—:]\s*/, "");
      break;
    }
  }

  const normalized = cleaned
    .replace(TRAILING_EVENT_TYPE_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || raw.trim();
}

export function normalizeOpponentName(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const [primary = "", ...qualifierParts] = raw
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s*[-–—]\s+/);

  let cleaned = primary
    .replace(/^(?:#\d+|No\.?\s*\d+|RV)\s+/i, "")
    .replace(/^University of\s+/i, "")
    .replace(/\s+University$/i, "")
    .replace(TRAILING_EVENT_TYPE_PATTERN, "")
    .trim();

  if (!cleaned) cleaned = primary.trim();

  const qualifier = qualifierParts.join(" - ").trim();
  return [cleaned, qualifier].filter(Boolean).join(" - ") || null;
}

export function normalizeVenueText(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let cleaned = raw.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of VENUE_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = cleaned
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

export function buildVenueSearchText(...values: Array<string | null | undefined>): string {
  return values
    .map((value) => normalizeVenueText(value) ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
