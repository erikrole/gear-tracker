import { db } from "@/lib/db";

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
