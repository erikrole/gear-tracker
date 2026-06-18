import { Prisma, Role, ShiftArea, ShiftAssignmentStatus, ShiftWorkerType } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { shiftWorkerTypeForRole } from "@/lib/shift-display";
import { evaluateAvailabilityPreferences } from "@/lib/student-availability";

function effectiveShiftWindow(shift: {
  startsAt: Date;
  endsAt: Date;
  callStartsAt?: Date | null;
  callEndsAt?: Date | null;
}) {
  return {
    startsAt: shift.callStartsAt ?? shift.startsAt,
    endsAt: shift.callEndsAt ?? shift.endsAt,
  };
}

async function resolveAssignableShiftForUser(
  tx: Prisma.TransactionClient,
  shift: {
    id: string;
    shiftGroupId: string;
    area: ShiftArea;
    workerType: ShiftWorkerType;
    startsAt: Date;
    endsAt: Date;
    callStartsAt?: Date | null;
    callEndsAt?: Date | null;
  },
  userRole: Role,
) {
  const targetWorkerType = shiftWorkerTypeForRole(userRole);
  if (targetWorkerType === shift.workerType) return shift;

  const compatibleOpenShift = await tx.shift.findFirst({
    where: {
      shiftGroupId: shift.shiftGroupId,
      area: shift.area,
      workerType: targetWorkerType,
      assignments: {
        none: {
          status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (compatibleOpenShift) return compatibleOpenShift;

  const createdShift = await tx.shift.create({
    data: {
      shiftGroupId: shift.shiftGroupId,
      area: shift.area,
      workerType: targetWorkerType,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      callStartsAt: shift.callStartsAt,
      callEndsAt: shift.callEndsAt,
    },
  });

  await tx.shiftGroup.update({
    where: { id: shift.shiftGroupId },
    data: { manuallyEdited: true },
  });

  return createdShift;
}

/**
 * Check if a user already has an active shift assignment during the given time window.
 * Optionally exclude a specific assignment (for swap scenarios).
 */
export async function checkTimeConflict(
  tx: Prisma.TransactionClient,
  userId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAssignmentId?: string,
) {
  const where: Prisma.ShiftAssignmentWhereInput = {
    userId,
    status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] },
    OR: [
      { shift: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } },
      { callStartsAt: { lt: endsAt }, callEndsAt: { gt: startsAt } },
      { shift: { callStartsAt: { lt: endsAt }, callEndsAt: { gt: startsAt } } },
    ],
  };
  if (excludeAssignmentId) {
    where.id = { not: excludeAssignmentId };
  }
  const conflicts = await tx.shiftAssignment.findMany({
    where,
    include: { shift: { select: { startsAt: true, endsAt: true, callStartsAt: true, callEndsAt: true, area: true } } },
    take: 10,
  });
  for (const conflict of conflicts) {
    const conflictStartsAt = conflict.callStartsAt ?? conflict.shift.callStartsAt ?? conflict.shift.startsAt;
    const conflictEndsAt = conflict.callEndsAt ?? conflict.shift.callEndsAt ?? conflict.shift.endsAt;
    if (!(conflictStartsAt < endsAt && conflictEndsAt > startsAt)) continue;
    throw new HttpError(
      409,
      `User already has a shift during this time (${conflict.shift.area})`
    );
  }
}

/**
 * Directly assign a user to a shift. Staff/admin action.
 * Validates no conflicting active assignment exists.
 */
export async function directAssignShift(
  shiftId: string,
  userId: string,
  assignedBy: string,
  opts: { callStartsAt?: Date | null; callEndsAt?: Date | null; callNote?: string | null; notes?: string | null } = {},
) {
  return db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new HttpError(404, "Shift not found");
    const assignee = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        active: true,
        availabilityBlocks: {
          select: {
            kind: true,
            intent: true,
            status: true,
            dayOfWeek: true,
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
    });
    if (!assignee) throw new HttpError(404, "User not found");
    if (!assignee.active) throw new HttpError(400, "Cannot assign an inactive user");

    const targetShift = await resolveAssignableShiftForUser(tx, shift, assignee.role);

    // Check for existing active assignment on this shift
    const existing = await tx.shiftAssignment.findFirst({
      where: { shiftId: targetShift.id, status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] } },
    });
    if (existing) {
      throw new HttpError(409, "This shift already has an active assignment");
    }

    // Check for time conflicts with the user's other shifts
    const conflictWindow = {
      startsAt: opts.callStartsAt ?? effectiveShiftWindow(targetShift).startsAt,
      endsAt: opts.callEndsAt ?? effectiveShiftWindow(targetShift).endsAt,
    };
    await checkTimeConflict(tx, userId, conflictWindow.startsAt, conflictWindow.endsAt);
    const availability = assignee.role === "STUDENT"
      ? evaluateAvailabilityPreferences(assignee.availabilityBlocks ?? [], conflictWindow)
      : null;
    if (availability?.blocking) {
      throw new HttpError(409, availability.blocking.note);
    }
    const conflictNote = availability?.advisory?.note ?? null;

    // Decline any pending requests — slot is being filled by direct assignment
    await tx.shiftAssignment.updateMany({
      where: {
        shiftId: targetShift.id,
        status: "REQUESTED",
      },
      data: { status: "DECLINED" },
    });

    const assignment = await tx.shiftAssignment.create({
      data: {
        shiftId: targetShift.id,
        userId,
        status: "DIRECT_ASSIGNED",
        assignedBy,
        callStartsAt: opts.callStartsAt,
        callEndsAt: opts.callEndsAt,
        callNote: opts.callNote,
        notes: opts.notes,
        hasConflict: Boolean(conflictNote),
        conflictNote,
      },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true, avatarUrl: true } },
      },
    });

    return assignment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Student requests a shift on a premier event.
 * Validates the shift group is marked as premier.
 */
