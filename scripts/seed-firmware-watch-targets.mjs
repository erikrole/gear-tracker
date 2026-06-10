#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const CAMERA_BODY_CATEGORY_NAME = "Camera Bodies";
const now = new Date();
const apply = process.argv.includes("--apply");

const sonyTargets = new Map([
  [
    "ILCE-1",
    {
      brand: "Sony",
      model: "ILCE-1",
      productName: "Sony a1",
      sourceUrl: "https://www.sony.co.uk/electronics/support/e-mount-body-ilce-1-series/ilce-1/software/00343093",
      sourceType: "SONY_SUPPORT",
      supportMode: "ACTIVE",
      supportNote: "Flagship Alpha body with recent official Sony firmware support.",
      expectedModels: ["ILCE-1"],
    },
  ],
  [
    "ILCE-7M3",
    {
      brand: "Sony",
      model: "ILCE-7M3",
      productName: "Sony a7 III",
      sourceUrl: "https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m3/software/00257843",
      sourceType: "SONY_SUPPORT",
      supportMode: "MAINTENANCE",
      supportNote: "Older body still receiving stability firmware.",
      expectedModels: ["ILCE-7M3"],
    },
  ],
  [
    "ILCE-7M4",
    {
      brand: "Sony",
      model: "ILCE-7M4",
      productName: "Sony a7 IV",
      sourceUrl: "https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m4/software/00280505",
      sourceType: "SONY_SUPPORT",
      supportMode: "ACTIVE",
      supportNote: "Recent feature firmware on an active Alpha body.",
      expectedModels: ["ILCE-7M4"],
    },
  ],
  [
    "ILCE-7SM3",
    {
      brand: "Sony",
      model: "ILCE-7SM3",
      productName: "Sony a7S III",
      sourceUrl: "https://www.sony.co.uk/electronics/support/e-mount-body-ilce-7-series/ilce-7sm3/software/00345065",
      sourceType: "SONY_SUPPORT",
      supportMode: "ACTIVE",
      supportNote: "Older Alpha video body with recent official Sony firmware support.",
      expectedModels: ["ILCE-7SM3"],
    },
  ],
  [
    "ILME-FX6V",
    {
      brand: "Sony",
      model: "ILME-FX6V",
      productName: "Sony FX6",
      sourceUrl: "https://www.sony.com/electronics/support/software/00259043",
      sourceType: "SONY_SUPPORT",
      supportMode: "ACTIVE",
      supportNote: "Cinema Line body with recent firmware support.",
      expectedModels: ["ILME-FX6V", "ILME-FX6"],
    },
  ],
]);

const unresolvedSonyModels = new Map([
  ["ILCE-1M2", "Official US support page was not resolved during this seed pass."],
  ["ILCE-7M5", "Official US support page was not resolved during this seed pass."],
  ["ILCE-9M3", "Official US support page was not resolved during this seed pass."],
  ["ILME-FX3", "Official US support page was not resolved during this seed pass."],
]);

if (!process.env.DIRECT_URL) {
  console.error("Missing DIRECT_URL.");
  process.exit(1);
}

const sql = neon(process.env.DIRECT_URL);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const groups = await readCameraBodyInventory();
  const canonicalGroups = canonicalizeInventory(groups);

  const seeded = [];
  const skipped = [];

  for (const group of canonicalGroups) {
    const target = sonyTargets.get(group.canonicalModel);
    if (!target) {
      skipped.push({
        ...group,
        reason: unresolvedSonyModels.get(group.canonicalModel) ?? "No official-source firmware adapter is configured for this brand/model.",
      });
      continue;
    }

    const release = await fetchSonyFirmwareRelease(target.sourceUrl, target.expectedModels);
    const row = {
      ...target,
      latestVersion: release.version,
      latestReleaseDate: release.releaseDate,
      lastCheckedAt: now,
      baselineEstablishedAt: now,
      inventoryCount: group.totalCount,
      inventoryTags: group.assetTags,
      sourceModels: group.sourceModels,
    };
    seeded.push(row);

    if (apply) {
      await upsertTarget(row);
    }
  }

  printSummary({ apply, seeded, skipped });
}

