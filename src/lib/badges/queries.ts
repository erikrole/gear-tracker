import { BadgeCategory, BadgeKind, BadgeStreakType, BookingKind, BookingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { normalizePrefs } from "@/lib/services/notification-prefs";

type CustomBadgeDefinitionInput = {
  name: string;
  description: string;
  icon?: string;
};

type ManualAwardArgs = {
  userId: string;
  definitionId?: string;
  customDefinition?: CustomBadgeDefinitionInput;
  awardedById: string;
  note?: string;
};

type BadgeDefinitionForProgress = {
  key: string;
  category: string;
  kind: string;
  trigger: string;
  threshold: number | null;
  ruleKey: string | null;
};

type BadgeProgress = {
  current: number;
  target: number;
};

export async function listActiveBadgeDefinitions() {
  return db.badgeDefinition.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function countEarnedBadges(userId: string) {
  return db.studentBadge.count({
    where: { userId },
  });
}

function slugifyBadgeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

async function resolveManualAwardDefinition(
  tx: Prisma.TransactionClient,
  args: Pick<ManualAwardArgs, "definitionId" | "customDefinition">,
) {
  if (args.definitionId) {
    return tx.badgeDefinition.findUnique({
      where: { id: args.definitionId },
      select: {
        id: true,
        key: true,
        name: true,
        active: true,
      },
    });
  }

  if (!args.customDefinition) return null;

  const name = args.customDefinition.name.trim();
  const description = args.customDefinition.description.trim();
  const slug = slugifyBadgeName(name);
  if (!slug) {
    throw new HttpError(400, "Custom badge name is required");
  }

  const key = `custom_${slug}`;
  const existing = await tx.badgeDefinition.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      name: true,
      active: true,
    },
  });

  if (existing) return existing;

  return tx.badgeDefinition.create({
    data: {
      key,
      name,
      description,
      icon: args.customDefinition.icon?.trim() || "Trophy",
      category: BadgeCategory.MILESTONE,
      kind: BadgeKind.RULE,
      trigger: "manual",
      threshold: null,
      ruleKey: key,
      active: true,
      sortOrder: 790,
    },
    select: {
      id: true,
      key: true,
      name: true,
      active: true,
    },
  });
}

export async function getBadgePeerVisibility() {
  const config = await db.systemConfig.findUnique({
    where: { key: "badges.peerVisible" },
    select: { value: true },
  });
  return config?.value !== false;
}

async function getProgressByBadgeKey(userId: string, definitions: BadgeDefinitionForProgress[]) {
  const thresholdDefinitions = definitions.filter((definition) => definition.threshold !== null);
  const progressByKey = new Map<string, BadgeProgress>();
  if (thresholdDefinitions.length === 0) return progressByKey;

  const needsCheckoutOpened = thresholdDefinitions.some((definition) => definition.trigger === "checkout:opened");
  const needsOnTimeReturns = thresholdDefinitions.some((definition) => definition.ruleKey === "on_time_return");
  const needsTrades = thresholdDefinitions.some((definition) => definition.trigger === "trade:completed");
  const streakTypes = new Set<BadgeStreakType>();

  for (const definition of thresholdDefinitions) {
    if (definition.trigger === "scan:success") streakTypes.add(BadgeStreakType.SCAN_SUCCESS_COUNT);
    if (definition.ruleKey === "zero_errors") streakTypes.add(BadgeStreakType.SCAN_CLEAN);
    if (definition.ruleKey === "on_time_return_streak") streakTypes.add(BadgeStreakType.ON_TIME_RETURN);
  }

  const [
    checkoutOpenedCount,
    completedCheckouts,
    tradeCount,
    streaks,
  ] = await Promise.all([
    needsCheckoutOpened
      ? db.booking.count({
          where: {
            requesterUserId: userId,
            kind: BookingKind.CHECKOUT,
            status: { in: [BookingStatus.OPEN, BookingStatus.COMPLETED] },
          },
        })
      : Promise.resolve(0),
    needsOnTimeReturns
      ? db.booking.findMany({
          where: {
            requesterUserId: userId,
            kind: BookingKind.CHECKOUT,
            status: BookingStatus.COMPLETED,
          },
          select: { endsAt: true, updatedAt: true },
        })
      : Promise.resolve([]),
    needsTrades
      ? db.shiftTrade.count({
          where: {
            status: "COMPLETED",
            OR: [
              { postedByUserId: userId },
              { claimedByUserId: userId },
            ],
          },
        })
      : Promise.resolve(0),
    streakTypes.size > 0
      ? db.badgeStreak.findMany({
          where: {
            userId,
            streakType: { in: Array.from(streakTypes) },
          },
          select: { streakType: true, current: true, longest: true },
        })
      : Promise.resolve([]),
  ]);

  const onTimeReturnCount = completedCheckouts.filter(
    (booking) => booking.updatedAt.getTime() <= booking.endsAt.getTime() + 15 * 60 * 1000,
  ).length;
  const streakMap = new Map(streaks.map((streak) => [streak.streakType, streak]));

  for (const definition of thresholdDefinitions) {
    const target = definition.threshold;
    if (target === null) continue;

    let current: number | null = null;
    if (definition.trigger === "checkout:opened") current = checkoutOpenedCount;
    else if (definition.ruleKey === "on_time_return") current = onTimeReturnCount;
    else if (definition.trigger === "scan:success") current = streakMap.get(BadgeStreakType.SCAN_SUCCESS_COUNT)?.current ?? 0;
    else if (definition.ruleKey === "zero_errors") current = streakMap.get(BadgeStreakType.SCAN_CLEAN)?.current ?? 0;
    else if (definition.ruleKey === "on_time_return_streak") current = streakMap.get(BadgeStreakType.ON_TIME_RETURN)?.current ?? 0;
    else if (definition.trigger === "trade:completed") current = tradeCount;

    if (current !== null) {
      progressByKey.set(definition.key, {
        current: Math.min(current, target),
        target,
      });
    }
  }

  return progressByKey;
}

