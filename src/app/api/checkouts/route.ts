export const runtime = "edge";
import { BookingKind, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";
import { createBooking } from "@/lib/services/bookings";
import { resolveEventDefaults } from "@/lib/services/event-defaults";
import { parseDateRange } from "@/lib/time";
import { createCheckoutSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const where: Prisma.BookingWhereInput = {
      kind: BookingKind.CHECKOUT,
      ...(searchParams.get("status") ? { status: searchParams.get("status") as never } : {}),
      ...(searchParams.get("location_id") ? { locationId: searchParams.get("location_id")! } : {}),
      ...(searchParams.get("sport_code") ? { sportCode: searchParams.get("sport_code")! } : {})
    };

    const { limit, offset } = parsePagination(searchParams);

    const [data, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
        include: {
          location: true,
          requester: { select: { id: true, name: true, email: true } },
          serializedItems: { include: { asset: true } },
          bulkItems: { include: { bulkSku: true } },
          event: { select: { id: true, summary: true, sportCode: true, opponent: true, isHome: true } }
        },
        take: limit,
        skip: offset
      }),
      db.booking.count({ where })
    ]);

    return ok({ data, total, limit, offset });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    const body = createCheckoutSchema.parse(await req.json());
    const { start, end } = parseDateRange(body.startsAt, body.endsAt);

    // Event-default prefill: if sportCode provided but no eventId,
    // look up next upcoming event and use as defaults (ad hoc fallback if none found)
    let eventId = body.eventId;
    let title = body.title;
    let effectiveStart = start;
    let effectiveEnd = end;
    let effectiveLocationId = body.locationId;
    let sportCode = body.sportCode;

    if (body.sportCode && !body.eventId) {
      const defaults = await resolveEventDefaults(body.sportCode);
      if (defaults.eventId) {
        eventId = defaults.eventId;
        // Use event values as defaults, but caller-supplied values take precedence
        title = body.title || defaults.title || body.title;
        if (defaults.startsAt) effectiveStart = defaults.startsAt;
        if (defaults.endsAt) effectiveEnd = defaults.endsAt;
        if (defaults.locationId) effectiveLocationId = defaults.locationId;
        sportCode = defaults.sportCode ?? body.sportCode;
      }
    }

    const checkout = await createBooking({
      kind: BookingKind.CHECKOUT,
      title,
      requesterUserId: body.requesterUserId,
      locationId: effectiveLocationId,
      startsAt: effectiveStart,
      endsAt: effectiveEnd,
      serializedAssetIds: body.serializedAssetIds,
      bulkItems: body.bulkItems,
      notes: body.notes,
      createdBy: actor.id,
      sourceReservationId: body.sourceReservationId,
      eventId,
      sportCode
    });

    return ok({ data: checkout }, 201);
  } catch (error) {
    return fail(error);
  }
}
