import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { downloadImageToBlob } from "@/lib/blob";

/**
 * Re-host external asset and item-family images onto Vercel Blob.
 *
 * The CSV import no longer mirrors images inline (it blew the serverless
 * timeout on large imports). Instead imported rows keep whatever URL the CSV
 * carried, and this cron drains them: any asset or BulkSku whose `imageUrl` is
 * not a Blob URL is a pending re-host. Successful re-hosts rewrite `imageUrl`;
 * failures increment `imageRehostAttempts` so permanently-dead third-party
 * URLs stop being retried after MAX_ATTEMPTS.
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

type CandidateKind = "asset" | "bulkSku";

type Candidate = {
  id: string;
  imageUrl: string;
  kind: CandidateKind;
};

type RehostStats = {
  candidates: number;
  processed: number;
  rehosted: number;
  failed: number;
  remaining: number;
};

const pendingImageWhere = {
  imageUrl: { not: null },
  imageRehostAttempts: { lt: MAX_ATTEMPTS },
  NOT: { imageUrl: { contains: BLOB_HOST } },
} as const;

function interleaveCandidates(assets: Candidate[], bulkSkus: Candidate[]): Candidate[] {
  const candidates: Candidate[] = [];
  const maxLength = Math.max(assets.length, bulkSkus.length);
  for (let i = 0; i < maxLength; i += 1) {
    if (assets[i]) candidates.push(assets[i]!);
    if (bulkSkus[i]) candidates.push(bulkSkus[i]!);
  }
  return candidates.slice(0, CANDIDATE_LIMIT);
}

export const GET = withCron(async () => {
  const [assetRows, bulkSkuRows] = await Promise.all([
    db.asset.findMany({
      where: pendingImageWhere,
      select: { id: true, imageUrl: true },
      orderBy: { imageRehostAttempts: "asc" },
      take: CANDIDATE_LIMIT,
    }),
    db.bulkSku.findMany({
      where: pendingImageWhere,
      select: { id: true, imageUrl: true },
      orderBy: { imageRehostAttempts: "asc" },
      take: CANDIDATE_LIMIT,
    }),
  ]);

  const candidates = interleaveCandidates(
    assetRows.map((asset) => ({ id: asset.id, imageUrl: asset.imageUrl!, kind: "asset" })),
    bulkSkuRows.map((bulkSku) => ({ id: bulkSku.id, imageUrl: bulkSku.imageUrl!, kind: "bulkSku" })),
  );

  const stats: Record<CandidateKind, RehostStats> = {
    asset: { candidates: candidates.filter((candidate) => candidate.kind === "asset").length, processed: 0, rehosted: 0, failed: 0, remaining: 0 },
    bulkSku: { candidates: candidates.filter((candidate) => candidate.kind === "bulkSku").length, processed: 0, rehosted: 0, failed: 0, remaining: 0 },
  };
  const start = Date.now();

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (Date.now() - start > DEADLINE_MS) break;
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (candidate) => {
        const kindStats = stats[candidate.kind];
        kindStats.processed += 1;
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
          } else {
            await db.bulkSku.update({
              where: { id: candidate.id },
              data: { imageUrl: blobUrl },
            });
          }
          kindStats.rehosted += 1;
        } else if (candidate.kind === "asset") {
          await db.asset.update({
            where: { id: candidate.id },
            data: { imageRehostAttempts: { increment: 1 } },
          });
          kindStats.failed += 1;
        } else {
          await db.bulkSku.update({
            where: { id: candidate.id },
            data: { imageRehostAttempts: { increment: 1 } },
          });
          kindStats.failed += 1;
        }
      }),
    );
  }

  const [assetRemaining, bulkSkuRemaining] = await Promise.all([
    db.asset.count({
      where: pendingImageWhere,
    }),
    db.bulkSku.count({
      where: pendingImageWhere,
    }),
  ]);
  stats.asset.remaining = assetRemaining;
  stats.bulkSku.remaining = bulkSkuRemaining;

  return NextResponse.json({
    ok: true,
    candidates: stats.asset.candidates,
    processed: stats.asset.processed,
    rehosted: stats.asset.rehosted,
    failed: stats.asset.failed,
    remaining: stats.asset.remaining,
    assets: {
      processed: stats.asset.processed,
      rehosted: stats.asset.rehosted,
      failed: stats.asset.failed,
      remaining: stats.asset.remaining,
    },
    bulkSkus: {
      processed: stats.bulkSku.processed,
      rehosted: stats.bulkSku.rehosted,
      failed: stats.bulkSku.failed,
      remaining: stats.bulkSku.remaining,
    },
  });
});
