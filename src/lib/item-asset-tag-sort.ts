const assetTagCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const OPERATIONAL_PREFIXES = new Set([
  "BASE",
  "BB",
  "CREATIVE",
  "FB",
  "GOLF",
  "HKY",
  "MBB",
  "MSOC",
  "PHOTO",
  "ROW",
  "SB",
  "SOC",
  "SWIM",
  "TENNIS",
  "TRACK",
  "VB",
  "VIDEO",
  "WBB",
  "WHKY",
  "WRE",
  "WRESTLING",
  "WSOC",
  "XC",
]);

function normalizeAssetTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function stripOperationalPrefix(value: string) {
  const normalized = normalizeAssetTag(value);
  const [firstToken, ...rest] = normalized.split(" ");
  if (!firstToken || rest.length === 0) return normalized;

  if (!OPERATIONAL_PREFIXES.has(firstToken.toUpperCase())) return normalized;
  return rest.join(" ");
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
