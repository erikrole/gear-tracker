import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Nightly 3 AM Central refresh (08:00 UTC):
 *   1. Sync all enabled calendar sources (fetch ICS, upsert events)
 *   2. Generate shifts for any newly synced events
 *   3. Archive shift groups for events that have ended
 *
 * Events and shifts are never deleted by this job — archiving only sets
 * archivedAt so the records remain visible in the calendar and schedule.
 */
export const GET = withHandler(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const syncResults: Array<{
    sourceId: string;
    sourceName: string;
    eventsAdded?: number;
    eventsUpdated?: number;
    groupsCreated?: number;
    shiftsCreated?: number;
    error?: string;
  }> = [];

  // ── 1. Sync all enabled calendar sources ──────────────────────────────
  const sources = await db.calendarSource.findMany({
    where: { enabled: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  for (const source of sources) {
    try {
      const syncResult = await syncCalendarSource(source.id);
      const shiftResult = await generateShiftsForNewEvents(source.id);

      syncResults.push({
        sourceId: source.id,
        sourceName: source.name,
        eventsAdded: syncResult.added ?? 0,
        eventsUpdated: syncResult.updated ?? 0,
        groupsCreated: shiftResult.groupsCreated,
        shiftsCreated: shiftResult.shiftsCreated,
      });
    } catch (err) {
      console.error(`morning-refresh: sync failed for source ${source.name}:`, err);
      syncResults.push({
        sourceId: source.id,
        sourceName: source.name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // ── 2. Archive completed shift groups ─────────────────────────────────
  const unarchived = await db.shiftGroup.findMany({
    where: {
      archivedAt: null,
      event: { endsAt: { lt: now } },
    },
    select: { id: true },
  });

  let archived = 0;
  if (unarchived.length > 0) {
    const result = await db.shiftGroup.updateMany({
      where: {
        id: { in: unarchived.map((g) => g.id) },
        archivedAt: null,
      },
      data: { archivedAt: now },
    });
    archived = result.count;
  }

  return NextResponse.json({
    ok: true,
    runAt: now.toISOString(),
    sourcesProcessed: sources.length,
    syncResults,
    archived,
  });
});
