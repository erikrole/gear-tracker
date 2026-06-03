/**
 * Auto-assignment service.
 *
 * For each unassigned shift in a ShiftGroup, finds users who are:
 *   - Sport-assigned to the event's sportCode
 *   - Area-assigned (or area-matched) to the shift's area
 *   - Not already DIRECT_ASSIGNED or APPROVED on a conflicting shift
 *
 * Creates DIRECT_ASSIGNED ShiftAssignment rows and checks each user's
 * StudentAvailabilityBlock schedule, marking hasConflict + conflictNote
 * when the shift overlaps a class block.
 *
 * ST shifts → users with role STUDENT
 * FT shifts → users with role STAFF or ADMIN
 *
 * Wraps the read-of-unassigned + createMany in a single SERIALIZABLE
 * transaction to prevent duplicate assignments under concurrent requests.
 */

import { Prisma, ShiftArea } from "@prisma/client";
import { db } from "@/lib/db";
import { availabilityConflictNote } from "@/lib/student-availability";

/* ── Helpers ─────────────────────────────────────────── */

/* ── Main export ─────────────────────────────────────── */

export type AutoAssignResult = {
  assigned: number;
  conflicts: number;
  skipped: number;
};

/**
 * Auto-assign all unassigned shifts in a ShiftGroup.
 *
 * @param shiftGroupId  The group to fill.
 * @param actorId       Staff user triggering the action (recorded as assignedBy).
 */
export async function autoAssignShiftGroup(
  shiftGroupId: string,
  actorId: string,
): Promise<AutoAssignResult> {
  // ── 1. Load the shift group with event + unassigned shifts ──
  const group = await db.shiftGroup.findUnique({
    where: { id: shiftGroupId },
    include: {
      event: { select: { sportCode: true, startsAt: true, endsAt: true } },
      shifts: {
        include: {
          assignments: {
            where: {
              status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
            },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!group || !group.event.sportCode) {
    return { assigned: 0, conflicts: 0, skipped: 0 };
  }

  const { sportCode } = group.event;

  // ── 2. Find unassigned shifts ──
  const unassigned = group.shifts.filter((s) => s.assignments.length === 0);
  if (unassigned.length === 0) {
    return { assigned: 0, conflicts: 0, skipped: 0 };
  }

  // ── 3. Load all area assignments for users with a sport assignment to this sport ──
  const sportAssignments = await db.studentSportAssignment.findMany({
    where: { sportCode },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          role: true,
          areaAssignments: {
            select: { area: true, isPrimary: true },
          },
          availabilityBlocks: {
            select: {
              dayOfWeek: true,
              kind: true,
              date: true,
              startsAt: true,
              endsAt: true,
              label: true,
              semesterLabel: true,
              semesterStartsOn: true,
              semesterEndsOn: true,
            },
          },
        },
      },
    },
  });

  // Index by userId for quick lookup
  const userMap = new Map(
    sportAssignments.map((sa) => [sa.userId, sa.user]),
  );

  // ── 4. Pre-compute shift time components (local TZ) ──
  // We use the shift's own startsAt/endsAt if present; otherwise fall back to event times.
  // All shifts within one group share the same times (per generation logic),
  // but we read each shift individually for correctness.
  const shiftTimeCache = new Map<
    string,
    { startsAt: Date; endsAt: Date }
  >();
  for (const shift of unassigned) {
    shiftTimeCache.set(shift.id, {
      startsAt: shift.callStartsAt ?? shift.startsAt,
      endsAt: shift.callEndsAt ?? shift.endsAt,
    });
  }

  // ── 5. Build assignments ──
  // Strategy: for each unassigned shift, pick the first eligible user who
  // has an area assignment matching the shift's area and the correct role.
  // We track which users have been assigned in this run to avoid double-booking.
  const assignedInThisRun = new Set<string>();

  type PendingAssignment = {
    shiftId: string;
    userId: string;
    hasConflict: boolean;
    conflictNote: string | null;
  };

  const pending: PendingAssignment[] = [];

  for (const shift of unassigned) {
    const shiftTimes = shiftTimeCache.get(shift.id)!;

    // Pick eligible users for this shift
    const eligible = sportAssignments.filter((sa) => {
      const user = userMap.get(sa.userId);
      if (!user) return false;
      if (assignedInThisRun.has(sa.userId)) return false;

      // Role filter
      if (shift.workerType === "ST" && user.role !== "STUDENT") return false;
      if (shift.workerType === "FT" && user.role === "STUDENT") return false;

      // Area filter — user must have this area assigned
      const hasArea = user.areaAssignments.some(
        (aa) => aa.area === (shift.area as ShiftArea),
      );
      return hasArea;
    });

    if (eligible.length === 0) {
      continue;
    }

    // Sort: primary-area users first, then alphabetical by userId (stable)
    eligible.sort((a, b) => {
      const aUser = userMap.get(a.userId)!;
      const bUser = userMap.get(b.userId)!;
      const aPrimary = aUser.areaAssignments.some(
        (aa) => aa.area === (shift.area as ShiftArea) && aa.isPrimary,
      );
      const bPrimary = bUser.areaAssignments.some(
        (aa) => aa.area === (shift.area as ShiftArea) && aa.isPrimary,
      );
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return a.userId.localeCompare(b.userId);
    });

    const chosen = eligible[0]!; // eligible.length === 0 case continues above
    const chosenUser = userMap.get(chosen.userId)!;
    assignedInThisRun.add(chosen.userId);

    // ── Check availability conflict ──
    const conflictNote = availabilityConflictNote(chosenUser.availabilityBlocks, shiftTimes);

    pending.push({
      shiftId: shift.id,
      userId: chosen.userId,
      hasConflict: Boolean(conflictNote),
      conflictNote,
    });
  }

  if (pending.length === 0) {
    return { assigned: 0, conflicts: 0, skipped: unassigned.length };
  }

  // ── 6. Write in a SERIALIZABLE transaction (prevents concurrent duplicates) ──
  await db.$transaction(async (tx) => {
    // Re-check: skip any shiftIds that got assigned between our read and now
    const alreadyAssigned = await tx.shiftAssignment.findMany({
      where: {
        shiftId: { in: pending.map((p) => p.shiftId) },
        status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
      },
      select: { shiftId: true },
    });
    const alreadySet = new Set(alreadyAssigned.map((a) => a.shiftId));

    const toCreate = pending.filter((p) => !alreadySet.has(p.shiftId));
    if (toCreate.length === 0) return;

    await tx.shiftAssignment.createMany({
      data: toCreate.map((p) => ({
        shiftId: p.shiftId,
        userId: p.userId,
        status: "DIRECT_ASSIGNED" as const,
        assignedBy: actorId,
        hasConflict: p.hasConflict,
        conflictNote: p.conflictNote,
      })),
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const conflicts = pending.filter((p) => p.hasConflict).length;
  return {
    assigned: pending.length,
    conflicts,
    skipped: unassigned.length - pending.length,
  };
}
