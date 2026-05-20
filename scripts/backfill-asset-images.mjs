// Backfill external asset images into Vercel Blob.
//
// Why: the Cheqroom CSV import re-hosts images inline ("best-effort", batches
// of 5) inside a single serverless request. With ~180 images that loop exceeds
// the function timeout, so most assets keep their raw third-party Cheqroom CDN
// URL (attachments.cheqroomcdn.com). Those render only while that third party
// keeps serving them to the end user's browser — fragile, and the cause of
// "asset photos not displaying" in production. This script re-hosts every
// non-Blob image onto first-party Vercel Blob, with no serverless timeout.
//
// Usage:
//   node --env-file=.env scripts/backfill-asset-images.mjs            # dry run
//   node --env-file=.env scripts/backfill-asset-images.mjs --apply    # execute
//
// Requires DATABASE_URL and BLOB_READ_WRITE_TOKEN in the environment.
// Every change is logged to tmp/asset-image-backfill-<ts>.json (old -> new)
// so it is fully reversible.

import { writeFileSync, mkdirSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const APPLY = process.argv.includes("--apply");
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

async function downloadToBlob(url, assetId) {
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
    const pathname = `assets/${assetId}/${Date.now()}.${ext}`;
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

async function main() {
  if (APPLY && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is required to --apply. Run `vercel env pull` or add it to .env.");
    process.exit(1);
  }

  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });

  const assets = await db.asset.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, assetTag: true, imageUrl: true },
  });
  const targets = assets.filter((a) => a.imageUrl && !isBlobUrl(a.imageUrl));

  console.log(`Assets with images: ${assets.length}`);
  console.log(`Already on Blob:    ${assets.length - targets.length}`);
  console.log(`To re-host:         ${targets.length}`);
  console.log(APPLY ? "\nMode: APPLY (writing to Blob + DB)\n" : "\nMode: DRY RUN (no changes) — pass --apply to execute\n");

  if (!APPLY) {
    for (const a of targets.slice(0, 10)) console.log(`  would re-host ${a.assetTag}: ${a.imageUrl}`);
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
      batch.map(async (a) => {
        const r = await downloadToBlob(a.imageUrl, a.id);
        if (r.url) {
          await db.asset.update({ where: { id: a.id }, data: { imageUrl: r.url } });
          changes.push({ assetId: a.id, assetTag: a.assetTag, oldUrl: a.imageUrl, newUrl: r.url });
          ok++;
          console.log(`  ✓ ${a.assetTag}`);
        } else {
          failures.push({ assetTag: a.assetTag, url: a.imageUrl, error: r.error });
          console.log(`  ✗ ${a.assetTag} — ${r.error}`);
        }
      })
    );
  }

  mkdirSync("tmp", { recursive: true });
  const logPath = `tmp/asset-image-backfill-${Date.now()}.json`;
  writeFileSync(logPath, JSON.stringify({ changes, failures }, null, 2));
  console.log(`\nDone. Re-hosted ${ok}/${targets.length}. Failures: ${failures.length}.`);
  console.log(`Reversible change log: ${logPath}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
