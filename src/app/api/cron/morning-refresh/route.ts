import { NextResponse } from "next/server";
import { withCron } from "@/lib/cron";
import { db } from "@/lib/db";
import { syncCalendarSource, type SyncResult } from "@/lib/services/calendar-sync";
import { updateCalendarSyncHealth } from "@/lib/services/calendar-sync-health";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { expireOpenTrades } from "@/lib/services/shift-trades";
import { expirePendingPickupCheckouts } from "@/lib/services/pending-pickup-expiry";
import { pollFirmwareWatchTargets } from "@/lib/services/firmware-watch";
import { DEFAULT_RESERVATION_RULES } from "@/lib/services/reservation-rules";
import { getScheduleAutomationDigest } from "@/lib/services/schedule-automation";
import { recordScheduleSyncChanges } from "@/lib/services/schedule-sync-changes";
import { badges, badgesEnabled } from "@/lib/badges";

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

/** How far back to look for shifts that just finished. The cron runs nightly;
 *  two days is that cadence plus slack for a missed or delayed run. */
const SHIFT_BADGE_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;

/** Events older than this many months are soft-archived (archivedAt stamped). */
const EVENT_ARCHIVE_MONTHS = 4;

/**
 * Nightly 3 AM Central refresh (08:00 UTC):
 *   1. Sync all enabled calendar sources (fetch ICS, upsert events)
 *   2. Generate shifts for any newly synced events
 *   3. Archive shift groups for events that have ended, and award shift badges
 *      for the crew whose shifts just finished
 *   4. Archive calendar events older than EVENT_ARCHIVE_MONTHS
 *   5. Expire stale open trades and pending kiosk pickups
 *   6. Poll official firmware watch targets
 *
 * Nothing is deleted — archiving only sets archivedAt so all records remain
 * available for historical stats (future Wrapped feature).
 */
