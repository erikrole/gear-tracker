import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, fail, HttpError, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { assertDateOrder, parseOptionalDate } from "@/lib/api-dates";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift", "view");

  const url = new URL(req.url);
  const { limit: rawLimit, offset } = parsePagination(url.searchParams);
  const limit = Math.min(rawLimit, 500);

  const sportCode = url.searchParams.get("sportCode");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const eventId = url.searchParams.get("eventId");
  const parsedStartDate = parseOptionalDate(startDate, "startDate");
  const parsedEndDate = parseOptionalDate(endDate, "endDate");
  assertDateOrder(parsedStartDate, parsedEndDate);

  const where: Record<string, unknown> = {};
  if (eventId) where.eventId = eventId;

  // Filter by event properties via nested where
  const eventWhere: Record<string, unknown> = {};
  if (sportCode) eventWhere.sportCode = sportCode;
  if (parsedStartDate) eventWhere.startsAt = { gte: parsedStartDate };
  if (parsedEndDate) {
    eventWhere.endsAt = { ...(eventWhere.endsAt as object ?? {}), lte: parsedEndDate };
  }
  if (Object.keys(eventWhere).length > 0) {
    where.event = eventWhere;
  }

  const [total, groups] = await Promise.all([
    db.shiftGroup.count({ where }),
    db.shiftGroup.findMany({
    where,
    take: limit,
    skip: offset,
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
              status: { in: ACTIVE_ASSIGNMENT_STATUSES },
            },
            include: {
              user: { select: { id: true, name: true, role: true, primaryArea: true, avatarUrl: true } },
            },
          },
        },
        orderBy: [{ area: "asc" }, { workerType: "asc" }],
      },
    },
    orderBy: { event: { startsAt: "asc" } },
  }),
  ]);

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

  return ok({ data, total });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift", "manage");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const eventId = typeof (body as { eventId?: unknown }).eventId === "string"
    ? (body as { eventId: string }).eventId
    : null;
  if (!eventId) return fail(new HttpError(400, "eventId required"));

  const group = await db.shiftGroup.create({
    data: { eventId, manuallyEdited: true },
    include: {
      shifts: {
        include: {
          assignments: {
            where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
            include: { user: { select: { id: true, name: true, role: true, primaryArea: true, avatarUrl: true } } },
          },
        },
      },
    },
  });

  return ok({
    data: {
      ...group,
      coverage: { total: 0, filled: 0, percentage: 0 },
    },
  });
});