async function readCameraBodyInventory() {
  return sql`
    SELECT
      a.brand,
      a.model,
      a.status,
      count(*)::int AS count,
      array_agg(a.asset_tag ORDER BY a.asset_tag) AS asset_tags
    FROM assets a
    JOIN categories c ON c.id = a.category_id
    WHERE c.name = ${CAMERA_BODY_CATEGORY_NAME}
    GROUP BY a.brand, a.model, a.status
    ORDER BY lower(a.brand), lower(a.model), a.status
  `;
}

function canonicalizeInventory(groups) {
  const byKey = new Map();

  for (const group of groups) {
    const canonical = canonicalCameraBody(group.brand, group.model);
    const key = `${canonical.brand}:${canonical.model}`;
    const existing = byKey.get(key) ?? {
      brand: canonical.brand,
      canonicalModel: canonical.model,
      totalCount: 0,
      statuses: new Map(),
      sourceModels: new Set(),
      assetTags: [],
    };

    existing.totalCount += Number(group.count);
    existing.statuses.set(group.status, (existing.statuses.get(group.status) ?? 0) + Number(group.count));
    existing.sourceModels.add(`${group.brand} ${group.model}`);
    existing.assetTags.push(...(group.asset_tags ?? []));
    byKey.set(key, existing);
  }

  return [...byKey.values()]
    .map((group) => ({
      ...group,
      statuses: Object.fromEntries([...group.statuses.entries()].sort()),
      sourceModels: [...group.sourceModels].sort(),
      assetTags: group.assetTags.sort(),
    }))
    .sort((a, b) => `${a.brand} ${a.canonicalModel}`.localeCompare(`${b.brand} ${b.canonicalModel}`));
}

function canonicalCameraBody(brand, model) {
  const normalizedBrand = normalizeBrand(brand);
  const rawModel = String(model ?? "").trim().toUpperCase();

  if (normalizedBrand === "Sony") {
    const withoutColor = rawModel.replace(/\/B$/, "");
    const fixedPrefix = withoutColor.replace(/^LCE-/, "ILCE-");
    const modelAliases = new Map([
      ["ILME-FX3A", "ILME-FX3"],
      ["ILME-FX6", "ILME-FX6V"],
    ]);
    return {
      brand: normalizedBrand,
      model: modelAliases.get(fixedPrefix) ?? fixedPrefix,
    };
  }

  if (normalizedBrand === "Insta 360") {
    return { brand: "Insta360", model: rawModel };
  }

  return { brand: normalizedBrand, model: rawModel };
}

function normalizeBrand(brand) {
  const value = String(brand ?? "").trim();
  if (/^sony$/i.test(value)) return "Sony";
  if (/^insta\s*360$/i.test(value)) return "Insta360";
  if (/^gopro$/i.test(value)) return "GoPro";
  if (/^dji$/i.test(value)) return "DJI";
  if (/^jvc$/i.test(value)) return "JVC";
  return value || "Unknown";
}

async function fetchSonyFirmwareRelease(sourceUrl, expectedModels) {
  const response = await fetch(sourceUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "GearTrackerFirmwareWatchSeed/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${sourceUrl} returned HTTP ${response.status}`);
  }

  const html = await response.text();
  validateExpectedModel(sourceUrl, html, expectedModels);
  const text = htmlToSearchableText(html);
  const version =
    matchFirst(html, /<title[^>]*>[^<]*\bVer\.\s*([0-9][A-Za-z0-9._-]*)\b/i) ??
    matchFirst(html, /"software"\s*:\s*\[[\s\S]*?"name"\s*:\s*"[^"]*?\bVer\.\s*([0-9][A-Za-z0-9._-]*)\b/i) ??
    matchFirst(html, /\\"software\\"\s*:\s*\[[\s\S]*?\\"name\\"\s*:\s*\\"[^"]*?\bVer\.\s*([0-9][A-Za-z0-9._-]*)\b/i) ??
    matchFirst(text, /\bVer\.\s*([0-9][A-Za-z0-9._-]*)\b/i) ??
    matchFirst(text, /\bVersion:\s*([0-9][A-Za-z0-9._-]*)\b/i);
  const releaseDateText =
    matchFirst(html, /"software"\s*:\s*\[[\s\S]*?"releaseDate"\s*:\s*"([^"]+)"/i) ??
    matchFirst(html, /\\"software\\"\s*:\s*\[[\s\S]*?\\"releaseDate\\"\s*:\s*\\"([^"]+)/i) ??
    matchFirst(text, /\bRelease Date:\s*([0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})\b/i);

  if (!version) {
    throw new Error(`${sourceUrl} did not expose a firmware version`);
  }

  return {
    version,
    releaseDate: releaseDateText ? parseSonyDate(releaseDateText) : null,
  };
}