export const GET = withCron(async () => {
  const now = new Date();
  const maintenanceFailures: string[] = [];
  const syncResults: Array<{
    sourceId: string;
    sourceName: string;
    eventsAdded?: number;
    eventsUpdated?: number;
    groupsCreated?: number;
    shiftsCreated?: number;
    error?: string;
    consecutiveFailures?: number;
    adminNotificationsCreated?: number;
  }> = [];
  const syncChangeSources: Array<{
    sourceId: string;
    sourceName: string;
    result: SyncResult;
  }> = [];

  // ── 1. Sync all enabled calendar sources ──────────────────────────────
  const sources = await db.calendarSource.findMany({
    where: { enabled: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  for (const source of sources) {
    try {
      const syncResult = await syncCalendarSource(source.id, { includeChanges: true });
      syncChangeSources.push({
        sourceId: source.id,
        sourceName: source.name,
        result: syncResult,
      });
      const shiftResult = await generateShiftsForNewEvents(source.id);
      const healthResult = await recordCalendarSyncHealth({
        sourceId: source.id,
        sourceName: source.name,
        result: syncResult,
        now,
      });

      syncResults.push({
        sourceId: source.id,
        sourceName: source.name,
        eventsAdded: syncResult.added ?? 0,
        eventsUpdated: syncResult.updated ?? 0,
        groupsCreated: shiftResult.groupsCreated,
        shiftsCreated: shiftResult.shiftsCreated,
        error: syncResult.error,
        consecutiveFailures: healthResult.consecutiveFailures,
        adminNotificationsCreated: healthResult.notificationsCreated,
      });
    } catch (err) {
      console.error(`morning-refresh: sync failed for source ${source.name}:`, err);
      const error = err instanceof Error ? err.message : "Unknown error";
      const failedResult: SyncResult = {
        added: 0,
        updated: 0,
        cancelled: 0,
        skipped: 0,
        errors: [],
        error,
      };
      syncChangeSources.push({
        sourceId: source.id,
        sourceName: source.name,
        result: failedResult,
      });
      const healthResult = await recordCalendarSyncHealth({
        sourceId: source.id,
        sourceName: source.name,
        result: failedResult,
        now,
      });
      syncResults.push({
        sourceId: source.id,
        sourceName: source.name,
        error,
        consecutiveFailures: healthResult.consecutiveFailures,
        adminNotificationsCreated: healthResult.notificationsCreated,
      });
    }
  }

  const scheduleSyncChanges = await recordScheduleSyncChanges({
    runAt: now,
    sources: syncChangeSources,
  }).catch((err) => {
    console.error("morning-refresh: schedule sync change digest failed", err);
    maintenanceFailures.push("scheduleSyncChanges");
    return null;
  });

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

  // ── 2b. Recognise shift work that just finished ──────────────────────
  // Nothing calls the server when a game ends, so this is the one badge family
  // without a request to hang itself on. It is bounded to people whose shift
  // ended in the last couple of days -- the nightly cadence plus slack -- and
  // each evaluation recounts that person's full history, so a first qualifying
  // shift awards every threshold they had already passed.
  let shiftBadgeUsers = 0;
  if (badgesEnabled()) {
    try {
      const recentlyEnded = await db.shiftAssignment.findMany({
        where: {
          status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
          shift: {
            shiftGroup: {
              event: {
                status: "CONFIRMED",
                endsAt: { lt: now, gte: new Date(now.getTime() - SHIFT_BADGE_LOOKBACK_MS) },
              },
            },
          },
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      for (const { userId } of recentlyEnded) {
        await badges.onShiftsWorked({ userId });
      }
      shiftBadgeUsers = recentlyEnded.length;
    } catch (err) {
      console.error("morning-refresh: shift badge step failed", err);
    }
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
  const [tradeResult, pendingPickupResult, firmwareWatchResult] = await Promise.allSettled([
    expireOpenTrades(),
    expirePendingPickupCheckouts(now),
    pollFirmwareWatchTargets({ now }),
  ]);
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
  const firmwareWatch = maintenanceValue(
    firmwareWatchResult,
    {
      checked: 0,
      changed: 0,
      baselined: 0,
      failed: 1,
      notificationsCreated: 0,
      errors: [{ targetId: "unknown", product: "Firmware watch", error: "Firmware watch failed" }],
    },
    "firmwareWatch",
    maintenanceFailures,
  );
  const automationDigest = await getScheduleAutomationDigest({
    userId: "system",
    includePast: false,
    includeArchived: false,
    sportCode: null,
    now,
    maintenance: {
      syncResults,
      shiftGroupsArchived: archived,
      eventsArchived,
      tradesExpired,
      pendingPickupsExpired: pendingPickups.expired,
    },
  }).catch((err) => {
    console.error("morning-refresh: schedule automation digest failed", err);
    maintenanceFailures.push("scheduleAutomation");
    return null;
  });

  return NextResponse.json({
    ok: maintenanceFailures.length === 0,
    runAt: now.toISOString(),
    sourcesProcessed: sources.length,
    syncResults,
    shiftGroupsArchived: archived,
    shiftBadgeUsers,
    eventsArchived,
    tradesExpired,
    pendingPickups,
    firmwareWatch,
    scheduleAutomation: automationDigest,
    scheduleSyncChanges,
    maintenanceFailures,
  });
});

async function recordCalendarSyncHealth(args: {
  sourceId: string;
  sourceName: string;
  result: Awaited<ReturnType<typeof syncCalendarSource>>;
  now: Date;
}) {
  try {
    return await updateCalendarSyncHealth(args);
  } catch (err) {
    console.error(`morning-refresh: sync health update failed for source ${args.sourceName}:`, err);
    return {
      sourceId: args.sourceId,
      sourceName: args.sourceName,
      consecutiveFailures: 0,
      failed: Boolean(args.result.error),
      notificationsCreated: 0,
    };
  }
}
