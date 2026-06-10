export type RepeatTagAsset = {
  assetTag?: string | null;
};

export type RepeatTagSummary = {
  base: string;
  existingCount: number;
  nextTag: string;
  matchedTags: string[];
};

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getRepeatTagBase(value: string) {
  const normalized = normalizeTag(value);
  return normalized.replace(/\s+\d+$/, "");
}

export function summarizeRepeatTags(value: string, assets: RepeatTagAsset[]): RepeatTagSummary | null {
  const base = getRepeatTagBase(value);
  if (!base) return null;

  const matcher = new RegExp(`^${escapeRegExp(base)}(?:\\s+(\\d+))?$`, "i");
  let highestNumber = 0;
  const matchedTags: string[] = [];

  for (const asset of assets) {
    const tag = typeof asset.assetTag === "string" ? normalizeTag(asset.assetTag) : "";
    const match = tag.match(matcher);
    if (!match) continue;

    matchedTags.push(tag);
    const numericSuffix = match[1] ? Number(match[1]) : 1;
    if (Number.isFinite(numericSuffix)) {
      highestNumber = Math.max(highestNumber, numericSuffix);
    }
  }

  return {
    base,
    existingCount: matchedTags.length,
    nextTag: highestNumber > 0 ? `${base} ${highestNumber + 1}` : base,
    matchedTags,
  };
}
