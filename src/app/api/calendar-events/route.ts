import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const unmappedOnly = searchParams.get("unmapped") === "true";
  const includePast = searchParams.get("includePast") === "true";

  const sportCode = searchParams.get("sportCode");

  // Default to upcoming events from now unless includePast or explicit startDate
  const startsAtFilter = includePast
    ? { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) }
    : { gte: startDate ? new Date(startDate) : new Date(), ...(endDate ? { lte: new Date(endDate) } : {}) };

  const where = {
    ...(Object.keys(startsAtFilter).length > 0 ? { startsAt: startsAtFilter } : {}),
    ...(unmappedOnly ? { locationId: null } : {}),
    ...(sportCode ? { sportCode } : {}),
    status: { not: "CANCELLED" as const }
  };

  const [data, total] = await Promise.all([
    db.calendarEvent.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
        source: { select: { id: true, name: true } }
      },
      orderBy: { startsAt: "asc" },
      take: limit,
      skip: offset
    }),
    db.calendarEvent.count({ where })
  ]);

  return ok({ data, total, limit, offset });
});