export async function getUserBadgeProfile(viewer: AuthUser, userId: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true },
  });

  if (!target) {
    throw new HttpError(404, "User not found");
  }

  const peerVisible = await getBadgePeerVisibility();
  const canView =
    viewer.id === userId ||
    viewer.role === "ADMIN" ||
    viewer.role === "STAFF" ||
    peerVisible;

  if (!canView) {
    throw new HttpError(403, "Badge visibility is disabled for peers");
  }

  const definitions = await db.badgeDefinition.findMany({
    where: {
      OR: [
        { active: true },
        { awards: { some: { userId } } },
      ],
    },
    include: {
      awards: {
        where: { userId },
        orderBy: { awardedAt: "desc" },
        take: 1,
        select: {
          id: true,
          awardedAt: true,
          source: true,
          note: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const progressByKey = await getProgressByBadgeKey(userId, definitions);

  const badges = definitions.map((definition) => {
    const award = definition.awards[0] ?? null;
    const progress = progressByKey.get(definition.key) ?? null;
    return {
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      kind: definition.kind,
      trigger: definition.trigger,
      threshold: definition.threshold,
      ruleKey: definition.ruleKey,
      active: definition.active,
      sortOrder: definition.sortOrder,
      earned: Boolean(award),
      awardedAt: award?.awardedAt.toISOString() ?? null,
      source: award?.source ?? null,
      note: award?.note ?? null,
      progressCurrent: progress?.current ?? null,
      progressTarget: progress?.target ?? null,
    };
  });

  return {
    userId,
    peerVisible,
    earnedCount: badges.filter((badge) => badge.earned).length,
    totalCount: badges.filter((badge) => badge.active).length,
    badges,
  };
}

export async function awardBadgeManually(args: ManualAwardArgs) {
  const note = args.note?.trim() || null;

  return db.$transaction(async (tx) => {
    const [target, definition] = await Promise.all([
      tx.user.findUnique({
        where: { id: args.userId },
        select: {
          id: true,
          name: true,
          role: true,
          active: true,
          notificationPrefs: true,
        },
      }),
      resolveManualAwardDefinition(tx, args),
    ]);

    if (!target || target.active === false) {
      throw new HttpError(404, "Active user not found");
    }
    if (!definition || !definition.active) {
      throw new HttpError(404, "Active badge definition not found");
    }

    const existing = await tx.studentBadge.findUnique({
      where: {
        userId_definitionId: {
          userId: args.userId,
          definitionId: definition.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new HttpError(409, "Badge already awarded");
    }

    const award = await tx.studentBadge.create({
      data: {
        userId: args.userId,
        definitionId: definition.id,
        source: "MANUAL",
        awardedById: args.awardedById,
        note,
      },
      include: {
        definition: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            icon: true,
            category: true,
            kind: true,
            trigger: true,
            threshold: true,
            ruleKey: true,
            active: true,
            sortOrder: true,
          },
        },
      },
    });

    const prefs = normalizePrefs(target.notificationPrefs);
    if (prefs.badges !== false) {
      await tx.notification.create({
        data: {
          userId: args.userId,
          type: "badge_awarded",
          title: "Badge awarded",
          body: `You earned ${definition.name}.`,
          payload: {
            userId: args.userId,
            badgeDefinitionId: definition.id,
            studentBadgeId: award.id,
            href: `/users/${args.userId}?tab=badges`,
          },
          channel: "IN_APP",
          sentAt: new Date(),
          dedupeKey: `badge_awarded_${award.id}`,
        },
      });
    }

    return award;
  });
}
