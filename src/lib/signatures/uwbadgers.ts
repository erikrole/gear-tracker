import { createHash } from "node:crypto";
import {
  getSignatureRosterSourceConfig,
  SIGNATURE_FOOTBALL_SPORT_CODE,
  SIGNATURE_MENS_HOCKEY_SPORT_CODE,
  SIGNATURE_MBB_SPORT_CODE,
  SIGNATURE_WOMENS_HOCKEY_SPORT_CODE,
  SIGNATURE_PARSER_VERSION,
  isRequiredSignatureGroup,
  normalizeSignatureName,
  signatureRosterEntrySchema,
  signatureRosterImportSchema,
  type SignatureImportedSportCode,
  type SignatureMemberGroup,
  type SignatureRosterEntry,
} from "./types";

export const UW_BADGERS_ORIGIN = "https://uwbadgers.com";
const ALLOWED_HOSTS = new Set(["uwbadgers.com", "www.uwbadgers.com"]);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export function buildUWBadgersRosterUrl(sportCode: string, season: string): string {
  const parsed = signatureRosterImportSchema.parse({ sportCode, season });
  const source = getSignatureRosterSourceConfig(parsed.sportCode);
  const sourceSeason = source.usesStartYearPath ? parsed.season.slice(0, 4) : parsed.season;
  return `${UW_BADGERS_ORIGIN}${source.rosterPath}/${sourceSeason}`;
}

