import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import type { ShiftAssignmentStatus } from "@prisma/client";
import { assertNoWorkingCopy } from "@/lib/schedule-working-copy-guard";
import { createShiftScheduleNotificationFromSnapshot } from "@/lib/services/notifications";

export const DELETE = withAuth<{ id: string; shiftId: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "delete");
  const { id, shiftId } = params;

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const result = await db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: {
        assignments: {
          where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] } },
          include: { user: { select: { email: true, active: true } } },
        },
        shiftGroup: {
          select: {
            publishedAt: true,
            workingCopy: { select: { version: true } },
            event: {
              select: {
                id: true,
                summary: true,
                startsAt: true,
                sportCode: true,
                opponent: true,
                isHome: true,
                locationId: true,
              },
            },
          },
        },
      },
    });
    if (!shift) throw new HttpError(404, "Shift not found");
    if (shift.shiftGroupId !== id) throw new HttpError(400, "Shift does not belong to this group");
    assertNoWorkingCopy(shift.shiftGroup?.workingCopy);

    // Block deletion of shifts with active assignments unless forced
    if (shift.assignments.length > 0 && !force) {
      throw new HttpError(
        409,
        "This shift has active assignments. Use ?force=true to remove anyway.",
      );
    }

    // Cancel any open trades for this shift's assignments
    await tx.shiftTrade.updateMany({
      where: {
        shiftAssignment: { shiftId },
        status: { in: ["OPEN", "CLAIMED"] },
      },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

    // Delete all assignments (both active and historical)
    await tx.shiftAssignment.deleteMany({ where: { shiftId } });

    // Delete the shift
    await tx.shift.delete({ where: { id: shiftId } });

    // Mark group as manually edited
    await tx.shiftGroup.update({
      where: { id },
      data: { manuallyEdited: true },
    });

    return {
      area: shift.area,
      workerType: shift.workerType,
      activeAssignmentCount: shift.assignments.length,
      // Captured before the delete; these rows are gone once it commits.
      removedAssignments: shift.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        shiftId: shift.id,
        userId: assignment.userId,
        userEmail: assignment.user.email,
        userActive: assignment.user.active,
        publishedAt: shift.shiftGroup.publishedAt,
        area: shift.area,
        workerType: shift.workerType,
        shiftStartsAt: shift.startsAt,
        callStartsAt: assignment.callStartsAt ?? shift.callStartsAt ?? shift.startsAt,
        callEndsAt: assignment.callEndsAt ?? shift.callEndsAt ?? shift.endsAt,
        callNote: assignment.callNote,
        calendarEvent: shift.shiftGroup.event,
      })),
    };
    // Serializable so the force gate cannot be raced: at Read Committed a
    // concurrent assignment could commit between the count check and the
    // delete, removing a live assignment without force and recording
    // activeAssignmentCount: 0 in the audit trail.
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: shiftId,
    action: "shift_removed",
    before: {
      area: result.area,
      workerType: result.workerType,
      shiftGroupId: id,
      force,
      activeAssignmentCount: result.activeAssignmentCount,
    },
  });

  // A forced delete takes a worker's shift away. Tell them, the same as
  // removing the assignment directly does.
  for (const removed of result.removedAssignments) {
    createShiftScheduleNotificationFromSnapshot(removed, "removed").catch((error) => {
      console.error("[shift-delete] removal notification failed", error);
    });
  }

  return ok({ data: { id: shiftId, removed: true } });
});
