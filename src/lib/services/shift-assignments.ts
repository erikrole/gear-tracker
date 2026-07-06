import { Prisma, Role, ShiftArea, ShiftAssignmentStatus, ShiftWorkerType } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { shiftWorkerTypeForProfile } from "@/lib/shift-display";
import { evaluateAvailabilityPreferences } from "@/lib/student-availability";

export type RoleSlotOutcome = {
  requestedShiftId: string;
  targetShiftId: string;
  originalWorkerType: ShiftWorkerType;
  assignedWorkerType: ShiftWorkerType;
  movedToMatchingSlot: boolean;
  createdMatchingSlot: boolean;
  reusedMatchingSlot: boolean;
};

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
  userProfile: {
    role: Role;
    staffingType: ShiftWorkerType;
  },
) {
  const targetWorkerType = shiftWorkerTypeForProfile(userProfile) ?? "FT";
  if (targetWorkerType === shift.workerType) {
    return {
      shift,
      outcome: {
        requestedShiftId: shift.id,
        targetShiftId: shift.id,
        originalWorkerType: shift.workerType,
        assignedWorkerType: targetWorkerType,
        movedToMatchingSlot: false,
        createdMatchingSlot: false,
        reusedMatchingSlot: false,
      } satisfies RoleSlotOutcome,
    };
  }

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

  if (compatibleOpenShift) {
    return {
      shift: compatibleOpenShift,
      outcome: {
        requestedShiftId: shift.id,
        targetShiftId: compatibleOpenShift.id,
        originalWorkerType: shift.workerType,
        assignedWorkerType: targetWorkerType,
        movedToMatchingSlot: true,
        createdMatchingSlot: false,
        reusedMatchingSlot: true,
      } satisfies RoleSlotOutcome,
    };
  }

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

  return {
    shift: createdShift,
    outcome: {
      requestedShiftId: shift.id,
      targetShiftId: createdShift.id,
      originalWorkerType: shift.workerType,
      assignedWorkerType: targetWorkerType,
      movedToMatchingSlot: true,
      createdMatchingSlot: true,
      reusedMatchingSlot: false,
    } satisfies RoleSlotOutcome,
  };
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
  // No row cap: the where clause is a raw-window prefilter, and a capped read
  // could return only rows the effective-window recheck filters out while a
  // real conflict sits past the cap.
  const conflicts = await tx.shiftAssignment.findMany({
    where,
    include: { shift: { select: { startsAt: true, endsAt: true, callStartsAt: true, callEndsAt: true, area: true } } },
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
  const result = await directAssignShiftWithOutcome(shiftId, userId, assignedBy, opts);
  return result.assignment;
}

export async function directAssignShiftWithOutcome(
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
        staffingType: true,
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

    const { shift: targetShift, outcome } = await resolveAssignableShiftForUser(tx, shift, assignee);

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
    const availability = outcome.assignedWorkerType === "ST"
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
        user: { select: { id: true, name: true, role: true, staffingType: true, primaryArea: true, avatarUrl: true } },
      },
    });

    return { assignment, outcome };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function repairRoleSlotMismatch(assignmentId: string) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: { select: { id: true, role: true, staffingType: true, name: true } },
        shift: true,
      },
    });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (!(ACTIVE_ASSIGNMENT_STATUSES as readonly ShiftAssignmentStatus[]).includes(assignment.status)) {
      throw new HttpError(400, "Only active assignments can be repaired");
    }

    const targetWorkerType = shiftWorkerTypeForProfile(assignment.user) ?? "FT";
    if (targetWorkerType === assignment.shift.workerType) {
      return {
        assignment,
        outcome: {
          requestedShiftId: assignment.shift.id,
          targetShiftId: assignment.shift.id,
          originalWorkerType: assignment.shift.workerType,
          assignedWorkerType: targetWorkerType,
          movedToMatchingSlot: false,
          createdMatchingSlot: false,
          reusedMatchingSlot: false,
        } satisfies RoleSlotOutcome,
      };
    }

    const { shift: targetShift, outcome } = await resolveAssignableShiftForUser(tx, assignment.shift, assignment.user);

    const existing = await tx.shiftAssignment.findFirst({
      where: {
        shiftId: targetShift.id,
        id: { not: assignment.id },
        status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] },
      },
    });
    if (existing) {
      throw new HttpError(409, "Matching slot already has an active assignment");
    }

    await tx.shiftAssignment.updateMany({
      where: {
        shiftId: targetShift.id,
        status: "REQUESTED",
      },
      data: { status: "DECLINED" },
    });

    const repaired = await tx.shiftAssignment.update({
      where: { id: assignment.id },
      data: { shiftId: targetShift.id },
      include: {
        user: { select: { id: true, name: true, role: true, staffingType: true, primaryArea: true, avatarUrl: true } },
      },
    });

    await tx.shiftGroup.update({
      where: { id: assignment.shift.shiftGroupId },
      data: { manuallyEdited: true },
    });

    return { assignment: repaired, outcome };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requestShift(shiftId: string, userId: string) {
  void shiftId;
  void userId;
  throw new HttpError(410, "Shift requests are retired. Claim open shifts instead.");
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
            staffingType: true,
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
    const availability = shiftWorkerTypeForProfile(assignment.user) === "ST"
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
        user: { select: { id: true, name: true, role: true, staffingType: true, primaryArea: true } },
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

    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        staffingType: true,
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
    if (!target) throw new HttpError(404, "User not found");
    if (!target.active) throw new HttpError(400, "Cannot assign an inactive user");

    // Check target user doesn't have a conflicting shift
    const conflictWindow = effectiveShiftWindow(assignment.shift);
    await checkTimeConflict(tx, targetUserId, conflictWindow.startsAt, conflictWindow.endsAt);
    const availability = shiftWorkerTypeForProfile(target) === "ST"
      ? evaluateAvailabilityPreferences(target.availabilityBlocks ?? [], conflictWindow)
      : null;
    if (availability?.blocking) {
      throw new HttpError(409, availability.blocking.note);
    }
    const conflictNote = availability?.advisory?.note ?? null;

    // The outgoing worker no longer holds this shift — a live Trade Board
    // post for it would let someone claim a slot that already changed hands.
    await tx.shiftTrade.updateMany({
      where: {
        shiftAssignmentId: assignmentId,
        status: { in: ["OPEN", "CLAIMED"] },
      },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

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
        hasConflict: Boolean(conflictNote),
        conflictNote,
      },
      include: {
        user: { select: { id: true, name: true, role: true, staffingType: true, primaryArea: true } },
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

    // A removed assignment must not stay advertised on the Trade Board —
    // the poster no longer holds the shift a claimer would be taking over.
    await tx.shiftTrade.updateMany({
      where: {
        shiftAssignmentId: assignmentId,
        status: { in: ["OPEN", "CLAIMED"] },
      },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

    return tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: "DECLINED" },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
