import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { expireOpenTrades } from "@/lib/services/shift-trades";
import { expirePendingPickupCheckouts } from "@/lib/services/pending-pickup-expiry";
import { DEFAULT_RESERVATION_RULES } from "@/lib/services/reservation-rules";

function maintenanceValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  failures: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`morning-refresh: ${label} failed`, result.reason);
  failures.push(label);
  return fallback;
}

/** Events older than this many months are soft-archived (archivedAt stamped). */
const EVENT_ARCHIVE_MONTHS = 4;

/**
 * Nightly 3 AM Central refresh (08:00 UTC):
 *   1. Sync all enabled calendar sources (fetch ICS, upsert events)
 *   2. Generate shifts for any newly synced events
 *   3. Archive shift groups for events that have ended
 *   4. Archive calendar events older than EVENT_ARCHIVE_MONTHS
 *   5. Expire stale open trades and pending kiosk pickups
 *
 * Nothing is deleted — archiving only sets archivedAt so all records remain
 * available for historical stats (future Wrapped feature).
 */
export const GET = withCron(async () => {
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

  // ── 3. Archive old calendar events ───────────────────────────────────
  const archiveCutoff = new Date(now);
  archiveCutoff.setMonth(archiveCutoff.getMonth() - EVENT_ARCHIVE_MONTHS);
  const eventsArchived = await db.calendarEvent
    .updateMany({
      where: { endsAt: { lt: archiveCutoff }, archivedAt: null },
      data: { archivedAt: now },
    })
    .then((r) => r.count)
    .catch((err) => {
      console.error("morning-refresh: event archive step failed", err);
      return 0;
    });

  // ── 4. Expire stale open/claimed trades and pending pickups ─────────
  const [tradeResult, pendingPickupResult] = await Promise.allSettled([
    expireOpenTrades(),
    expirePendingPickupCheckouts(now),
  ]);
  const maintenanceFailures: string[] = [];
  const { expired: tradesExpired } = maintenanceValue(
    tradeResult,
    { expired: 0 },
    "tradesExpired",
    maintenanceFailures,
  );
  const pendingPickups = maintenanceValue(
    pendingPickupResult,
    {
      scanned: 0,
      expired: 0,
      failed: 1,
      cutoff: new Date(now.getTime() - DEFAULT_RESERVATION_RULES.noShowExpiryHours * 3_600_000),
      errors: { pendingPickups: "Pending pickup expiry failed" },
    },
    "pendingPickups",
    maintenanceFailures,
  );

  return NextResponse.json({
    ok: maintenanceFailures.length === 0,
    runAt: now.toISOString(),
    sourcesProcessed: sources.length,
    syncResults,
    shiftGroupsArchived: archived,
    eventsArchived,
    tradesExpired,
    pendingPickups,
    maintenanceFailures,
  });
});
