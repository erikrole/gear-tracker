import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "view");

    const url = new URL(req.url);
    const sportCode = url.searchParams.get("sportCode");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    // Filter by event properties via nested where
    const eventWhere: Record<string, unknown> = {};
    if (sportCode) eventWhere.sportCode = sportCode;
    if (startDate) eventWhere.startsAt = { gte: new Date(startDate) };
    if (endDate) {
      eventWhere.endsAt = { ...(eventWhere.endsAt as object ?? {}), lte: new Date(endDate) };
    }
    if (Object.keys(eventWhere).length > 0) {
      where.event = eventWhere;
    }

    const groups = await db.shiftGroup.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            summary: true,
            startsAt: true,
            endsAt: true,
            sportCode: true,
            isHome: true,
            opponent: true,
            locationId: true,
          },
        },
        shifts: {
          include: {
            assignments: {
              where: {
                status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
              },
              include: {
                user: { select: { id: true, name: true, primaryArea: true } },
              },
            },
          },
          orderBy: [{ area: "asc" }, { workerType: "asc" }],
        },
      },
      orderBy: { event: { startsAt: "asc" } },
    });

    // Add coverage summary
    const data = groups.map((g) => {
      const totalShifts = g.shifts.length;
      const filledShifts = g.shifts.filter(
        (s) => s.assignments.length > 0
      ).length;

      return {
        ...g,
        coverage: {
          total: totalShifts,
          filled: filledShifts,
          percentage: totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0,
        },
      };
    });

    return ok({ data });
  } catch (error) {
    return fail(error);
  }
}
