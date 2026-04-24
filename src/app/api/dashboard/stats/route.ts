import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

const STATS_LIMIT = { max: 90, windowMs: 60_000 };

// Lightweight stats-only endpoint — runs the single aggregated SQL query and
// returns nothing else. Used by the dashboard to keep stat cards and the overdue
// count fresh (60s TTL) without re-running the expensive full-payload queries.
export const GET = withAuth(async (_req, { user }) => {
  const { allowed } = checkRateLimit(`dashboard:stats:${user.id}`, STATS_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  type CountRow = {
    team_checkouts: bigint;
    team_checkouts_overdue: bigint;
    team_reservations: bigint;
    my_checkouts: bigint;
    my_overdue: bigint;
    total_checked_out: bigint;
    total_overdue: bigint;
    total_reserved: bigint;
    due_today: bigint;
  };

  const [counts] = await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN') AS total_checked_out,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND ends_at < ${now}) AS total_overdue,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND ends_at >= ${startOfToday} AND ends_at < ${startOfTomorrow}) AS due_today,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id != ${user.id}) AS team_checkouts,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id != ${user.id} AND ends_at < ${now}) AS team_checkouts_overdue,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id = ${user.id}) AS my_checkouts,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id = ${user.id} AND ends_at < ${now}) AS my_overdue,
      COUNT(*) FILTER (WHERE kind = 'RESERVATION' AND status = 'BOOKED' AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow}) AS total_reserved,
      COUNT(*) FILTER (WHERE kind = 'RESERVATION' AND status = 'BOOKED' AND requester_user_id != ${user.id} AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow}) AS team_reservations
    FROM bookings
    WHERE (kind = 'CHECKOUT' AND status = 'OPEN')
       OR (kind = 'RESERVATION' AND status = 'BOOKED' AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow})
  `);

  return ok({
    data: {
      role: user.role,
      stats: {
        checkedOut: Number(counts.total_checked_out),
        overdue: Number(counts.total_overdue),
        reserved: Number(counts.total_reserved),
        dueToday: Number(counts.due_today),
      },
      overdueCount: Number(counts.total_overdue),
      myCheckoutsTotal: Number(counts.my_checkouts),
      myOverdueCount: Number(counts.my_overdue),
      teamCheckoutsTotal: Number(counts.team_checkouts),
      teamCheckoutsOverdue: Number(counts.team_checkouts_overdue),
      teamReservationsTotal: Number(counts.team_reservations),
    },
  });
});
