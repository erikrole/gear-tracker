import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok, parsePagination } from "@/lib/http";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const unmappedOnly = searchParams.get("unmapped") === "true";
  const includePast = searchParams.get("includePast") === "true";

  const sportCode = searchParams.get("sportCode");
  const includeHidden = searchParams.get("includeHidden") === "true";

  // Default to upcoming events from now unless includePast or explicit startDate
  const startsAtFilter = includePast
    ? { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) }
    : { gte: startDate ? new Date(startDate) : new Date(), ...(endDate ? { lte: new Date(endDate) } : {}) };

  const where = {
    ...(Object.keys(startsAtFilter).length > 0 ? { startsAt: startsAtFilter } : {}),
    ...(unmappedOnly ? { locationId: null } : {}),
    ...(sportCode ? { sportCode } : {}),
    status: { not: "CANCELLED" as const },
    ...(!includeHidden ? { isHidden: false } : {}),
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

export const POST = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Only staff and admins can create events");
  }

  const body = await req.json();
  const { summary, startsAt, endsAt, allDay, locationId, sportCode, isHome, opponent } = body;

  if (!summary?.trim()) throw new HttpError(400, "Title is required");
  if (!startsAt) throw new HttpError(400, "Start date/time is required");
  if (!endsAt) throw new HttpError(400, "End date/time is required");

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new HttpError(400, "Invalid date");
  if (end <= start) throw new HttpError(400, "End must be after start");

  const event = await db.calendarEvent.create({
    data: {
      sourceId: null,
      externalId: crypto.randomUUID(),
      summary: summary.trim(),
      startsAt: start,
      endsAt: end,
      allDay: allDay === true,
      locationId: locationId || null,
      sportCode: sportCode || null,
      isHome: sportCode ? (isHome ?? null) : null,
      opponent: (sportCode && opponent?.trim()) ? opponent.trim() : null,
    },
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  return ok({ data: event }, 201);
});
