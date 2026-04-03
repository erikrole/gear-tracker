import { ShiftAssignmentStatus } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

const ACTIVE_STATUSES: ShiftAssignmentStatus[] = ["DIRECT_ASSIGNED", "APPROVED"];

export const GET = withAuth(async (_req, { user }) => {
  const now = new Date();

  // Week boundaries (Monday–Sunday)
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Month boundaries
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Single query: all active assignments this month (superset of this week)
  const assignments = await db.shiftAssignment.findMany({
    where: {
      userId: user.id,
      status: { in: ACTIVE_STATUSES },
      shift: {
        startsAt: { lte: monthEnd },
        endsAt: { gte: monthStart },
      },
    },
    select: {
      shift: {
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  let weekMinutes = 0;
  let monthMinutes = 0;

  for (const a of assignments) {
    const start = new Date(a.shift.startsAt);
    const end = new Date(a.shift.endsAt);
    const mins = (end.getTime() - start.getTime()) / 60_000;

    monthMinutes += mins;

    if (start <= weekEnd && end >= weekStart) {
      weekMinutes += mins;
    }
  }

  return ok({
    data: {
      thisWeek: Math.round(weekMinutes / 60 * 10) / 10,
      thisMonth: Math.round(monthMinutes / 60 * 10) / 10,
      shiftCountWeek: assignments.filter((a) => {
        const s = new Date(a.shift.startsAt);
        return s >= weekStart && s <= weekEnd;
      }).length,
      shiftCountMonth: assignments.length,
    },
  });
});
