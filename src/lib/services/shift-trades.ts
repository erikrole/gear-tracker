import { Prisma, ShiftTradeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { checkTimeConflict } from "@/lib/services/shift-assignments";

/**
 * Post a shift assignment to the trade board.
 * Validates the user owns the assignment and it's active.
 */
export async function postTrade(
  shiftAssignmentId: string,
  userId: string,
  notes?: string
) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({
      where: { id: shiftAssignmentId },
      include: {
        shift: { include: { shiftGroup: true } },
      },
    });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (assignment.userId !== userId) {
      throw new HttpError(403, "You can only trade your own shifts");
    }
    if (
      !(ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)
    ) {
      throw new HttpError(400, "Only active assignments can be traded");
    }

    // Check no existing open trade for this assignment
    const existing = await tx.shiftTrade.findFirst({
      where: {
        shiftAssignmentId,
        status: { in: ["OPEN", "CLAIMED"] },
      },
    });
    if (existing) {
      throw new HttpError(409, "This shift already has an open trade");
    }

    return tx.shiftTrade.create({
      data: {
        shiftAssignmentId,
        postedByUserId: userId,
        requiresApproval: assignment.shift.shiftGroup.isPremier,
        notes,
      },
      include: {
        shiftAssignment: {
          include: {
            shift: {
              include: {
                shiftGroup: { include: { event: true } },
              },
            },
            user: { select: { id: true, name: true, primaryArea: true } },
          },
        },
        postedBy: { select: { id: true, name: true } },
      },
    });
  });
}

/**
 * Claim an open trade. If no approval required, executes swap immediately.
 */
export async function claimTrade(tradeId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({
      where: { id: tradeId },
      include: {
        shiftAssignment: {
          include: { shift: true },
        },
      },
    });
    if (!trade) throw new HttpError(404, "Trade not found");
    if (trade.status !== "OPEN") {
      throw new HttpError(409, "Trade is no longer open");
    }
    if (trade.postedByUserId === userId) {
      throw new HttpError(400, "You cannot claim your own trade");
    }

    // Validate claimant doesn't have a conflicting shift during this time
    const shift = trade.shiftAssignment.shift;
    await checkTimeConflict(tx, userId, shift.startsAt, shift.endsAt);

    // Validate claimant's primary area matches the shift area
    const claimant = await tx.user.findUnique({
      where: { id: userId },
      select: { primaryArea: true, role: true },
    });
    if (claimant?.primaryArea && claimant.primaryArea !== shift.area) {
      throw new HttpError(400, `Your primary area (${claimant.primaryArea}) does not match this shift's area (${shift.area})`);
    }

    if (trade.requiresApproval) {
      // Set to CLAIMED, awaiting staff approval
      return tx.shiftTrade.update({
        where: { id: tradeId },
        data: {
          claimedByUserId: userId,
          claimedAt: new Date(),
          status: "CLAIMED",
        },
        include: {
          shiftAssignment: {
            include: {
              shift: {
                include: { shiftGroup: { include: { event: true } } },
              },
              user: { select: { id: true, name: true } },
            },
          },
          postedBy: { select: { id: true, name: true } },
          claimedBy: { select: { id: true, name: true } },
        },
      });
    }

    // No approval needed — execute swap immediately
    await executeSwap(tx, trade.shiftAssignment.id, userId, trade.postedByUserId);

    return tx.shiftTrade.update({
      where: { id: tradeId },
      data: {
        claimedByUserId: userId,
        claimedAt: new Date(),
        resolvedAt: new Date(),
        status: "COMPLETED",
      },
      include: {
        shiftAssignment: {
          include: {
            shift: {
              include: { shiftGroup: { include: { event: true } } },
            },
            user: { select: { id: true, name: true } },
          },
        },
        postedBy: { select: { id: true, name: true } },
        claimedBy: { select: { id: true, name: true } },
      },
    });
  });
}

/**
 * Staff approves a claimed trade → executes swap.
 */
export async function approveTrade(tradeId: string) {
  return db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({
      where: { id: tradeId },
      include: { shiftAssignment: true },
    });
    if (!trade) throw new HttpError(404, "Trade not found");
    if (trade.status !== "CLAIMED") {
      throw new HttpError(400, "Only claimed trades can be approved");
    }
    if (!trade.claimedByUserId) {
      throw new HttpError(400, "Trade has no claimer");
    }

    await executeSwap(tx, trade.shiftAssignment.id, trade.claimedByUserId, trade.postedByUserId);

    return tx.shiftTrade.update({
      where: { id: tradeId },
      data: {
        resolvedAt: new Date(),
        status: "COMPLETED",
      },
    });
  });
}

/**
 * Staff declines a claimed trade → back to OPEN.
 */
export async function declineTrade(tradeId: string) {
  return db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new HttpError(404, "Trade not found");
    if (trade.status !== "CLAIMED") {
      throw new HttpError(400, "Only claimed trades can be declined");
    }

    return tx.shiftTrade.update({
      where: { id: tradeId },
      data: {
        claimedByUserId: null,
        claimedAt: null,
        status: "OPEN",
      },
    });
  });
}

/**
 * Poster cancels their own trade.
 */
export async function cancelTrade(tradeId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new HttpError(404, "Trade not found");
    if (trade.postedByUserId !== userId) {
      throw new HttpError(403, "You can only cancel your own trades");
    }
    if (trade.status !== "OPEN" && trade.status !== "CLAIMED") {
      throw new HttpError(400, "Trade cannot be cancelled in its current state");
    }

    return tx.shiftTrade.update({
      where: { id: tradeId },
      data: {
        resolvedAt: new Date(),
        status: "CANCELLED",
      },
    });
  });
}

/**
 * List trades, optionally filtered by status and area.
 */
export async function listTrades(filters: {
  status?: ShiftTradeStatus;
  area?: string;
  userId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.area) {
    where.shiftAssignment = {
      shift: { area: filters.area },
    };
  }

  return db.shiftTrade.findMany({
    where,
    include: {
      shiftAssignment: {
        include: {
          shift: {
            include: {
              shiftGroup: {
                include: {
                  event: {
                    select: {
                      id: true,
                      summary: true,
                      startsAt: true,
                      endsAt: true,
                      sportCode: true,
                    },
                  },
                },
              },
            },
          },
          user: { select: { id: true, name: true, primaryArea: true } },
        },
      },
      postedBy: { select: { id: true, name: true } },
      claimedBy: { select: { id: true, name: true } },
    },
    orderBy: { postedAt: "desc" },
  });
}

/* ── Internal helpers ── */

async function executeSwap(tx: Prisma.TransactionClient, assignmentId: string, targetUserId: string, actorId: string) {
  // Fetch assignment with shift times for conflict check
  const assignment = await tx.shiftAssignment.findUnique({
    where: { id: assignmentId },
    include: { shift: true },
  });
  if (!assignment) throw new HttpError(404, "Assignment not found during swap");

  // Validate target user has no conflicting shifts (exclude the assignment being swapped)
  await checkTimeConflict(tx, targetUserId, assignment.shift.startsAt, assignment.shift.endsAt, assignmentId);

  // Mark old assignment as SWAPPED
  await tx.shiftAssignment.update({
    where: { id: assignmentId },
    data: { status: "SWAPPED" },
  });

  // Create new assignment for claimer
  return tx.shiftAssignment.create({
    data: {
      shiftId: assignment.shiftId,
      userId: targetUserId,
      status: "DIRECT_ASSIGNED",
      assignedBy: actorId,
      swapFromId: assignmentId,
    },
  });
}
