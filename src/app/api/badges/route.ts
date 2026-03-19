import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/badges?userId=<optional>
 * Returns badge catalog, earned badges, streaks, and accountability stats.
 * If userId is omitted, returns data for the authenticated user.
 */
export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // Resolve target user
    const targetUserId = userId ?? (await requireAuth()).id;

    // Fetch all badge definitions
    const allBadges = await db.badgeDefinition.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });

    // Fetch earned badges for this user
    const earnedBadges = await db.studentBadge.findMany({
      where: { userId: targetUserId },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
    });
    const earnedSlugs = new Set(earnedBadges.map((eb) => eb.badge.slug));

    // Fetch streaks
    const streaks = await db.badgeStreak.findMany({
      where: { userId: targetUserId },
    });

    // Compute accountability stats
    const completedBookings = await db.booking.findMany({
      where: { requesterUserId: targetUserId, status: "COMPLETED", kind: "CHECKOUT" },
      select: { endsAt: true, updatedAt: true },
    });

    const totalReturns = completedBookings.length;
    const onTimeReturns = completedBookings.filter((b) => b.updatedAt <= b.endsAt).length;
    const overdueCount = totalReturns - onTimeReturns;
    const returnRate = totalReturns > 0 ? Math.round((onTimeReturns / totalReturns) * 100) : 100;

    const shiftAssignments = await db.shiftAssignment.count({
      where: { userId: targetUserId, status: { in: ["APPROVED", "COMPLETED"] } },
    });
    const shiftNoShows = await db.shiftAssignment.count({
      where: { userId: targetUserId, status: "NO_SHOW" },
    });
    const totalShifts = shiftAssignments + shiftNoShows;
    const shiftAttendance = totalShifts > 0 ? Math.round((shiftAssignments / totalShifts) * 100) : 100;

    // Items lost: bulk check-out qty minus check-in qty across all bookings
    // Simplified: count movements where CHECKOUT qty > corresponding CHECKIN qty
    const itemsLost = 0; // TODO: compute from BulkStockMovement delta

    const currentStreak = streaks.find((s) => s.streakType === "on-time-returns")?.currentCount ?? 0;

    // Build response: catalog with earned status
    const catalog = allBadges
      .filter((b) => !b.isSecret || earnedSlugs.has(b.slug))
      .map((b) => ({
        slug: b.slug,
        name: b.name,
        description: b.description,
        category: b.category,
        iconUrl: b.iconUrl,
        isSecret: b.isSecret,
        earned: earnedSlugs.has(b.slug),
        earnedAt: earnedBadges.find((eb) => eb.badge.slug === b.slug)?.earnedAt ?? null,
      }));

    const nonSecretTotal = allBadges.filter((b) => !b.isSecret).length;

    return ok({
      data: {
        badges: catalog,
        earnedCount: earnedBadges.length,
        totalVisible: nonSecretTotal,
        stats: {
          returnRate,
          shiftAttendance,
          itemsLost,
          overdueCount,
          currentStreak,
        },
        milestones: {
          bronze: { threshold: 5, reached: earnedBadges.length >= 5 },
          silver: { threshold: 12, reached: earnedBadges.length >= 12 },
          gold: { threshold: 22, reached: earnedBadges.length >= 22 },
          platinum: { threshold: 35, reached: earnedBadges.length >= 35 },
        },
      },
    });
  } catch (error) {
    return fail(error);
  }
}
