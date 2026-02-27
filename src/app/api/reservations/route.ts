export const runtime = "edge";
import { BookingKind, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";
import { createBooking } from "@/lib/services/bookings";
import { parseDateRange } from "@/lib/time";
import { createReservationSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const where: Prisma.BookingWhereInput = {
      kind: BookingKind.RESERVATION,
      ...(searchParams.get("location_id") ? { locationId: searchParams.get("location_id")! } : {}),
      ...(searchParams.get("from") || searchParams.get("to")
        ? {
            startsAt: {
              ...(searchParams.get("from") ? { gte: new Date(searchParams.get("from")!) } : {}),
              ...(searchParams.get("to") ? { lte: new Date(searchParams.get("to")!) } : {})
            }
          }
        : {})
    };

    const { limit, offset } = parsePagination(searchParams);

    const [data, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        include: {
          location: true,
          requester: { select: { id: true, name: true, email: true } },
          serializedItems: { include: { asset: true } },
          bulkItems: { include: { bulkSku: true } }
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
    const body = createReservationSchema.parse(await req.json());
    const { start, end } = parseDateRange(body.startsAt, body.endsAt);

    const reservation = await createBooking({
      kind: BookingKind.RESERVATION,
      title: body.title,
      requesterUserId: body.requesterUserId,
      locationId: body.locationId,
      startsAt: start,
      endsAt: end,
      serializedAssetIds: body.serializedAssetIds,
      bulkItems: body.bulkItems,
      notes: body.notes,
      createdBy: actor.id
    });

    return ok({ data: reservation }, 201);
  } catch (error) {
    return fail(error);
  }
}
