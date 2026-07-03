import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit";

/**
 * Retention policy: delete audit log entries older than AUDIT_RETENTION_DAYS.
 * Runs weekly via Vercel Cron (see vercel.json).
 *
 * Hard delete in batches to avoid locking the table for too long on large
 * datasets. For regulatory needs, a separate export-before-delete step can
 * be added later.
 */
const BATCH_SIZE = 1000;
const MAX_BATCHES_PER_RUN = 5;

export const GET = withCron(async () => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);

  let totalDeleted = 0;
  let batchesProcessed = 0;
  let hasMoreAuditLogs = false;
  const partialFailures: string[] = [];
  const errors: Record<string, string> = {};

  try {
    for (let batchNumber = 0; batchNumber < MAX_BATCHES_PER_RUN; batchNumber += 1) {
      const batch = await db.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (batch.length === 0) break;

      const result = await db.auditLog.deleteMany({
        where: { id: { in: batch.map((r) => r.id) } },
      });

      batchesProcessed += 1;
      totalDeleted += result.count;

      if (batch.length < BATCH_SIZE || result.count < BATCH_SIZE) break;
      hasMoreAuditLogs = batchNumber + 1 === MAX_BATCHES_PER_RUN;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown audit archive error";
    console.error("audit-archive: audit log purge failed", err);
    partialFailures.push("auditLogs");
    errors.auditLogs = message;
  }

  let sessionsDeleted = 0;
  try {
    const expiredSessions = await db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    sessionsDeleted = expiredSessions.count;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown session purge error";
    console.error("audit-archive: session purge failed", err);
    partialFailures.push("sessions");
    errors.sessions = message;
  }

  return NextResponse.json({
    ok: partialFailures.length === 0,
    auditLogsDeleted: totalDeleted,
    sessionsDeleted,
    batchesProcessed,
    batchSize: BATCH_SIZE,
    maxBatchesPerRun: MAX_BATCHES_PER_RUN,
    hasMoreAuditLogs,
    cutoffDate: cutoff.toISOString(),
    retentionDays: AUDIT_RETENTION_DAYS,
    ...(partialFailures.length > 0 ? { partialFailures, errors } : {}),
  });
});
