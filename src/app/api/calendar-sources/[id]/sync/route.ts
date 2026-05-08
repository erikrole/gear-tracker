import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { syncCalendarSource } from "@/lib/services/calendar-sync";
import { generateShiftsForNewEvents } from "@/lib/services/shift-generation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

const SYNC_LEASE_MS = 10 * 60_000;

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "sync");
  // Sync hits an external ICS URL — tighter limit than other settings writes.
  await enforceRateLimit(`calendar-sources:sync:${user.id}`, { max: 10, windowMs: 60_000 });
  const { id } = params;
  const leaseOwner = randomUUID();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + SYNC_LEASE_MS);
  const acquired = await db.calendarSource.updateMany({
    where: {
      id,
      enabled: true,
      OR: [
        { syncLeaseUntil: null },
        { syncLeaseUntil: { lt: now } },
      ],
    },
    data: {
      syncLeaseUntil: leaseUntil,
      syncLeaseOwner: leaseOwner,
    },
  });

  if (acquired.count === 0) {
    const source = await db.calendarSource.findUnique({
      where: { id },
      select: { enabled: true, syncLeaseUntil: true },
    });
    if (source?.enabled) {
      throw new HttpError(409, "Calendar source sync is already running. Try again shortly.");
    }
  }

  let result: Awaited<ReturnType<typeof syncCalendarSource>>;
  let shouldReleaseLease = acquired.count > 0;
  try {
    result = await syncCalendarSource(id);

    // Post-sync: auto-generate shifts for newly synced events
    let shiftGeneration: { groupsCreated: number; shiftsCreated: number } | null = null;
    let shiftGenerationError: string | null = null;
    try {
      shiftGeneration = await generateShiftsForNewEvents(id);
    } catch (err) {
      console.error("Shift generation after sync failed:", err);
      shiftGenerationError = err instanceof Error ? err.message : "Unknown error";
    }

    // Return 200 even for partial failures — include error detail so UI can surface it
    return ok({
      data: {
        ...result,
        shiftGeneration: shiftGeneration ?? { groupsCreated: 0, shiftsCreated: 0 },
        shiftGenerationError,
      },
    });
  } finally {
    if (shouldReleaseLease) {
      shouldReleaseLease = false;
      await db.calendarSource.updateMany({
        where: { id, syncLeaseOwner: leaseOwner },
        data: { syncLeaseUntil: null, syncLeaseOwner: null },
      });
    }
  }
});
