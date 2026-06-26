const assetTagCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const TEAM_PREFIXES = new Set([
  "BASE",
  "BB",
  "FB",
  "GOLF",
  "HKY",
  "MBB",
  "MSOC",
  "ROW",
  "SB",
  "SOC",
  "SWIM",
  "TENNIS",
  "TRACK",
  "VB",
  "WBB",
  "WHKY",
  "WRE",
  "WRESTLING",
  "WSOC",
  "XC",
]);

const DEPARTMENT_PREFIXES = new Set(["CREATIVE", "PHOTO", "VIDEO"]);

const EQUIPMENT_STARTERS = new Set([
  "A1",
  "A7",
  "A9",
  "ANTON",
  "ANTON/BAUER",
  "APUTURE",
  "CANON",
  "DELL",
  "DJI",
  "FX3",
  "FX30",
  "FX6",
  "GODOX",
  "GOPRO",
  "IMPACT",
  "INSTA360",
  "JUPIO",
  "JVC",
  "LAOWA",
  "LOGITECH",
  "MONITOR",
  "PANASONIC",
  "PROGRADE",
  "SANDISK",
  "SIGMA",
  "SMALLRIG",
  "SONY",
  "TAMRON",
  "WATSON",
]);

function normalizeAssetTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function stripOperationalPrefix(value: string) {
  const normalized = normalizeAssetTag(value);
  const [firstToken, ...rest] = normalized.split(" ");
  if (!firstToken || rest.length === 0) return normalized;

  const prefix = firstToken.toUpperCase();
  const restValue = rest.join(" ");
  if (TEAM_PREFIXES.has(prefix) && looksLikeTeamScopedAssetTag(rest)) return restValue;
  if (DEPARTMENT_PREFIXES.has(prefix) && looksLikeKnownEquipmentTag(rest)) return restValue;
  return normalized;
}

function looksLikeTeamScopedAssetTag(tokens: string[]) {
  const value = tokens.join(" ");
  if (looksLikeKnownEquipmentTag(tokens)) return true;
  if (/^\d/.test(value)) return true;
  return tokens.length > 1;
}

function looksLikeKnownEquipmentTag(tokens: string[]) {
  const value = tokens.join(" ");
  const first = tokens[0]?.toUpperCase();
  if (!first) return false;

  return (
    /^\d/.test(value) ||
    /^(?:A\d|FX\d|FX\d{2}|FS\d)\b/i.test(value) ||
    EQUIPMENT_STARTERS.has(first)
  );
}

export function getItemAssetTagSortKey(assetTag: string) {
  return stripOperationalPrefix(assetTag)
    .replace(/-(\d+)$/, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareItemAssetTags(a: string, b: string) {
  const keyComparison = assetTagCollator.compare(
    getItemAssetTagSortKey(a),
    getItemAssetTagSortKey(b)
  );
  if (keyComparison !== 0) return keyComparison;

  return assetTagCollator.compare(normalizeAssetTag(a), normalizeAssetTag(b));
}
