export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePagination(searchParams);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const unmappedOnly = searchParams.get("unmapped") === "true";

    const where = {
      ...(startDate ? { startsAt: { gte: new Date(startDate) } } : {}),
      ...(endDate ? { endsAt: { lte: new Date(endDate) } } : {}),
      ...(unmappedOnly ? { locationId: null } : {}),
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
  } catch (error) {
    return fail(error);
  }
}
