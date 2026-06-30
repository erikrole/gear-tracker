import { Prisma, ShiftTradeStatus, type ShiftArea } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { checkTimeConflict } from "@/lib/services/shift-assignments";
import { sendShiftTradeEmail, type ShiftTradeEmail } from "@/lib/services/shift-trade-emails";
import { sendPushToUser } from "@/lib/services/notifications";
import { scheduleNotificationPayload } from "@/lib/services/schedule-notification-policy";
import { badges } from "@/lib/badges";
import { evaluateAvailabilityPreferences } from "@/lib/student-availability";
import { availabilityContextFromBlocks } from "@/lib/schedule-availability-context";
import { shiftWorkerTypeForProfile } from "@/lib/shift-display";

function assertShiftNotStarted(startsAt: Date) {
  if (startsAt <= new Date()) {
    throw new HttpError(400, "This shift has already started");
  }
}

function effectiveAssignmentWindow(assignment: {
  callStartsAt?: Date | null;
  callEndsAt?: Date | null;
  shift: {
    startsAt: Date;
    endsAt: Date;
    callStartsAt?: Date | null;
    callEndsAt?: Date | null;
  };
}) {
  return {
    startsAt: assignment.callStartsAt ?? assignment.shift.callStartsAt ?? assignment.shift.startsAt,
    endsAt: assignment.callEndsAt ?? assignment.shift.callEndsAt ?? assignment.shift.endsAt,
  };
}

function futureEffectiveAssignmentWhere(now: Date): Prisma.ShiftAssignmentWhereInput {
  return {
    OR: [
      { callStartsAt: { gt: now } },
      { callStartsAt: null, shift: { callStartsAt: { gt: now } } },
      { callStartsAt: null, shift: { callStartsAt: null, startsAt: { gt: now } } },
    ],
  };
}

function staleEffectiveAssignmentWhere(now: Date): Prisma.ShiftAssignmentWhereInput {
  return {
    OR: [
      { callStartsAt: { lt: now } },
      { callStartsAt: null, shift: { callStartsAt: { lt: now } } },
      { callStartsAt: null, shift: { callStartsAt: null, startsAt: { lt: now } } },
    ],
  };
}

