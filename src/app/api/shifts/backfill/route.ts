export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { generateShiftsForEvent } from "@/lib/services/shift-generation";
import { createAuditEntry } from "@/lib/audit";

/**
 * One-time backfill: generate shifts for future events that have a
 * sportCode and matching SportConfig but no ShiftGroup yet.
 */
export async function POST() {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "create");

    const events = await db.calendarEvent.findMany({
      where: {
        sportCode: { not: null },
        shiftGroup: null,
        startsAt: { gte: new Date() },
      },
      select: { id: true, sportCode: true },
    });

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const result = await generateShiftsForEvent(event.id);
        if (result.created) {
          processed++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push(`${event.id}: ${err instanceof Error ? err.message : "Unknown"}`);
        skipped++;
      }
    }

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_backfill",
      entityId: "backfill",
      action: "shift_backfill_executed",
      after: { processed, skipped, errors: errors.slice(0, 10) },
    });

    return ok({ data: { total: events.length, processed, skipped, errors: errors.slice(0, 10) } });
  } catch (error) {
    return fail(error);
  }
}
