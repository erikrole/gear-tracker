import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

/**
 * GET /api/badges/leaderboard
 * Staff-only: returns badge leaderboard, milestone report, and recent unlocks.
 */
export async function GET() {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "user", "read");

    // Leaderboard: students ranked by badge count
    const students = await db.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        name: true,
        email: true,
        badges: {
          select: { earnedAt: true, badge: { select: { slug: true, name: true, category: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const leaderboard = students
      .map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        badgeCount: s.badges.length,
        latestBadge: s.badges.length > 0
          ? s.badges.sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())[0]
          : null,
      }))
      .sort((a, b) => b.badgeCount - a.badgeCount);

    // Milestone report: who's at each tier
    const milestoneReport = {
      bronze: leaderboard.filter((s) => s.badgeCount >= 5).length,
      silver: leaderboard.filter((s) => s.badgeCount >= 12).length,
      gold: leaderboard.filter((s) => s.badgeCount >= 22).length,
      platinum: leaderboard.filter((s) => s.badgeCount >= 35).length,
    };

    // Recent unlocks: last 20 badge unlocks across all students
    const recentUnlocks = await db.studentBadge.findMany({
      take: 20,
      orderBy: { earnedAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        badge: { select: { slug: true, name: true, category: true } },
      },
    });

    // Accountability overview: stats per student
    const accountabilityData = await Promise.all(
      students.slice(0, 50).map(async (s) => {
        const bookings = await db.booking.findMany({
          where: { requesterUserId: s.id, status: "COMPLETED", kind: "CHECKOUT" },
          select: { endsAt: true, updatedAt: true },
        });
        const total = bookings.length;
        const onTime = bookings.filter((b) => b.updatedAt <= b.endsAt).length;

        const shifts = await db.shiftAssignment.count({
          where: { userId: s.id, status: { in: ["APPROVED", "COMPLETED"] } },
        });
        const noShows = await db.shiftAssignment.count({
          where: { userId: s.id, status: "NO_SHOW" },
        });

        return {
          id: s.id,
          name: s.name,
          returnRate: total > 0 ? Math.round((onTime / total) * 100) : 100,
          overdueCount: total - onTime,
          shiftAttendance: shifts + noShows > 0 ? Math.round((shifts / (shifts + noShows)) * 100) : 100,
          shiftsWorked: shifts,
          badgeCount: s.badges.length,
        };
      })
    );

    return ok({
      data: {
        leaderboard,
        milestoneReport,
        recentUnlocks: recentUnlocks.map((u) => ({
          studentName: u.user.name,
          studentId: u.user.id,
          badgeName: u.badge.name,
          badgeSlug: u.badge.slug,
          category: u.badge.category,
          earnedAt: u.earnedAt,
        })),
        accountability: accountabilityData,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