const availabilityBlockSelect = {
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
} satisfies Prisma.StudentAvailabilityBlockSelect;

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
    assertShiftNotStarted(effectiveAssignmentWindow(assignment).startsAt);

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
  const emailJobs: ShiftTradeEmail[] = [];
  const pushJobs: Array<{ userId: string; title: string; body: string; payload: Record<string, unknown> }> = [];
  const badgeJobs: Array<Parameters<typeof badges.onTradeCompleted>[0]> = [];

  const result = await db.$transaction(async (tx) => {
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
    const window = effectiveAssignmentWindow(trade.shiftAssignment);
    assertShiftNotStarted(window.startsAt);
    await checkTimeConflict(tx, userId, window.startsAt, window.endsAt);

    // Validate claimant's primary area matches the shift area
    const claimant = await tx.user.findUnique({
      where: { id: userId },
      select: {
        primaryArea: true,
        role: true,
        staffingType: true,
        availabilityBlocks: { select: availabilityBlockSelect },
      },
    });
    if (!claimant || shiftWorkerTypeForProfile(claimant) !== shift.workerType) {
      throw new HttpError(400, "Your scheduling class does not match this shift slot");
    }
    if (claimant?.primaryArea && claimant.primaryArea !== shift.area) {
      throw new HttpError(400, `Your primary area (${claimant.primaryArea}) does not match this shift's area (${shift.area})`);
    }
    const availabilityContext = availabilityContextFromBlocks(claimant.availabilityBlocks ?? [], window);
    if (availabilityContext?.blocking) {
      throw new HttpError(409, availabilityContext.detail);
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

      const title = "Your trade was claimed";
      const body = `${updated.claimedBy?.name ?? "Someone"} claimed your ${shift.area} shift for ${eventSummary}. Awaiting staff approval.`;

      // Notify poster: someone claimed, pending staff approval
      await notify(
        trade.postedByUserId,
        "trade_claimed",
        title,
        body,
        `trade_claimed_${tradeId}`,
        scheduleNotificationPayload({
          tradeId,
          assignmentId: updated.shiftAssignment.id,
          shiftId: updated.shiftAssignment.shift.id,
          eventId: updated.shiftAssignment.shift.shiftGroup.event.id,
        }),
      );
      pushJobs.push({
        userId: trade.postedByUserId,
        title,
        body,
        payload: scheduleNotificationPayload({
          tradeId,
          assignmentId: updated.shiftAssignment.id,
          shiftId: updated.shiftAssignment.shift.id,
          eventId: updated.shiftAssignment.shift.shiftGroup.event.id,
        }),
      });
      emailJobs.push({
        userId: trade.postedByUserId,
        title,
        body,
        eventSummary,
        area: shift.area,
      });

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
    queueTradeCompletedIfTransitioned(badgeJobs, completed, trade.status);

    const title = "Your trade is done";
    const body = `${completed.claimedBy?.name ?? "Someone"} took your ${shift.area} shift for ${eventSummary}.`;

    // Notify poster: trade completed
    await notify(
      trade.postedByUserId,
      "trade_completed",
      title,
      body,
      `trade_completed_${tradeId}`,
      scheduleNotificationPayload({
        tradeId,
        assignmentId: completed.shiftAssignment.id,
        shiftId: completed.shiftAssignment.shift.id,
        eventId: completed.shiftAssignment.shift.shiftGroup.event.id,
      }),
    );
    pushJobs.push({
      userId: trade.postedByUserId,
      title,
      body,
      payload: scheduleNotificationPayload({
        tradeId,
        assignmentId: completed.shiftAssignment.id,
        shiftId: completed.shiftAssignment.shift.id,
        eventId: completed.shiftAssignment.shift.shiftGroup.event.id,
      }),
    });
    emailJobs.push({
      userId: trade.postedByUserId,
      title,
      body,
      eventSummary,
      area: shift.area,
    });

    return completed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await Promise.all(badgeJobs.map((event) => badges.onTradeCompleted(event)));
  await Promise.allSettled(pushJobs.map((job) =>
    sendPushToUser(job.userId, {
      title: job.title,
      body: job.body,
      payload: job.payload,
      category: "trade",
    }),
  ));
  await sendShiftTradeEmails(emailJobs);
  return result;
}

/**
 * Staff approves a claimed trade → executes swap.
 */
export async function approveTrade(tradeId: string) {
  const emailJobs: ShiftTradeEmail[] = [];
  const pushJobs: Array<{ userId: string; title: string; body: string; payload: Record<string, unknown> }> = [];
  const badgeJobs: Array<Parameters<typeof badges.onTradeCompleted>[0]> = [];

  const result = await db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({
      where: { id: tradeId },
      include: {
        shiftAssignment: {
          include: {
            shift: {
              include: { shiftGroup: { include: { event: { select: { id: true, summary: true } } } } },
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
    assertShiftNotStarted(effectiveAssignmentWindow(trade.shiftAssignment).startsAt);

    await executeSwap(tx, trade.shiftAssignment.id, trade.claimedByUserId, trade.postedByUserId);

    const updated = await tx.shiftTrade.update({
      where: { id: tradeId },
      data: { resolvedAt: new Date(), status: "COMPLETED" },
    });
    queueTradeCompletedIfTransitioned(badgeJobs, updated, trade.status);

    const area = trade.shiftAssignment.shift.area;
    const eventSummary = trade.shiftAssignment.shift.shiftGroup?.event?.summary ?? "your shift";

    const title = "Trade approved";
    const body = `Your trade for ${area} at ${eventSummary} was approved. You're on the schedule.`;

    // Notify claimer: swap is confirmed
    await notify(
      trade.claimedByUserId,
      "trade_approved",
      title,
      body,
      `trade_approved_${tradeId}`,
      scheduleNotificationPayload({
        tradeId,
        assignmentId: trade.shiftAssignment.id,
        shiftId: trade.shiftAssignment.shift.id,
        eventId: trade.shiftAssignment.shift.shiftGroup.event.id,
      }),
    );
    pushJobs.push({
      userId: trade.claimedByUserId,
      title,
      body,
      payload: scheduleNotificationPayload({
        tradeId,
        assignmentId: trade.shiftAssignment.id,
        shiftId: trade.shiftAssignment.shift.id,
        eventId: trade.shiftAssignment.shift.shiftGroup.event.id,
      }),
    });
    emailJobs.push({
      userId: trade.claimedByUserId,
      title,
      body,
      eventSummary,
      area,
    });

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await Promise.all(badgeJobs.map((event) => badges.onTradeCompleted(event)));
  await Promise.allSettled(pushJobs.map((job) =>
    sendPushToUser(job.userId, {
      title: job.title,
      body: job.body,
      payload: job.payload,
      category: "trade",
    }),
  ));
  await sendShiftTradeEmails(emailJobs);
  return result;
}

/**
 * Staff declines a claimed trade → back to OPEN.
 */
export async function declineTrade(tradeId: string) {
  const emailJobs: ShiftTradeEmail[] = [];
  const pushJobs: Array<{ userId: string; title: string; body: string; payload: Record<string, unknown> }> = [];

  const result = await db.$transaction(async (tx) => {
    const trade = await tx.shiftTrade.findUnique({
      where: { id: tradeId },
      include: {
        shiftAssignment: {
          include: {
            shift: {
              include: { shiftGroup: { include: { event: { select: { id: true, summary: true } } } } },
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
      const title = "Trade claim declined";
      const body = `Your claim for ${area} at ${eventSummary} was declined. The shift is back on the trade board.`;

      await notify(
        trade.claimedByUserId,
        "trade_declined",
        title,
        body,
        `trade_declined_${tradeId}_${Date.now()}`,
        scheduleNotificationPayload({
          tradeId,
          assignmentId: trade.shiftAssignment.id,
          shiftId: trade.shiftAssignment.shift.id,
          eventId: trade.shiftAssignment.shift.shiftGroup.event.id,
        }),
      );
      pushJobs.push({
        userId: trade.claimedByUserId,
        title,
        body,
        payload: scheduleNotificationPayload({
          tradeId,
          assignmentId: trade.shiftAssignment.id,
          shiftId: trade.shiftAssignment.shift.id,
          eventId: trade.shiftAssignment.shift.shiftGroup.event.id,
        }),
      });
      emailJobs.push({
        userId: trade.claimedByUserId,
        title,
        body,
        eventSummary,
        area,
      });
    }

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await Promise.allSettled(pushJobs.map((job) =>
    sendPushToUser(job.userId, {
      title: job.title,
      body: job.body,
      payload: job.payload,
      category: "trade",
    }),
  ));
  await sendShiftTradeEmails(emailJobs);
  return result;
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
      // Same relation shape as postTrade/claimTrade — clients decode all
      // trade mutations into one model, so a bare row breaks them.
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
  const where: Prisma.ShiftTradeWhereInput = {};
  const and: Prisma.ShiftTradeWhereInput[] = [];
  if (filters.status) where.status = filters.status;
  if (filters.area) {
    and.push({ shiftAssignment: { shift: { area: filters.area as ShiftArea } } });
  }
  const actionableStatuses: ShiftTradeStatus[] = ["OPEN", "CLAIMED"];
  const now = new Date();
  if (filters.status && actionableStatuses.includes(filters.status)) {
    and.push({ shiftAssignment: futureEffectiveAssignmentWhere(now) });
  } else if (!filters.status) {
    and.push({
      OR: [
        { status: { notIn: actionableStatuses } },
        { shiftAssignment: futureEffectiveAssignmentWhere(now) },
      ],
    });
  }
  if (and.length > 0) where.AND = and;

  const data = await db.shiftTrade.findMany({
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
                      opponent: true,
                      isHome: true,
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
  const total = await db.shiftTrade.count({ where });
  const availabilityUserIds = new Set<string>();
  if (filters.userId) availabilityUserIds.add(filters.userId);
  for (const trade of data) {
    if (trade.status === "CLAIMED" && trade.claimedByUserId) {
      availabilityUserIds.add(trade.claimedByUserId);
    }
  }
  const availabilityUsers = availabilityUserIds.size > 0
    ? await db.user.findMany({
      where: { id: { in: [...availabilityUserIds] } },
      select: { id: true, availabilityBlocks: { select: availabilityBlockSelect } },
    })
    : [];
  const availabilityByUserId = new Map(availabilityUsers.map((user) => [user.id, user.availabilityBlocks]));
  const viewerBlocks = filters.userId ? availabilityByUserId.get(filters.userId) ?? [] : [];

  return {
    data: data.map((trade) => {
      const window = effectiveAssignmentWindow(trade.shiftAssignment);
      const viewerAvailabilityContext = filters.userId && trade.postedByUserId !== filters.userId
        ? availabilityContextFromBlocks(viewerBlocks, window)
        : null;
      const claimedByAvailabilityContext = trade.claimedByUserId
        ? availabilityContextFromBlocks(availabilityByUserId.get(trade.claimedByUserId) ?? [], window)
        : null;

      return {
        ...trade,
        viewerAvailabilityContext,
        claimedByAvailabilityContext,
      };
    }),
    total,
  };
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
      shiftAssignment: staleEffectiveAssignmentWhere(now),
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
                select: { event: { select: { id: true, summary: true } } },
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
        payload: JSON.parse(JSON.stringify(scheduleNotificationPayload({
          tradeId: t.id,
          eventId: t.shiftAssignment.shift.shiftGroup.event.id,
        }))),
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
  const effectiveWindow = effectiveAssignmentWindow(assignment);

  // Validate target user has no conflicting shifts (exclude the assignment being swapped)
  await checkTimeConflict(tx, targetUserId, effectiveWindow.startsAt, effectiveWindow.endsAt, assignmentId);

  // Check class schedule conflict for the incoming worker
  let conflictNote: string | null = null;
  try {
    const claimer = await tx.user.findUnique({
      where: { id: targetUserId },
      select: {
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
    if (claimer) {
      const availability = evaluateAvailabilityPreferences(claimer.availabilityBlocks, effectiveWindow);
      if (availability.blocking) throw new HttpError(409, availability.blocking.note);
      conflictNote = availability.advisory?.note ?? null;
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
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
      hasConflict: Boolean(conflictNote),
      conflictNote,
    },
  });
}

function queueTradeCompletedIfTransitioned(
  badgeJobs: Array<Parameters<typeof badges.onTradeCompleted>[0]>,
  trade: { id: string; status: ShiftTradeStatus; postedByUserId: string; claimedByUserId: string | null },
  prevStatus: ShiftTradeStatus,
) {
  if (prevStatus === "COMPLETED" || trade.status !== "COMPLETED") return;

  badgeJobs.push({
    userId: trade.postedByUserId,
    tradeId: trade.id,
    sourceKey: trade.id,
  });
  if (trade.claimedByUserId && trade.claimedByUserId !== trade.postedByUserId) {
    badgeJobs.push({
      userId: trade.claimedByUserId,
      tradeId: trade.id,
      sourceKey: trade.id,
    });
  }
}

async function sendShiftTradeEmails(jobs: ShiftTradeEmail[]) {
  if (jobs.length === 0) return;

  await Promise.allSettled(
    jobs.map((job) =>
      sendShiftTradeEmail(job).catch((err) => {
        console.error(`[SHIFT_TRADES] Failed to send trade email to user ${job.userId}:`, err);
        return false;
      })
    )
  );
}
