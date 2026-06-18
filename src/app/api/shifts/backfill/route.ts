import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { generateShiftsForEvents } from "@/lib/services/shift-generation";
import { createAuditEntry } from "@/lib/audit";
import { startOfTodayInAppTz } from "@/lib/app-time";

/**
 * One-time backfill: generate shifts for future events that have a
 * sportCode and matching SportConfig but no ShiftGroup yet.
 */
export const POST = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "shift", "create");

  const result = await generateShiftsForEvents({
    where: {
      sportCode: { not: null },
      shiftGroup: null,
      // Include events still happening today (all-day events start at midnight),
      // not just those starting in the future.
      endsAt: { gt: startOfTodayInAppTz() },
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_backfill",
    entityId: "backfill",
    action: "shift_backfill_executed",
    after: { processed: result.groupsCreated, shiftsCreated: result.shiftsCreated },
  });

  return ok({
    data: {
      total: result.eventsMatched,
      processed: result.groupsCreated,
      skipped: result.eventsMatched - result.groupsCreated,
      shiftsCreated: result.shiftsCreated,
      hasMore: result.hasMore,
    },
  });
});
