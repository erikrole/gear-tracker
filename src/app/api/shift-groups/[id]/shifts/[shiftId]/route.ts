import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import type { ShiftAssignmentStatus } from "@prisma/client";

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
        },
      },
    });
    if (!shift) throw new HttpError(404, "Shift not found");
    if (shift.shiftGroupId !== id) throw new HttpError(400, "Shift does not belong to this group");

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
      data: { status: "CANCELLED" },
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

    return { area: shift.area, workerType: shift.workerType };
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: shiftId,
    action: "shift_removed",
    before: { area: result.area, workerType: result.workerType, shiftGroupId: id },
  });

  return ok({ data: { id: shiftId, removed: true } });
});
