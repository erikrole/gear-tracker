import { ShiftAssignmentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";

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
    shift: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  };
  if (excludeAssignmentId) {
    where.id = { not: excludeAssignmentId };
  }
  const conflict = await tx.shiftAssignment.findFirst({
    where,
    include: { shift: { select: { startsAt: true, endsAt: true, area: true } } },
  });
  if (conflict) {
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
  assignedBy: string
) {
  return db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new HttpError(404, "Shift not found");

    // Check for existing active assignment on this shift
    const existing = await tx.shiftAssignment.findFirst({
      where: { shiftId, status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] } },
    });
    if (existing) {
      throw new HttpError(409, "This shift already has an active assignment");
    }

    // Check for time conflicts with the user's other shifts
    await checkTimeConflict(tx, userId, shift.startsAt, shift.endsAt);

    return tx.shiftAssignment.create({
      data: {
        shiftId,
        userId,
        status: "DIRECT_ASSIGNED",
        assignedBy,
      },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true } },
      },
    });
  });
}

/**
 * Student requests a shift on a premier event.
 * Validates the shift group is marked as premier.
 */
export async function requestShift(shiftId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: { shiftGroup: true },
    });
    if (!shift) throw new HttpError(404, "Shift not found");
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
    await checkTimeConflict(tx, userId, shift.startsAt, shift.endsAt);

    return tx.shiftAssignment.create({
      data: {
        shiftId,
        userId,
        status: "REQUESTED",
      },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true } },
      },
    });
  });
}

/**
 * Approve a shift request. Staff/admin action.
 */
export async function approveRequest(assignmentId: string) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (assignment.status !== "REQUESTED") {
      throw new HttpError(400, "Only REQUESTED assignments can be approved");
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
      data: { status: "APPROVED" },
      include: {
        user: { select: { id: true, name: true, role: true, primaryArea: true } },
      },
    });
  });
}

/**
 * Decline a shift request. Staff/admin action.
 */
export async function declineRequest(assignmentId: string) {
  const assignment = await db.shiftAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new HttpError(404, "Assignment not found");
  if (assignment.status !== "REQUESTED") {
    throw new HttpError(400, "Only REQUESTED assignments can be declined");
  }

  return db.shiftAssignment.update({
    where: { id: assignmentId },
    data: { status: "DECLINED" },
  });
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
    await checkTimeConflict(tx, targetUserId, assignment.shift.startsAt, assignment.shift.endsAt);

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
  });
}

/**
 * Remove an assignment (sets to DECLINED).
 */
export async function removeAssignment(assignmentId: string) {
  const assignment = await db.shiftAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new HttpError(404, "Assignment not found");

  return db.shiftAssignment.update({
    where: { id: assignmentId },
    data: { status: "DECLINED" },
  });
}
