import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Retention policy: delete audit log entries older than AUDIT_RETENTION_DAYS.
 * Runs weekly via Vercel Cron (see vercel.json).
 *
 * Hard delete in batches to avoid locking the table for too long on large
 * datasets. For regulatory needs, a separate export-before-delete step can
 * be added later.
 */
const BATCH_SIZE = 1000;

export const GET = withHandler(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);

  let totalDeleted = 0;
  let batchDeleted: number;

  // Delete in batches to avoid long-running queries
  do {
    const batch = await db.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const result = await db.auditLog.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });

    batchDeleted = result.count;
    totalDeleted += batchDeleted;
  } while (batchDeleted === BATCH_SIZE);

  // Purge expired sessions
  const expiredSessions = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return NextResponse.json({
    ok: true,
    auditLogsDeleted: totalDeleted,
    sessionsDeleted: expiredSessions.count,
    cutoffDate: cutoff.toISOString(),
    retentionDays: AUDIT_RETENTION_DAYS,
  });
});