function validateExpectedModel(sourceUrl, html, expectedModels = []) {
  if (expectedModels.length === 0) return;

  const matched = expectedModels.some((model) => html.includes(`"${model}"`) || html.includes(`\\"${model}\\"`));
  if (!matched) {
    throw new Error(`${sourceUrl} did not include expected model tag ${expectedModels.join(" or ")}`);
  }
}

async function upsertTarget(row) {
  await sql`
    INSERT INTO firmware_watch_targets
      (
        id,
        brand,
        model,
        product_name,
        source_url,
        source_type,
        support_mode,
        support_note,
        enabled,
        latest_version,
        latest_release_date,
        last_checked_at,
        baseline_established_at,
        last_error,
        created_at,
        updated_at
      )
    VALUES
      (
        gen_random_uuid()::text,
        ${row.brand},
        ${row.model},
        ${row.productName},
        ${row.sourceUrl},
        ${row.sourceType}::"FirmwareSourceType",
        ${row.supportMode}::"FirmwareSupportMode",
        ${row.supportNote},
        true,
        ${row.latestVersion},
        ${row.latestReleaseDate?.toISOString() ?? null}::timestamp,
        ${row.lastCheckedAt.toISOString()}::timestamp,
        ${row.baselineEstablishedAt.toISOString()}::timestamp,
        null,
        now(),
        now()
      )
    ON CONFLICT (source_url) DO UPDATE SET
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      product_name = EXCLUDED.product_name,
      source_type = EXCLUDED.source_type,
      support_mode = EXCLUDED.support_mode,
      support_note = EXCLUDED.support_note,
      enabled = EXCLUDED.enabled,
      latest_version = EXCLUDED.latest_version,
      latest_release_date = EXCLUDED.latest_release_date,
      last_checked_at = EXCLUDED.last_checked_at,
      baseline_established_at = COALESCE(firmware_watch_targets.baseline_established_at, EXCLUDED.baseline_established_at),
      last_error = null,
      updated_at = now()
  `;
}

function printSummary({ apply, seeded, skipped }) {
  console.log(apply ? "Applied firmware watch target seed." : "Dry run. Pass --apply to write targets.");

  console.log("\nSeeded targets:");
  for (const row of seeded) {
    const date = row.latestReleaseDate ? row.latestReleaseDate.toISOString().slice(0, 10) : "unknown date";
    console.log(
      `- ${row.productName} (${row.model}): ${row.latestVersion}, ${date}, ${row.supportMode}, ${row.inventoryCount} inventory item(s)`,
    );
    console.log(`  source: ${row.sourceUrl}`);
    console.log(`  inventory tags: ${row.inventoryTags.join(", ")}`);
  }

  console.log("\nSkipped live camera bodies:");
  for (const row of skipped) {
    console.log(
      `- ${row.brand} ${row.canonicalModel}: ${row.totalCount} inventory item(s), statuses ${JSON.stringify(row.statuses)}. ${row.reason}`,
    );
    console.log(`  source models: ${row.sourceModels.join(", ")}`);
    console.log(`  inventory tags: ${row.assetTags.join(", ")}`);
  }
}

function htmlToSearchableText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function matchFirst(text, pattern) {
  return text.match(pattern)?.[1] ?? null;
}

function parseSonyDate(value) {
  if (/^[0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4}$/.test(value)) {
    return parseUsDate(value);
  }

  const normalized = value.replace(/\\\//g, "/").replace(/\\"/g, '"');
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Unsupported firmware release date: ${value}`);
  }
  const parsed = new Date(timestamp);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function parseUsDate(value) {
  const match = value.match(/^([0-9]{2})[-/.]([0-9]{2})[-/.]([0-9]{2}|[0-9]{4})$/);
  if (!match) {
    throw new Error(`Unsupported firmware release date: ${value}`);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid firmware release date: ${value}`);
  }
  return parsed;
}
