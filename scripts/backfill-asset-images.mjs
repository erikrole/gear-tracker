// Backfill external asset and item-family images into Vercel Blob.
//
// Why: large CSV imports defer image mirroring to a bounded cron so serverless
// imports do not time out. This script re-hosts any remaining non-Blob image
// URLs for serialized assets and BulkSku item families when an operator wants
// to drain the backlog outside the cron budget.
//
// Usage:
//   node --env-file=.env scripts/backfill-asset-images.mjs                   # dry run
//   node --env-file=.env scripts/backfill-asset-images.mjs --apply           # execute
//   node --env-file=.env scripts/backfill-asset-images.mjs --bulk-skus-only  # limit scope
//
// Requires DATABASE_URL and BLOB_READ_WRITE_TOKEN in the environment.
// Every applied change is logged to tmp/image-backfill-<ts>.json (old -> new)
// so it is reversible.

import { writeFileSync, mkdirSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const APPLY = process.argv.includes("--apply");
const ASSETS_ONLY = process.argv.includes("--assets-only");
const BULK_SKUS_ONLY = process.argv.includes("--bulk-skus-only");
const CONCURRENCY = 4;
const TIMEOUT_MS = 20000;
const MAX_BYTES = 25 * 1024 * 1024; // generous; our own re-host, not a user upload

const CONTENT_TYPE_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isBlobUrl(url) {
  return url.includes(".public.blob.vercel-storage.com");
}

function extFromUrl(url) {
  const m = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

async function downloadToBlob(url, recordId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*", "User-Agent": "gear-tracker-backfill" },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const ext = CONTENT_TYPE_TO_EXT[contentType] ?? extFromUrl(url);
    if (!ext) return { error: `unrecognized type "${contentType}"` };
    const body = await res.arrayBuffer();
    if (body.byteLength === 0) return { error: "empty body" };
    if (body.byteLength > MAX_BYTES) return { error: `too large (${body.byteLength})` };
    const pathname = `assets/${recordId}/${Date.now()}.${ext}`;
    const blob = await put(pathname, Buffer.from(body), {
      access: "public",
      contentType: contentType || `image/${ext === "jpg" ? "jpeg" : ext}`,
    });
    return { url: blob.url };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "timeout" : (e?.message ?? "fetch failed") };
  } finally {
    clearTimeout(timer);
  }
}

function toTarget(recordType, record) {
  return {
    recordType,
    id: record.id,
    label: record.assetTag ?? record.name,
    imageUrl: record.imageUrl,
  };
}

async function main() {
  if (APPLY && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is required to --apply. Run `vercel env pull` or add it to .env.");
    process.exit(1);
  }
  if (ASSETS_ONLY && BULK_SKUS_ONLY) {
    console.error("Choose only one scope flag: --assets-only or --bulk-skus-only.");
    process.exit(1);
  }

  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });

  const [assets, bulkSkus] = await Promise.all([
    BULK_SKUS_ONLY
      ? []
      : db.asset.findMany({
          where: { imageUrl: { not: null } },
          select: { id: true, assetTag: true, imageUrl: true },
        }),
    ASSETS_ONLY
      ? []
      : db.bulkSku.findMany({
          where: { imageUrl: { not: null } },
          select: { id: true, name: true, imageUrl: true },
        }),
  ]);
  const assetTargets = assets.filter((a) => a.imageUrl && !isBlobUrl(a.imageUrl)).map((a) => toTarget("asset", a));
  const bulkSkuTargets = bulkSkus.filter((s) => s.imageUrl && !isBlobUrl(s.imageUrl)).map((s) => toTarget("bulkSku", s));
  const targets = [...assetTargets, ...bulkSkuTargets];

  console.log(`Assets with images:       ${assets.length}`);
  console.log(`Assets already on Blob:   ${assets.length - assetTargets.length}`);
  console.log(`Assets to re-host:        ${assetTargets.length}`);
  console.log(`Bulk SKUs with images:    ${bulkSkus.length}`);
  console.log(`Bulk SKUs already on Blob:${bulkSkus.length - bulkSkuTargets.length}`);
  console.log(`Bulk SKUs to re-host:     ${bulkSkuTargets.length}`);
  console.log(`Total to re-host:         ${targets.length}`);
  console.log(APPLY ? "\nMode: APPLY (writing to Blob + DB)\n" : "\nMode: DRY RUN (no changes) - pass --apply to execute\n");

  if (!APPLY) {
    for (const target of targets.slice(0, 10)) {
      console.log(`  would re-host ${target.recordType} ${target.label}: ${target.imageUrl}`);
    }
    if (targets.length > 10) console.log(`  ... and ${targets.length - 10} more`);
    await db.$disconnect();
    return;
  }

  const changes = [];
  let ok = 0;
  const failures = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (target) => {
        const r = await downloadToBlob(target.imageUrl, target.id);
        if (r.url) {
          if (target.recordType === "asset") {
            await db.asset.update({ where: { id: target.id }, data: { imageUrl: r.url } });
          } else {
            await db.bulkSku.update({ where: { id: target.id }, data: { imageUrl: r.url } });
          }
          changes.push({
            recordType: target.recordType,
            id: target.id,
            label: target.label,
            oldUrl: target.imageUrl,
            newUrl: r.url,
          });
          ok++;
          console.log(`  ✓ ${target.recordType} ${target.label}`);
        } else {
          failures.push({
            recordType: target.recordType,
            id: target.id,
            label: target.label,
            url: target.imageUrl,
            error: r.error,
          });
          console.log(`  ✗ ${target.recordType} ${target.label} - ${r.error}`);
        }
      })
    );
  }

  mkdirSync("tmp", { recursive: true });
  const logPath = `tmp/image-backfill-${Date.now()}.json`;
  writeFileSync(logPath, JSON.stringify({ changes, failures }, null, 2));
  console.log(`\nDone. Re-hosted ${ok}/${targets.length}. Failures: ${failures.length}.`);
  console.log(`Reversible change log: ${logPath}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
