import {
  BadgeCategory,
  BadgeStreakType,
  BookingKind,
  BookingStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";

import {
  ON_TIME_GRACE_MS,
  type CheckoutOpenedBadgeEvent,
  type CheckoutReturnedBadgeEvent,
  type ScanResultBadgeEvent,
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
      const canRetry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < MAX_TRANSACTION_ATTEMPTS;

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
    const checkoutCount = await tx.booking.count({
      where: {
        requesterUserId: event.userId,
        kind: BookingKind.CHECKOUT,
        status: { in: [BookingStatus.OPEN, BookingStatus.COMPLETED] },
      },
    });

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.CHECKOUT,
      trigger: "checkout:opened",
      count: checkoutCount,
    });

    // Breadth, not volume. `category_collector` was a manual badge nobody ever
    // awarded, though the fact it recognises -- this person has worked with
    // most of the inventory -- is sitting in the booking rows.
    const categories = await tx.booking.findMany({
      where: {
        requesterUserId: event.userId,
        kind: BookingKind.CHECKOUT,
        status: { in: [BookingStatus.OPEN, BookingStatus.COMPLETED] },
      },
      select: { serializedItems: { select: { asset: { select: { categoryId: true } } } } },
    });
    const distinctCategories = new Set(
      categories.flatMap((booking) =>
        booking.serializedItems
          .map((item) => item.asset.categoryId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.MILESTONE,
      trigger: "checkout:opened",
      count: distinctCategories.size,
      ruleKey: "category_collector",
    });
  });
}

export async function onCheckoutReturned(event: CheckoutReturnedBadgeEvent): Promise<void> {
  await runBadgeTransaction(async (tx) => {
    if (!event.wasOnTime) {
      await resetStreak(tx, {
        userId: event.userId,
        streakType: BadgeStreakType.ON_TIME_RETURN,
        sourceKey: event.sourceKey,
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

    // Returned complete and undamaged, which is the thing `perfect_handoff`
    // and `full_kit_no_misses` asked staff to notice by hand and nobody ever
    // did. A check-in report is the durable record of something going wrong,
    // so its absence is the record of everything going right.
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

    const streakCount = await incrementStreak(tx, {
      userId: event.userId,
      streakType: BadgeStreakType.ON_TIME_RETURN,
      sourceKey: event.sourceKey,
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

export async function onScanResult(event: ScanResultBadgeEvent): Promise<void> {
  const eventAt = new Date();

  await runBadgeTransaction(async (tx) => {
    if (!event.ok) {
      await resetStreak(tx, {
        userId: event.userId,
        streakType: BadgeStreakType.SCAN_CLEAN,
        sourceKey: event.sourceKey,
        eventAt,
      });
      return;
    }

    const scanCount = await incrementStreak(tx, {
      userId: event.userId,
      streakType: BadgeStreakType.SCAN_SUCCESS_COUNT,
      sourceKey: event.sourceKey,
      eventAt,
    });

    if (scanCount !== null) {
      await awardThresholdBadges(tx, {
        userId: event.userId,
        category: BadgeCategory.SCAN,
        trigger: "scan:success",
        count: scanCount,
      });
    }

    const cleanStreak = await incrementStreak(tx, {
      userId: event.userId,
      streakType: BadgeStreakType.SCAN_CLEAN,
      sourceKey: event.sourceKey,
      eventAt,
    });

    if (cleanStreak !== null) {
      await awardThresholdBadges(tx, {
        userId: event.userId,
        category: BadgeCategory.SCAN,
        trigger: "scan:rule",
        count: cleanStreak,
        ruleKey: "zero_errors",
      });
    }
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
    const workedCount = await tx.shiftAssignment.count({
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
    });

    await awardThresholdBadges(tx, {
      userId: event.userId,
      category: BadgeCategory.SHIFT,
      trigger: "shift:completed",
      count: workedCount,
    });
  });
}

export async function onTradeCompleted(event: TradeCompletedBadgeEvent): Promise<void> {
  await runBadgeTransaction(async (tx) => {
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
