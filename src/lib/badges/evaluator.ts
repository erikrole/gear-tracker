import {
  BadgeCategory,
  BadgeStreakType,
  BookingKind,
  BookingStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";

import type {
  CheckoutOpenedBadgeEvent,
  CheckoutReturnedBadgeEvent,
  ScanResultBadgeEvent,
  ShiftCompletedBadgeEvent,
  TradeCompletedBadgeEvent,
} from "./types";

type TxClient = Prisma.TransactionClient;

const ON_TIME_GRACE_MS = 15 * 60 * 1000;
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

export async function onShiftCompleted(event: ShiftCompletedBadgeEvent): Promise<void> {
  void event;
}