export function isAllowedUWBadgersUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalProfileUrl(href: string, rosterPath: string): string | null {
  try {
    const url = new URL(href, UW_BADGERS_ORIGIN);
    if (!isAllowedUWBadgersUrl(url.toString())) return null;
    if (!url.pathname.includes(`${rosterPath}/`)) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    const rosterIndex = segments.indexOf("roster");
    const profileSegments = rosterIndex >= 0 ? segments.slice(rosterIndex + 1) : [];
    if (profileSegments.length === 0 || /^\d{4}-\d{2}$/.test(profileSegments.at(-1) ?? "")) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function externalIdFromProfileUrl(profileUrl: string): string {
  const path = new URL(profileUrl).pathname;
  const numericSegment = path.split("/").findLast((segment) => /^\d+$/.test(segment));
  return numericSegment ?? path;
}

function headingGroup(text: string): SignatureMemberGroup {
  const normalized = text.toLocaleLowerCase("en-US");
  if (normalized.includes("support staff") || normalized.includes("support")) return "SUPPORT_STAFF";
  if (normalized.includes("coaching") || normalized.includes("coaches") || normalized.includes("staff")) return "COACHING_STAFF";
  return "PLAYER";
}

function profileRoleGroup(profileUrl: string): SignatureMemberGroup | null {
  const segments = new URL(profileUrl).pathname.split("/").filter(Boolean);
  const rosterIndex = segments.indexOf("roster");
  const section = segments[rosterIndex + 1]?.toLocaleLowerCase("en-US");
  if (section === "coaches" || section === "coaching" || section === "coaching-staff") return "COACHING_STAFF";
  if (section === "staff" || section === "support" || section === "support-staff") return "SUPPORT_STAFF";
  return null;
}

function structuralGroupBefore(html: string, index: number): SignatureMemberGroup | null {
  const markers = [...html.slice(0, index).matchAll(/<(?:section|div)\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)];
  const marker = markers.at(-1)?.[1]?.toLocaleLowerCase("en-US");
  if (!marker) return null;
  if (marker.includes("support-staff") || marker === "support") return "SUPPORT_STAFF";
  if (marker.includes("coaching") || marker.includes("coaches")) return "COACHING_STAFF";
  if (marker === "players" || marker.includes("player-roster")) return "PLAYER";
  return null;
}

function extractJerseyNumber(context: string): number | null {
  const match = stripTags(context).match(/(?:jersey\s*(?:number|no)?|number|no\.?|#)\s*[:#-]?\s*(\d{1,3})/i);
  return match ? Number(match[1]) : null;
}

const PLAYER_POSITION_LABELS: Record<string, string> = {
  C: "Center",
  F: "Forward",
  G: "Guard",
  ATH: "Athlete",
  CB: "Cornerback",
  DB: "Defensive Back",
  DL: "Defensive Line",
  K: "Kicker",
  L: "Libero",
  LB: "Linebacker",
  "L/DS": "Libero/Defensive Specialist",
  MB: "Middle Blocker",
  OLB: "Outside Linebacker",
  OH: "Outside Hitter",
  P: "Punter",
  QB: "Quarterback",
  RB: "Running Back",
  RS: "Right Side",
  S: "Setter",
  TE: "Tight End",
  WR: "Wide Receiver",
  PG: "Point Guard",
  HWT: "Heavyweight",
};

const PLAYER_YEAR_LABELS: Record<string, string> = {
  FR: "Freshman",
  FRESHMAN: "Freshman",
  "R-FR": "Redshirt Freshman",
  SO: "Sophomore",
  SOPHOMORE: "Sophomore",
  "R-SO": "Redshirt Sophomore",
  JR: "Junior",
  JUNIOR: "Junior",
  "R-JR": "Redshirt Junior",
  SR: "Senior",
  SENIOR: "Senior",
  "R-SR": "Redshirt Senior",
  GR: "Graduate",
  GRAD: "Graduate",
  GRADUATE: "Graduate",
  "6TH": "Sixth Year",
  SIXTH: "Sixth Year",
};

function normalizedPlayerLabel(value: string, labels: Record<string, string>): string {
  const normalized = value.trim().replace(/\.$/, "").toLocaleUpperCase("en-US");
  return labels[normalized] ?? value.trim().replace(/\.$/, "");
}

function extractPlayerTitle(context: string, sportCode: SignatureImportedSportCode): string | null {
  const text = stripTags(context);
  const details = text.match(/position\s*[:\-]?\s*([a-z0-9][a-z0-9/.-]{0,24})\s+academic\s+year\s*[:\-]?\s*([a-z0-9]+(?:-[a-z0-9]+)?\.?)/i);
  if (!details?.[1] || !details[2]) return null;

  const rawPosition = details[1].trim().toLocaleUpperCase("en-US");
  const positionLabels = sportCode === SIGNATURE_FOOTBALL_SPORT_CODE
    ? { ...PLAYER_POSITION_LABELS, S: "Safety" }
    : sportCode === SIGNATURE_MENS_HOCKEY_SPORT_CODE || sportCode === SIGNATURE_WOMENS_HOCKEY_SPORT_CODE
      ? { ...PLAYER_POSITION_LABELS, D: "Defenseman", G: "Goaltender", F: "Forward" }
      : PLAYER_POSITION_LABELS;
  const position = positionLabels[rawPosition] ?? rawPosition
    .split("/")
    .map((part) => normalizedPlayerLabel(part, positionLabels))
    .join("/");
  const academicYear = normalizedPlayerLabel(details[2].trim(), PLAYER_YEAR_LABELS);
  return `${position} • ${academicYear}`.slice(0, 160);
}

function extractTitle(context: string, group: SignatureMemberGroup, sportCode: SignatureImportedSportCode): string | null {
  if (group === "PLAYER") return extractPlayerTitle(context, sportCode);

  const structuredPosition = context.match(/<div\b[^>]*class=["'][^"']*s-person-details__position[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (structuredPosition) {
    const title = stripTags(structuredPosition);
    if (title) return title.slice(0, 160);
  }
  const text = stripTags(context);
  const match = text.match(/\b((?:(?:head|assistant|associate|defensive|offensive|special teams|recruiting|director|strength|athletic|operations|video|graduate)[^|,;]{0,55}\b(?:coach|coordinator|director|manager|analyst|staff)))\b/i);
  return match?.[1] ? stripTags(match[1]).slice(0, 160) : null;
}

function headingBefore(html: string, index: number): string {
  const headings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .filter((heading) => (heading.index ?? -1) < index)
    .at(-1);
  return headings?.[1] ? stripTags(headings[1]) : "Players";
}

export function parseUWBadgersRosterHtml(
  html: string,
  sportCode: SignatureImportedSportCode = SIGNATURE_MBB_SPORT_CODE,
): SignatureRosterEntry[] {
  if (html.length > MAX_SOURCE_BYTES) throw new Error("UWBadgers roster response is too large");
  const source = getSignatureRosterSourceConfig(sportCode);
  const candidates = new Map<string, SignatureRosterEntry>();
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = match[2];
    const anchorText = match[3];
    if (!href || !anchorText) continue;
    const profileUrl = canonicalProfileUrl(href, source.rosterPath);
    if (!profileUrl) continue;
    const name = stripTags(anchorText);
    if (/^(?:jersey\s+number|full\s+bio|expand\s+for|\d+)\b/i.test(name)) continue;
    if (!name || name.length > 160) continue;
    const index = match.index ?? 0;
    const context = html.slice(Math.max(0, index - 500), Math.min(html.length, index + match[0].length + 700));
    const roleGroup = profileRoleGroup(profileUrl) ?? structuralGroupBefore(html, index) ?? headingGroup(headingBefore(html, index));
    const entry = signatureRosterEntrySchema.parse({
      sourceExternalId: externalIdFromProfileUrl(profileUrl),
      sourceProfileUrl: profileUrl,
      name,
      normalizedName: normalizeSignatureName(name),
      jerseyNumber: extractJerseyNumber(context),
      roleGroup,
      title: extractTitle(context, roleGroup, sportCode),
    });
    const existing = candidates.get(entry.sourceExternalId);
    if (!existing) {
      candidates.set(entry.sourceExternalId, entry);
      continue;
    }
    candidates.set(entry.sourceExternalId, {
      ...existing,
      jerseyNumber: existing.jerseyNumber ?? entry.jerseyNumber,
      title: existing.title ?? entry.title,
      sourceProfileUrl: existing.sourceProfileUrl || entry.sourceProfileUrl,
      roleGroup: existing.roleGroup === "PLAYER" && entry.roleGroup !== "PLAYER" ? entry.roleGroup : existing.roleGroup,
    });
  }

  if (candidates.size === 0) throw new Error("UWBadgers roster structure did not contain profile entries");
  return [...candidates.values()];
}

export function normalizedRosterHash(
  entries: SignatureRosterEntry[],
  parserVersion: string = SIGNATURE_PARSER_VERSION,
): string {
  const canonical = entries
    .map((entry) => signatureRosterEntrySchema.parse(entry))
    .sort((left, right) => left.sourceExternalId.localeCompare(right.sourceExternalId));
  return createHash("sha256").update(JSON.stringify({ parserVersion, entries: canonical }), "utf8").digest("hex");
}

export type UWBadgersRosterSnapshot = {
  sourceKey: string;
  sourceUrl: string;
  parserVersion: string;
  fetchedAt: Date;
  sourceHash: string;
  entries: SignatureRosterEntry[];
};

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SOURCE_BYTES) throw new Error("UWBadgers roster response is too large");
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) throw new Error("UWBadgers roster response is too large");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("UWBadgers roster response is too large");
    }
    chunks.push(next.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

export async function fetchUWBadgersRoster(
  sportCode: SignatureImportedSportCode,
  season: string,
): Promise<UWBadgersRosterSnapshot> {
  const parsed = signatureRosterImportSchema.parse({ sportCode, season });
  const source = getSignatureRosterSourceConfig(parsed.sportCode);
  const sourceUrl = buildUWBadgersRosterUrl(parsed.sportCode, parsed.season);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "text/html" },
    });
    if (!isAllowedUWBadgersUrl(response.url)) throw new Error("UWBadgers redirect left the allowlist");
    if (!response.ok) throw new Error(`UWBadgers roster returned HTTP ${response.status}`);
    if (!(response.headers.get("content-type") ?? "").toLocaleLowerCase().includes("text/html")) {
      throw new Error("UWBadgers roster did not return HTML");
    }
    const html = await readBoundedResponse(response);
    const entries = parseUWBadgersRosterHtml(html, parsed.sportCode);
    return {
      sourceKey: source.sourceKey,
      sourceUrl,
      parserVersion: source.parserVersion,
      fetchedAt: new Date(),
      sourceHash: normalizedRosterHash(entries, source.parserVersion),
      entries,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export { isRequiredSignatureGroup };
