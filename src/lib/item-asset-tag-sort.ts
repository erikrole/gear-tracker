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

function readOperationalPrefix(value: string) {
  const normalized = normalizeAssetTag(value);
  const [firstToken, ...rest] = normalized.split(" ");
  if (!firstToken || rest.length === 0) {
    return { prefix: null, value: normalized };
  }

  const prefix = firstToken.toUpperCase();
  const restValue = rest.join(" ");
  if (TEAM_PREFIXES.has(prefix) && looksLikeTeamScopedAssetTag(rest)) {
    return { prefix, value: restValue };
  }
  if (DEPARTMENT_PREFIXES.has(prefix) && looksLikeKnownEquipmentTag(rest)) {
    return { prefix, value: restValue };
  }
  return { prefix: null, value: normalized };
}

function stripOperationalPrefix(value: string) {
  return readOperationalPrefix(value).value;
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
  const key = stripOperationalPrefix(assetTag)
    .replace(/-(\d+)$/, " $1")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = key.split(" ").filter(Boolean);
  if (tokens.length === 0) return key;
  return [normalizeFamilyToken(tokens[0]!), ...tokens.slice(1)].join(" ");
}

function normalizeFamilyToken(token: string) {
  if (!/^\d{4,6}$/.test(token)) return token;
  if (token.length === 4) return `${token.slice(0, 2)}-${token.slice(2)}`;
  if (token.length === 5) return `${token.slice(0, 2)}-${token.slice(2)}`;
  return `${token.slice(0, 3)}-${token.slice(3)}`;
}

function getItemAssetTagSortParts(assetTag: string) {
  const { prefix, value } = readOperationalPrefix(assetTag);
  const key = value
    .replace(/-(\d+)$/, " $1")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = key.split(" ").filter(Boolean);
  const trailingUnit = tokens.at(-1);
  const unitNumber = trailingUnit && /^\d+$/.test(trailingUnit)
    ? Number(trailingUnit)
    : null;
  const familyTokens = unitNumber === null ? tokens : tokens.slice(0, -1);
  const familyKey = familyTokens
    .map((token, index) => index === 0 ? normalizeFamilyToken(token) : token)
    .join(" ")
    .trim();

  return {
    familyKey: familyKey || key,
    prefixRank: prefix === null ? 0 : 1,
    prefix: prefix ?? "",
    unitNumber,
    key,
    normalized: normalizeAssetTag(assetTag),
  };
}

export function compareItemAssetTags(a: string, b: string) {
  const aParts = getItemAssetTagSortParts(a);
  const bParts = getItemAssetTagSortParts(b);

  const familyComparison = assetTagCollator.compare(aParts.familyKey, bParts.familyKey);
  if (familyComparison !== 0) return familyComparison;

  if (aParts.prefixRank !== bParts.prefixRank) return aParts.prefixRank - bParts.prefixRank;

  if (aParts.unitNumber !== null && bParts.unitNumber !== null && aParts.unitNumber !== bParts.unitNumber) {
    return aParts.unitNumber - bParts.unitNumber;
  }

  const prefixComparison = assetTagCollator.compare(aParts.prefix, bParts.prefix);
  if (prefixComparison !== 0) return prefixComparison;

  const keyComparison = assetTagCollator.compare(aParts.key, bParts.key);
  if (keyComparison !== 0) return keyComparison;

  return assetTagCollator.compare(aParts.normalized, bParts.normalized);
}
