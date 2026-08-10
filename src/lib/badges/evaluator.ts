import {
  BadgeCategory,
  BadgeStreakType,
  BookingKind,
  BookingStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { isSerializationConflict } from "@/lib/serialization";
import {
  checkoutAutomaticRuleCounts,
  shiftAutomaticRuleCounts,
} from "./automatic-rules";
import {
  ON_TIME_GRACE_MS,
  type AppOpenedBadgeEvent,
  type CheckoutOpenedBadgeEvent,
  type CheckoutReturnedBadgeEvent,
  type ShiftsWorkedBadgeEvent,
  type TradeCompletedBadgeEvent,
} from "./types";

type TxClient = Prisma.TransactionClient;
const MAX_TRANSACTION_ATTEMPTS = 2;

async function runBadgeTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      // Matches the raw 40001 driver code as well as Prisma's P2034; the
      // Neon adapter can surface either for the same serialization abort.
      const canRetry = isSerializationConflict(error) && attempt < MAX_TRANSACTION_ATTEMPTS;

      if (!canRetry) throw error;
    }
  }

  throw new Error("Badge transaction retry exhausted");
}

async function awardThresholdBadges(tx: TxClient, args: {
  userId: string;
  category: BadgeCategory;
  trigger: string;
  count: number;
  ruleKey?: string;
}) {
  const definitions = await tx.badgeDefinition.findMany({
    where: {
      active: true,
      category: args.category,
      trigger: args.trigger,
      threshold: { not: null, lte: args.count },
      ...(args.ruleKey ? { ruleKey: args.ruleKey } : {}),
    },
    select: { id: true },
  });

  if (definitions.length === 0) return;

  await tx.studentBadge.createMany({
    data: definitions.map((definition) => ({
      userId: args.userId,
      definitionId: definition.id,
    })),
    skipDuplicates: true,
  });
}

async function awardRuleBadges(tx: TxClient, args: {
  userId: string;
  trigger: string;
  ruleKey: string;
}) {
  const definitions = await tx.badgeDefinition.findMany({
    where: {
      active: true,
      trigger: args.trigger,
      ruleKey: args.ruleKey,
    },
    select: { id: true },
  });

  if (definitions.length === 0) return;

  await tx.studentBadge.createMany({
    data: definitions.map((definition) => ({
      userId: args.userId,
      definitionId: definition.id,
    })),
    skipDuplicates: true,
  });
}

async function awardMeasuredRuleBadges(tx: TxClient, args: {
  userId: string;
  trigger: string;
  counts: Map<string, number>;
}) {
  const ruleKeys = [...args.counts.keys()];
  if (ruleKeys.length === 0) return;

  const definitions = await tx.badgeDefinition.findMany({
    where: {
      active: true,
      category: BadgeCategory.MILESTONE,
      trigger: args.trigger,
      threshold: { not: null },
      ruleKey: { in: ruleKeys },
    },
    select: { id: true, ruleKey: true, threshold: true },
  });
  const earnedDefinitions = definitions.filter((definition) => (
    definition.ruleKey !== null
    && definition.threshold !== null
    && (args.counts.get(definition.ruleKey) ?? 0) >= definition.threshold
  ));

  if (earnedDefinitions.length === 0) return;
  await tx.studentBadge.createMany({
    data: earnedDefinitions.map((definition) => ({
      userId: args.userId,
      definitionId: definition.id,
    })),
    skipDuplicates: true,
  });
}

async function claimEventReceipt(tx: TxClient, args: {
  userId: string;
  eventType: string;
  sourceKey: string;
}) {
  const receipt = await tx.badgeEventReceipt.createMany({
    data: [args],
    skipDuplicates: true,
  });

  return receipt.count === 1;
}

async function incrementStreak(tx: TxClient, args: {
  userId: string;
  streakType: BadgeStreakType;
  sourceKey: string;
  eventAt: Date;
}) {
  const current = await tx.badgeStreak.findUnique({
    where: {
      userId_streakType: {
        userId: args.userId,
        streakType: args.streakType,
      },
    },
  });

  if (current?.lastSourceKey === args.sourceKey) return null;

  const nextCurrent = (current?.current ?? 0) + 1;
  const nextLongest = Math.max(current?.longest ?? 0, nextCurrent);

  await tx.badgeStreak.upsert({
    where: {
      userId_streakType: {
        userId: args.userId,
        streakType: args.streakType,
      },
    },
    create: {
      userId: args.userId,
      streakType: args.streakType,
      current: nextCurrent,
      longest: nextLongest,
      lastEventAt: args.eventAt,
      lastSourceKey: args.sourceKey,
    },
    update: {
      current: nextCurrent,
      longest: nextLongest,
      lastEventAt: args.eventAt,
      lastSourceKey: args.sourceKey,
    },
  });

  return nextCurrent;
}

