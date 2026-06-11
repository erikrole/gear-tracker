import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  readDashboardCounts,
  zeroDashboardCounts,
  type DashboardCounts,
} from "@/lib/services/dashboard-counts";

const STATS_LIMIT = { max: 180, windowMs: 60_000 };

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  partialFailures: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[dashboard/stats] ${label} failed`, result.reason);
  partialFailures.push(label);
  return fallback;
}

// Lightweight stats-only endpoint — runs the single shared count aggregate and
// returns nothing else. Used by the dashboard to keep stat cards, the overdue
// count, and the transient-lane totals (awaiting pickup, stale reservations)
// fresh (60s TTL) without re-running the expensive full-payload row queries.
export const GET = withAuth(async (_req, { user }) => {
  const { allowed } = await checkRateLimit(`dashboard:stats:${user.id}`, STATS_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const [countsResult, myShiftsCountResult] = await Promise.allSettled([
    readDashboardCounts({
      userId: user.id,
      now,
      sevenDaysFromNow,
      startOfToday,
      startOfTomorrow,
    }),
    // Kept for iOS: drives the Schedule tab badge via the lightweight stats endpoint
    db.shiftAssignment.count({
      where: {
        userId: user.id,
        status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
        shift: { shiftGroup: { event: { startsAt: { gte: now }, status: "CONFIRMED" } } },
      },
    }),
  ]);
  const partialFailures: string[] = [];
  const c: DashboardCounts = settledValue(countsResult, zeroDashboardCounts, "counts", partialFailures);
  const myShiftsCount = settledValue(myShiftsCountResult, 0, "myShiftsCount", partialFailures);

  return ok({
    data: {
      role: user.role,
      stats: {
        checkedOut: c.totalCheckedOut,
        overdue: c.totalOverdue,
        reserved: c.totalReserved,
        dueToday: c.dueToday,
      },
      overdueCount: c.totalOverdue,
      myCheckoutsTotal: c.myCheckoutsTotal,
      myOverdueCount: c.myOverdue,
      teamCheckoutsTotal: c.teamCheckoutsTotal,
      teamCheckoutsOverdue: c.teamCheckoutsOverdue,
      teamReservationsTotal: c.teamReservationsTotal,
      pendingPickupTotal: c.pendingPickupTotal,
      staleReservationTotal: c.staleReservationTotal,
      myShiftsCount,
    },
    partialFailures,
  });
});
