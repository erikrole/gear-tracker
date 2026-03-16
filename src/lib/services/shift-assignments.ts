import { ShiftAssignmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";

/** Active (non-terminal) statuses */
const ACTIVE_STATUSES: ShiftAssignmentStatus[] = ["DIRECT_ASSIGNED", "APPROVED"];

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
      where: { shiftId, status: { in: ACTIVE_STATUSES } },
    });
    if (existing) {
      throw new HttpError(409, "This shift already has an active assignment");
    }

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
      where: { shiftId, status: { in: ACTIVE_STATUSES } },
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
    });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (!ACTIVE_STATUSES.includes(assignment.status)) {
      throw new HttpError(400, "Only active assignments can be swapped");
    }

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
