import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { downloadImageToBlob } from "@/lib/blob";

/**
 * Re-host external asset images onto Vercel Blob.
 *
 * The CSV import no longer mirrors images inline (it blew the serverless
 * timeout on large imports). Instead imported assets keep whatever URL the CSV
 * carried, and this cron drains them: any asset whose `imageUrl` is not a Blob
 * URL is a pending re-host. Successful re-hosts rewrite `imageUrl`; failures
 * increment `imageRehostAttempts` so permanently-dead third-party URLs stop
 * being retried after MAX_ATTEMPTS.
 *
 * Sized for the Hobby 10s function budget: a wall-clock deadline stops the loop
 * before the platform kills it, so unprocessed candidates simply carry to the
 * next daily run.
 */
const BLOB_HOST = ".public.blob.vercel-storage.com";
const MAX_ATTEMPTS = 3;
const CANDIDATE_LIMIT = 24;
const CONCURRENCY = 4;
const PER_IMAGE_TIMEOUT_MS = 4000;
const DEADLINE_MS = 8000;
// Server-to-server re-host, not a user upload, so the 4.5MB Vercel body limit
// does not apply. Match the standalone backfill script's ceiling so images
// between 4.5MB and 25MB aren't permanently parked. See scripts/backfill-asset-images.mjs.
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const GET = withCron(async () => {
  const candidates = await db.asset.findMany({
    where: {
      imageUrl: { not: null },
      imageRehostAttempts: { lt: MAX_ATTEMPTS },
      NOT: { imageUrl: { contains: BLOB_HOST } },
    },
    select: { id: true, imageUrl: true },
    orderBy: { imageRehostAttempts: "asc" },
    take: CANDIDATE_LIMIT,
  });

  let rehosted = 0;
  let failed = 0;
  let processed = 0;
  const start = Date.now();

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (Date.now() - start > DEADLINE_MS) break;
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (asset) => {
        processed += 1;
        const blobUrl = await downloadImageToBlob(
          asset.imageUrl!,
          asset.id,
          PER_IMAGE_TIMEOUT_MS,
          MAX_IMAGE_BYTES,
        );
        if (blobUrl && blobUrl !== asset.imageUrl) {
          await db.asset.update({
            where: { id: asset.id },
            data: { imageUrl: blobUrl },
          });
          rehosted += 1;
        } else {
          await db.asset.update({
            where: { id: asset.id },
            data: { imageRehostAttempts: { increment: 1 } },
          });
          failed += 1;
        }
      }),
    );
  }

  const remaining = await db.asset.count({
    where: {
      imageUrl: { not: null },
      imageRehostAttempts: { lt: MAX_ATTEMPTS },
      NOT: { imageUrl: { contains: BLOB_HOST } },
    },
  });

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    processed,
    rehosted,
    failed,
    remaining,
  });
});
