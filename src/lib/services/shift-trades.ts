import { Prisma, ShiftTradeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { checkTimeConflict } from "@/lib/services/shift-assignments";

/* ── Timezone / class-conflict helpers ──────────────────────────────── */

const TZ = process.env.INSTITUTION_TZ ?? "America/Chicago";

function toLocalComponents(dt: Date): { day: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(dt);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return {
    day: weekdayMap[weekday] ?? 1,
    hhmm: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

function timeOverlaps(s1: string, e1: string, s2: string, e2: string) {
  return s1 < e2 && e1 > s2;
}

/* ── In-app notification helper ─────────────────────────────────────── */

async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  dedupeKey: string,
  payload?: Prisma.InputJsonValue,
) {
  try {
    await db.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        payload: payload ?? {},
        channel: "IN_APP",
        sentAt: new Date(),
        dedupeKey,
      },
    });
  } catch {
    // Silently swallow duplicate/constraint errors — notifications are best-effort
  }
}

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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
          include: {
            shift: {
              include: { shiftGroup: { include: { event: { select: { summary: true } } } } },
            },
          },
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

    const eventSummary =
      trade.shiftAssignment.shift.shiftGroup?.event?.summary ?? "your shift";

    if (trade.requiresApproval) {
      const updated = await tx.shiftTrade.update({
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

      // Notify poster: someone claimed, pending staff approval
      await notify(
        trade.postedByUserId,
        "trade_claimed",
        "Your trade was claimed",
        `${updated.claimedBy?.name ?? "Someone"} claimed your ${shift.area} shift for ${eventSummary}. Awaiting staff approval.`,
        `trade_claimed_${tradeId}`,
        { tradeId },
      );

      return updated;
    }

    // No approval needed — execute swap immediately
    await executeSwap(tx, trade.shiftAssignment.id, userId, trade.postedByUserId);

    const completed = await tx.shiftTrade.update({
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

    // Notify poster: trade completed
    await notify(
      trade.postedByUserId,
      "trade_completed",
      "Your trade is done",
      `${completed.claimedBy?.name ?? "Someone"} took your ${shift.area} shift for ${eventSummary}.`,
      `trade_completed_${tradeId}`,
      { tradeId },
    );

    return completed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Staff approves a claimed trade → executes swap.
 */
export async function approveTrade(tradeId: string) {
  return db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({
      where: { id: tradeId },
      include: {
        shiftAssignment: {
          include: {
            shift: {
              include: { shiftGroup: { include: { event: { select: { summary: true } } } } },
            },
          },
        },
      },
    });
    if (!trade) throw new HttpError(404, "Trade not found");
    if (trade.status !== "CLAIMED") {
      throw new HttpError(400, "Only claimed trades can be approved");
    }
    if (!trade.claimedByUserId) {
      throw new HttpError(400, "Trade has no claimer");
    }

    await executeSwap(tx, trade.shiftAssignment.id, trade.claimedByUserId, trade.postedByUserId);

    const updated = await tx.shiftTrade.update({
      where: { id: tradeId },
      data: { resolvedAt: new Date(), status: "COMPLETED" },
    });

    const area = trade.shiftAssignment.shift.area;
    const eventSummary = trade.shiftAssignment.shift.shiftGroup?.event?.summary ?? "your shift";

    // Notify claimer: swap is confirmed
    await notify(
      trade.claimedByUserId,
      "trade_approved",
      "Trade approved",
      `Your trade for ${area} at ${eventSummary} was approved. You're on the schedule.`,
      `trade_approved_${tradeId}`,
      { tradeId },
    );

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Staff declines a claimed trade → back to OPEN.
 */
export async function declineTrade(tradeId: string) {
  return db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({
      where: { id: tradeId },
      include: {
        shiftAssignment: {
          include: {
            shift: {
              include: { shiftGroup: { include: { event: { select: { summary: true } } } } },
            },
          },
        },
      },
    });
    if (!trade) throw new HttpError(404, "Trade not found");
    if (trade.status !== "CLAIMED") {
      throw new HttpError(400, "Only claimed trades can be declined");
    }

    const updated = await tx.shiftTrade.update({
      where: { id: tradeId },
      data: {
        claimedByUserId: null,
        claimedAt: null,
        status: "OPEN",
      },
    });

    // Notify claimer: declined, trade is back open
    if (trade.claimedByUserId) {
      const area = trade.shiftAssignment.shift.area;
      const eventSummary = trade.shiftAssignment.shift.shiftGroup?.event?.summary ?? "the event";
      await notify(
        trade.claimedByUserId,
        "trade_declined",
        "Trade claim declined",
        `Your claim for ${area} at ${eventSummary} was declined. The shift is back on the trade board.`,
        `trade_declined_${tradeId}_${Date.now()}`,
        { tradeId },
      );
    }

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * List trades, optionally filtered by status and area.
 */
export async function listTrades(filters: {
  status?: ShiftTradeStatus;
  area?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.area) {
    where.shiftAssignment = {
      shift: { area: filters.area },
    };
  }

  const [total, data] = await Promise.all([
    db.shiftTrade.count({ where }),
    db.shiftTrade.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
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
    }),
  ]);

  return { data, total };
}

/**
 * Expire all OPEN/CLAIMED trades whose shift has already started.
 * Called by the morning-refresh cron. Notifies the original poster.
 */
export async function expireOpenTrades(): Promise<{ expired: number }> {
  const now = new Date();

  const staleTrades = await db.shiftTrade.findMany({
    where: {
      status: { in: ["OPEN", "CLAIMED"] },
      shiftAssignment: {
        shift: { startsAt: { lt: now } },
      },
    },
    select: {
      id: true,
      postedByUserId: true,
      shiftAssignment: {
        select: {
          shift: {
            select: {
              area: true,
              shiftGroup: {
                select: { event: { select: { summary: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (staleTrades.length === 0) return { expired: 0 };

  await db.shiftTrade.updateMany({
    where: {
      id: { in: staleTrades.map((t) => t.id) },
      status: { in: ["OPEN", "CLAIMED"] },
    },
    data: { status: "CANCELLED", resolvedAt: now },
  });

  // Notify posters (best-effort, skip duplicates)
  if (staleTrades.length > 0) {
    await db.notification.createMany({
      data: staleTrades.map((t) => ({
        userId: t.postedByUserId,
        type: "trade_expired",
        title: "Trade expired",
        body: `Your trade for ${t.shiftAssignment.shift.area} at ${
          t.shiftAssignment.shift.shiftGroup?.event?.summary ?? "the event"
        } expired — the shift has passed.`,
        payload: JSON.parse(JSON.stringify({ tradeId: t.id })),
        channel: "IN_APP" as const,
        sentAt: now,
        dedupeKey: `trade_expired_${t.id}`,
      })),
      skipDuplicates: true,
    });
  }

  return { expired: staleTrades.length };
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

  // Check class schedule conflict for the incoming worker
  let hasConflict = false;
  let conflictNote: string | null = null;
  try {
    const claimer = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { availabilityBlocks: { select: { dayOfWeek: true, startsAt: true, endsAt: true, label: true } } },
    });
    if (claimer?.availabilityBlocks.length) {
      const { day, hhmm: shiftStart } = toLocalComponents(assignment.shift.startsAt);
      const { hhmm: shiftEnd } = toLocalComponents(assignment.shift.endsAt);
      for (const block of claimer.availabilityBlocks) {
        if (block.dayOfWeek === day && timeOverlaps(shiftStart, shiftEnd, block.startsAt, block.endsAt)) {
          hasConflict = true;
          conflictNote = block.label
            ? `Conflicts with ${block.label} (${block.startsAt}–${block.endsAt})`
            : `Conflicts with class ${block.startsAt}–${block.endsAt}`;
          break;
        }
      }
    }
  } catch {
    // Non-fatal — proceed without conflict flag if lookup fails
  }

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
      hasConflict,
      conflictNote,
    },
  });
}
