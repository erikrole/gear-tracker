import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { normalizeAllDayToUtcMidnight } from "@/lib/app-time";
import { normalizeOpponentName } from "@/lib/schedule-event-identity";
import { buildScheduleEventWhere } from "@/lib/schedule-event-where";
import { nullableSportCodeSchema, optionalSportCodeSchema } from "@/lib/validation";
import { z } from "zod";

function canIncludeHiddenEvents(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

const nullableLocationIdSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, z.string().cuid().nullable());

const nullableOpponentSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}, z.string().max(120).nullable());

const createCalendarEventSchema = z.object({
  summary: z.string().trim().min(1, "Title is required").max(500),
  startsAt: z.string().trim().min(1, "Start date/time is required"),
  endsAt: z.string().trim().min(1, "End date/time is required"),
  allDay: z.boolean().optional().default(false),
  locationId: nullableLocationIdSchema,
  sportCode: nullableSportCodeSchema,
  isHome: z.boolean().nullable().optional().default(null),
  opponent: nullableOpponentSchema,
});

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const unmappedOnly = searchParams.get("unmapped") === "true";
  const includePast = searchParams.get("includePast") === "true";

  const sportCode = optionalSportCodeSchema.parse(searchParams.get("sportCode") ?? undefined) ?? null;
  const includeHidden = searchParams.get("includeHidden") === "true";
  if (includeHidden && !canIncludeHiddenEvents(user.role)) {
    throw new HttpError(403, "Only staff and admins can include hidden events");
  }
  const includeArchived = searchParams.get("includeArchived") === "true";
  const parsedStartDate = parseOptionalDate(startDate, "startDate");
  const parsedEndDate = parseOptionalDate(endDate, "endDate");
  assertDateOrder(parsedStartDate, parsedEndDate);

  const where = buildScheduleEventWhere({
    parsedStartDate,
    parsedEndDate,
    includePast,
    includeHidden,
    includeArchived,
    unmappedOnly,
    sportCode,
  });

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

  // Attach crew coverage so list surfaces (e.g. iOS Schedule) can show
  // filled/total without drilling into each event. One batched query keyed by
  // the unique eventId index — no N+1. `coverage` is null for events with no
  // (non-archived) shift group. `filled` = shifts with at least one assignment,
  // matching the shift-groups route's coverage semantics.
  const eventIds = data.map((e) => e.id);
  const groups = eventIds.length
    ? await db.shiftGroup.findMany({
        where: { eventId: { in: eventIds }, archivedAt: null },
        select: {
          eventId: true,
          shifts: { select: { _count: { select: { assignments: true } } } },
        },
      })
    : [];
  const coverageByEvent = new Map<string, { total: number; filled: number; percentage: number }>();
  for (const g of groups) {
    const totalShifts = g.shifts.length;
    const filledShifts = g.shifts.filter((s) => s._count.assignments > 0).length;
    coverageByEvent.set(g.eventId, {
      total: totalShifts,
      filled: filledShifts,
      percentage: totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0,
    });
  }
  const dataWithCoverage = data.map((e) => ({
    ...e,
    coverage: coverageByEvent.get(e.id) ?? null,
  }));

  return ok({ data: dataWithCoverage, total, limit, offset });
});

export const POST = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Only staff and admins can create events");
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const body = createCalendarEventSchema.parse(rawBody);

  const rawStart = new Date(body.startsAt);
  const rawEnd = new Date(body.endsAt);
  if (isNaN(rawStart.getTime()) || isNaN(rawEnd.getTime())) throw new HttpError(400, "Invalid date");
  if (rawEnd <= rawStart) throw new HttpError(400, "End must be after start");

  const isAllDay = body.allDay === true;
  // All-day events are dates, not instants — store them as canonical UTC
  // midnight so every reader treats them the same regardless of timezone,
  // instead of the local-midnight encoding the form historically sent.
  const start = isAllDay ? normalizeAllDayToUtcMidnight(rawStart) : rawStart;
  const end = isAllDay ? normalizeAllDayToUtcMidnight(rawEnd) : rawEnd;

  const event = await db.calendarEvent.create({
    data: {
      sourceId: null,
      externalId: crypto.randomUUID(),
      summary: body.summary,
      startsAt: start,
      endsAt: end,
      allDay: isAllDay,
      locationId: body.locationId,
      sportCode: body.sportCode,
      isHome: body.sportCode ? body.isHome : null,
      opponent: body.sportCode ? normalizeOpponentName(body.opponent) : null,
    },
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "calendar_event",
    entityId: event.id,
    action: "calendar_event_created",
    after: {
      summary: event.summary,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      locationId: event.locationId,
      sportCode: event.sportCode,
      isHome: event.isHome,
    },
  });

  return ok({ data: event }, 201);
});
