import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { downloadImageToBlob } from "@/lib/blob";

/**
 * Re-host external item images onto Vercel Blob.
 *
 * The CSV import no longer mirrors images inline (it blew the serverless
 * timeout on large imports). Instead imported items keep whatever URL the CSV
 * carried, and this cron drains them: any asset or item family whose `imageUrl`
 * is not a Blob URL is a pending re-host. Successful re-hosts rewrite
 * `imageUrl`; failures increment `imageRehostAttempts` so permanently dead
 * third-party URLs stop being retried after MAX_ATTEMPTS.
 *
 * Sized for the Hobby 10s function budget: a wall-clock deadline stops the loop
 * before the platform kills it, so unprocessed candidates simply carry to the
 * next daily run.
 */
const BLOB_HOST = ".public.blob.vercel-storage.com";
const MAX_ATTEMPTS = 3;
const ASSET_CANDIDATE_LIMIT = 16;
const BULK_SKU_CANDIDATE_LIMIT = 8;
const CONCURRENCY = 4;
const PER_IMAGE_TIMEOUT_MS = 4000;
const DEADLINE_MS = 8000;
// Server-to-server re-host, not a user upload, so the 4.5MB Vercel body limit
// does not apply. Match the standalone backfill script's ceiling so images
// between 4.5MB and 25MB aren't permanently parked. See scripts/backfill-asset-images.mjs.
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

type RehostCandidate = {
  kind: "asset" | "bulkSku";
  id: string;
  imageUrl: string;
};

export const GET = withCron(async () => {
  const [assetCandidates, bulkSkuCandidates] = await Promise.all([
    db.asset.findMany({
      where: {
        imageUrl: { not: null },
        imageRehostAttempts: { lt: MAX_ATTEMPTS },
        NOT: { imageUrl: { contains: BLOB_HOST } },
      },
      select: { id: true, imageUrl: true },
      orderBy: { imageRehostAttempts: "asc" },
      take: ASSET_CANDIDATE_LIMIT,
    }),
    db.bulkSku.findMany({
      where: {
        active: true,
        imageUrl: { not: null },
        imageRehostAttempts: { lt: MAX_ATTEMPTS },
        NOT: { imageUrl: { contains: BLOB_HOST } },
      },
      select: { id: true, imageUrl: true },
      orderBy: { imageRehostAttempts: "asc" },
      take: BULK_SKU_CANDIDATE_LIMIT,
    }),
  ]);

  const candidates: RehostCandidate[] = [
    ...assetCandidates.map((asset) => ({
      kind: "asset" as const,
      id: asset.id,
      imageUrl: asset.imageUrl!,
    })),
    ...bulkSkuCandidates.map((sku) => ({
      kind: "bulkSku" as const,
      id: sku.id,
      imageUrl: sku.imageUrl!,
    })),
  ];

  let rehosted = 0;
  let failed = 0;
  let processed = 0;
  let assetProcessed = 0;
  let assetRehosted = 0;
  let assetFailed = 0;
  let bulkSkuProcessed = 0;
  let bulkSkuRehosted = 0;
  let bulkSkuFailed = 0;
  const start = Date.now();

  async function markFailed(candidate: RehostCandidate) {
    failed += 1;
    if (candidate.kind === "asset") {
      assetFailed += 1;
      await db.asset.update({
        where: { id: candidate.id },
        data: { imageRehostAttempts: { increment: 1 } },
      });
    } else {
      bulkSkuFailed += 1;
      await db.bulkSku.update({
        where: { id: candidate.id },
        data: { imageRehostAttempts: { increment: 1 } },
      });
    }
  }

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (Date.now() - start > DEADLINE_MS) break;
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (candidate) => {
        processed += 1;
        if (candidate.kind === "asset") {
          assetProcessed += 1;
        } else {
          bulkSkuProcessed += 1;
        }
        const blobUrl = await downloadImageToBlob(
          candidate.imageUrl,
          candidate.id,
          PER_IMAGE_TIMEOUT_MS,
          MAX_IMAGE_BYTES,
        );
        if (blobUrl && blobUrl !== candidate.imageUrl) {
          if (candidate.kind === "asset") {
            await db.asset.update({
              where: { id: candidate.id },
              data: { imageUrl: blobUrl },
            });
            assetRehosted += 1;
          } else {
            await db.bulkSku.update({
              where: { id: candidate.id },
              data: { imageUrl: blobUrl },
            });
            bulkSkuRehosted += 1;
          }
          rehosted += 1;
        } else {
          await markFailed(candidate);
        }
      }),
    );
  }

  const [assetRemaining, bulkSkuRemaining] = await Promise.all([
    db.asset.count({
      where: {
        imageUrl: { not: null },
        imageRehostAttempts: { lt: MAX_ATTEMPTS },
        NOT: { imageUrl: { contains: BLOB_HOST } },
      },
    }),
    db.bulkSku.count({
      where: {
        active: true,
        imageUrl: { not: null },
        imageRehostAttempts: { lt: MAX_ATTEMPTS },
        NOT: { imageUrl: { contains: BLOB_HOST } },
      },
    }),
  ]);
  const remaining = assetRemaining + bulkSkuRemaining;

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    assetCandidates: assetCandidates.length,
    bulkSkuCandidates: bulkSkuCandidates.length,
    processed,
    assetProcessed,
    bulkSkuProcessed,
    rehosted,
    assetRehosted,
    bulkSkuRehosted,
    failed,
    assetFailed,
    bulkSkuFailed,
    remaining,
    assetRemaining,
    bulkSkuRemaining,
  });
});