export async function requestShift(shiftId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const [shift, requester] = await Promise.all([
      tx.shift.findUnique({
        where: { id: shiftId },
        include: { shiftGroup: true },
      }),
      tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          availabilityBlocks: {
            select: {
              kind: true,
              intent: true,
              status: true,
              dayOfWeek: true,
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
      }),
    ]);
    if (!shift) throw new HttpError(404, "Shift not found");
    if (!requester) throw new HttpError(404, "User not found");
    if (!shift.shiftGroup.isPremier) {
      throw new HttpError(400, "Shift requests are only available for premier events");
    }

    // Check no active assignment
    const existing = await tx.shiftAssignment.findFirst({
      where: { shiftId, status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] } },
    });
    if (existing) {
      throw new HttpError(409, "This shift already has an active assignment");
    }

    // Check user hasn't already requested
    const alreadyRequested = await tx.shiftAssignment.findFirst({
      where: { shiftId, userId, status: "REQUESTED" },
    });
    if (alreadyRequested) {
      throw new HttpError(409, "You have already requested this shift");
    }

    // Check for time conflicts with the user's other shifts
    const conflictWindow = effectiveShiftWindow(shift);
    await checkTimeConflict(tx, userId, conflictWindow.startsAt, conflictWindow.endsAt);
    const availability = requester.role === "STUDENT"
      ? evaluateAvailabilityPreferences(requester.availabilityBlocks ?? [], conflictWindow)
      : null;
    if (availability?.blocking) {
      throw new HttpError(409, availability.blocking.note);
    }
    const conflictNote = availability?.advisory?.note ?? null;

    return tx.shiftAssignment.create({
      data: {
        shiftId,
        userId,
        status: "REQUESTED",
        hasConflict: Boolean(conflictNote),
        conflictNote,
      },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true } },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Approve a shift request. Staff/admin action.
 */
export async function approveRequest(assignmentId: string) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        shift: true,
        user: {
          select: {
            role: true,
            availabilityBlocks: {
              select: {
                kind: true,
                intent: true,
                status: true,
                dayOfWeek: true,
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
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (assignment.status !== "REQUESTED") {
      throw new HttpError(400, "Only REQUESTED assignments can be approved");
    }

    // Re-check time conflicts — the user may have been assigned another shift
    // between the time they requested and the time staff approves.
    const conflictWindow = effectiveShiftWindow(assignment.shift);
    await checkTimeConflict(tx, assignment.userId, conflictWindow.startsAt, conflictWindow.endsAt);
    const availability = assignment.user?.role === "STUDENT"
      ? evaluateAvailabilityPreferences(assignment.user.availabilityBlocks ?? [], conflictWindow)
      : null;
    if (availability?.blocking) {
      throw new HttpError(409, availability.blocking.note);
    }
    const conflictNote = availability?.advisory?.note ?? assignment.conflictNote;

    // Re-check no other active assignment was created on this shift since the request
    const existing = await tx.shiftAssignment.findFirst({
      where: {
        shiftId: assignment.shiftId,
        status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] },
      },
    });
    if (existing) {
      throw new HttpError(409, "This shift already has an active assignment");
    }

    // Decline all other requests for this shift
    await tx.shiftAssignment.updateMany({
      where: {
        shiftId: assignment.shiftId,
        status: "REQUESTED",
        id: { not: assignmentId },
      },
      data: { status: "DECLINED" },
    });

    return tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: "APPROVED", hasConflict: Boolean(conflictNote), conflictNote },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true } },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Decline a shift request. Staff/admin action.
 */
export async function declineRequest(assignmentId: string) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (assignment.status !== "REQUESTED") {
      throw new HttpError(400, "Only REQUESTED assignments can be declined");
    }

    return tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: "DECLINED" },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Swap: marks old assignment as SWAPPED, creates new assignment for target user.
 */
export async function initiateSwap(
  assignmentId: string,
  targetUserId: string,
  actorId: string
) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: { shift: true },
    });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (!(ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)) {
      throw new HttpError(400, "Only active assignments can be swapped");
    }

    // Check target user doesn't have a conflicting shift
    const conflictWindow = effectiveShiftWindow(assignment.shift);
    await checkTimeConflict(tx, targetUserId, conflictWindow.startsAt, conflictWindow.endsAt);

    // Mark old assignment as swapped
    await tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: "SWAPPED" },
    });

    // Create new assignment
    return tx.shiftAssignment.create({
      data: {
        shiftId: assignment.shiftId,
        userId: targetUserId,
        status: "DIRECT_ASSIGNED",
        assignedBy: actorId,
        swapFromId: assignmentId,
      },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true } },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Remove an assignment (sets to DECLINED).
 * Only active or requested assignments can be removed — terminal statuses are immutable.
 */
export async function removeAssignment(assignmentId: string) {
  const REMOVABLE_STATUSES: ShiftAssignmentStatus[] = [
    "DIRECT_ASSIGNED",
    "APPROVED",
    "REQUESTED",
  ];

  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (!REMOVABLE_STATUSES.includes(assignment.status)) {
      throw new HttpError(400, "This assignment cannot be removed in its current state");
    }

    return tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: "DECLINED" },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
