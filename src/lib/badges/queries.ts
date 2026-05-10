import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { normalizePrefs } from "@/lib/services/notification-prefs";

type ManualAwardArgs = {
  userId: string;
  definitionId: string;
  awardedById: string;
  note?: string;
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

export async function getBadgePeerVisibility() {
  const config = await db.systemConfig.findUnique({
    where: { key: "badges.peerVisible" },
    select: { value: true },
  });
  return config?.value !== false;
}

export async function getUserBadgeProfile(viewer: AuthUser, userId: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!target || target.role !== "STUDENT") {
    throw new HttpError(404, "Student not found");
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

  const badges = definitions.map((definition) => {
    const award = definition.awards[0] ?? null;
    return {
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      kind: definition.kind,
      threshold: definition.threshold,
      ruleKey: definition.ruleKey,
      active: definition.active,
      sortOrder: definition.sortOrder,
      earned: Boolean(award),
      awardedAt: award?.awardedAt.toISOString() ?? null,
      source: award?.source ?? null,
      note: award?.note ?? null,
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
    const [target, definition, existing] = await Promise.all([
      tx.user.findUnique({
        where: { id: args.userId },
        select: {
          id: true,
          name: true,
          role: true,
          notificationPrefs: true,
        },
      }),
      tx.badgeDefinition.findUnique({
        where: { id: args.definitionId },
        select: {
          id: true,
          name: true,
          active: true,
        },
      }),
      tx.studentBadge.findUnique({
        where: {
          userId_definitionId: {
            userId: args.userId,
            definitionId: args.definitionId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!target || target.role !== "STUDENT") {
      throw new HttpError(404, "Student not found");
    }
    if (!definition || !definition.active) {
      throw new HttpError(404, "Active badge definition not found");
    }
    if (existing) {
      throw new HttpError(409, "Badge already awarded");
    }

    const award = await tx.studentBadge.create({
      data: {
        userId: args.userId,
        definitionId: args.definitionId,
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
            badgeDefinitionId: args.definitionId,
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