async function resetStreak(tx: TxClient, args: {
  userId: string;
  streakType: BadgeStreakType;
  sourceKey: string;
  eventAt: Date;
}) {
  const current = await tx.badgeStreak.findUnique({
    where: {
      userId_streakType: {
        userId: args.userId,
        streakType: args.streakType,
      },
    },
  });

  if (current?.lastSourceKey === args.sourceKey) return;

  await tx.badgeStreak.upsert({
    where: {
      userId_streakType: {
        userId: args.userId,
        streakType: args.streakType,
      },
    },
    create: {
      userId: args.userId,
      streakType: args.streakType,
      current: 0,
      longest: 0,
      lastEventAt: args.eventAt,
      lastSourceKey: args.sourceKey,
    },
    update: {
      current: 0,
      lastEventAt: args.eventAt,
      lastSourceKey: args.sourceKey,
    },
  });
}

export async function onCheckoutOpened(event: CheckoutOpenedBadgeEvent): Promise<void> {
  await runBadgeTransaction(async (tx) => {
    const isNewEvent = await claimEventReceipt(tx, {
      userId: event.userId,
      eventType: "checkout_opened",
      // The booking is the immutable earning event. Caller-provided keys used
      // to vary between direct checkout and reservation pickup, which made
      // ownership-safe history impossible to join back to the checkout.
      sourceKey: event.bookingId,
    });
    if (!isNewEvent) return;

    const openedReceipts = await tx.badgeEventReceipt.findMany({
      where: {
        userId: event.userId,
        eventType: "checkout_opened",
      },
      select: { sourceKey: true },
    });
    const openedBookingIds = openedReceipts.map((receipt) => receipt.sourceKey);

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.CHECKOUT,
      trigger: "checkout:opened",
      count: openedBookingIds.length,
    });

    // The receipt freezes credit to the person who actually opened the
    // checkout. Derive every gear challenge from those same immutable rows so
    // a later ownership transfer neither steals nor duplicates an award.
    const creditedCheckouts = await tx.booking.findMany({
      where: {
        id: { in: openedBookingIds },
        kind: BookingKind.CHECKOUT,
        status: { in: [BookingStatus.OPEN, BookingStatus.COMPLETED] },
      },
      select: {
        serializedItems: {
          select: {
            asset: {
              select: {
                category: { select: { id: true, name: true, parent: { select: { name: true } } } },
              },
            },
          },
        },
        bulkItems: {
          select: {
            checkedOutQuantity: true,
            bulkSku: {
              select: {
                categoryRel: { select: { id: true, name: true, parent: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    await awardMeasuredRuleBadges(tx, {
      userId: event.userId,
      trigger: "checkout:opened",
      counts: checkoutAutomaticRuleCounts(creditedCheckouts),
    });
  });
}

export async function onCheckoutReturned(event: CheckoutReturnedBadgeEvent): Promise<void> {
  await runBadgeTransaction(async (tx) => {
    const isNewEvent = await claimEventReceipt(tx, {
      userId: event.userId,
      eventType: "checkout_returned",
      sourceKey: event.bookingId,
    });
    if (!isNewEvent) return;

    // A clean return remains clean even when it is late. Award this independent
    // lane before the on-time streak early return below.
    const damageFreeCount = await tx.booking.count({
      where: {
        requesterUserId: event.userId,
        kind: BookingKind.CHECKOUT,
        status: BookingStatus.COMPLETED,
        checkinReports: { none: {} },
      },
    });

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.ON_TIME,
      trigger: "checkout:returned",
      count: damageFreeCount,
      ruleKey: "damage_free_return",
    });

    if (!event.wasOnTime) {
      await resetStreak(tx, {
        userId: event.userId,
        streakType: BadgeStreakType.ON_TIME_RETURN,
        sourceKey: event.bookingId,
        eventAt: event.completedAt,
      });
      return;
    }

    const completedCheckouts = await tx.booking.findMany({
      where: {
        requesterUserId: event.userId,
        kind: BookingKind.CHECKOUT,
        status: BookingStatus.COMPLETED,
      },
      select: { endsAt: true, updatedAt: true, completedAt: true },
    });
    const onTimeCount = completedCheckouts.filter(
      (booking) => (booking.completedAt ?? booking.updatedAt).getTime() <= booking.endsAt.getTime() + ON_TIME_GRACE_MS,
    ).length;

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.ON_TIME,
      trigger: "checkout:returned",
      count: onTimeCount,
      ruleKey: "on_time_return",
    });

    const streakCount = await incrementStreak(tx, {
      userId: event.userId,
      streakType: BadgeStreakType.ON_TIME_RETURN,
      sourceKey: event.bookingId,
      eventAt: event.completedAt,
    });

    if (streakCount !== null) {
      await awardThresholdBadges(tx, {
        userId: event.userId,
        category: BadgeCategory.STREAK,
        trigger: "checkout:returned",
        count: streakCount,
        ruleKey: "on_time_return_streak",
      });
    }
  });
}

function appDateAndHour(occurredAt: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.appTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(occurredAt);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

/**
 * Server-authoritative app-open easter eggs. The client only reports that the
 * signed-in app became active; the server's institution timezone decides
 * whether a rule matches, so changing a device clock cannot mint an award.
 */
export async function onAppOpened(event: AppOpenedBadgeEvent): Promise<void> {
  const local = appDateAndHour(event.occurredAt);
  if (local.hour !== 2) return;

  await runBadgeTransaction(async (tx) => {
    const isNewEvent = await claimEventReceipt(tx, {
      userId: event.userId,
      eventType: "app_opened",
      sourceKey: `local-hour-2:${local.date}`,
    });
    if (!isNewEvent) return;

    await awardRuleBadges(tx, {
      userId: event.userId,
      trigger: "app:opened",
      ruleKey: "local_hour_2",
    });
  });
}

/**
 * Recognition for shift work, counted from assignments to events that have
 * already happened.
 *
 * These badges were retired in 2026-05 because attendance is not tracked, and
 * that reasoning conflated two things: nobody records whether a person showed
 * up, but the schedule does durably record who was committed to be there. That
 * commitment is what the crew is recognised for, and until now the entire
 * Schedule half of the product earned nothing at all.
 *
 * Counting from the database rather than incrementing a streak is what makes
 * this safe to re-run nightly: `awardThresholdBadges` writes with
 * `skipDuplicates`, so a second pass over the same shifts changes nothing.
 *
 * Archived events still count. `morning-refresh` stamps `archivedAt` on events
 * older than four months purely as list hygiene -- "nothing is deleted" -- so
 * excluding them would make a person's worked-shift total fall over time and
 * strand them below a threshold they had already passed.
 */
export async function onShiftsWorked(event: ShiftsWorkedBadgeEvent): Promise<void> {
  await runBadgeTransaction(async (tx) => {
    const workedAssignments = await tx.shiftAssignment.findMany({
      where: {
        userId: event.userId,
        status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
        shift: {
          shiftGroup: {
            event: {
              endsAt: { lt: new Date() },
              status: "CONFIRMED",
            },
          },
        },
      },
      select: {
        callStartsAt: true,
        shift: {
          select: {
            startsAt: true,
            callStartsAt: true,
            shiftGroup: {
              select: { event: { select: { isHome: true } } },
            },
          },
        },
      },
    });

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.SHIFT,
      trigger: "shift:completed",
      count: workedAssignments.length,
    });
    await awardMeasuredRuleBadges(tx, {
      userId: event.userId,
      trigger: "shift:completed",
      counts: shiftAutomaticRuleCounts(workedAssignments, env.appTimezone),
    });
  });
}

export async function onTradeCompleted(event: TradeCompletedBadgeEvent): Promise<void> {
  await runBadgeTransaction(async (tx) => {
    const isNewEvent = await claimEventReceipt(tx, {
      userId: event.userId,
      eventType: "trade_completed",
      sourceKey: event.tradeId,
    });
    if (!isNewEvent) return;

    const tradeCount = await tx.shiftTrade.count({
      where: {
        status: "COMPLETED",
        OR: [
          { postedByUserId: event.userId },
          { claimedByUserId: event.userId },
        ],
      },
    });

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.TRADE,
      trigger: "trade:completed",
      count: tradeCount,
    });
  });
}
