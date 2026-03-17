import { BookingKind } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { parseDateRange } from "@/lib/time";
import { createAuditEntry } from "@/lib/audit";
import { createReservationSchema } from "@/lib/validation";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const result = await listBookings(BookingKind.RESERVATION, searchParams);
  return ok(result);
});

export const POST = withAuth(async (req, { user }) => {
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
    createdBy: user.id,
    eventId: body.eventId,
    sportCode: body.sportCode,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: reservation.id,
    action: "create",
    after: { title: reservation.title ?? body.title, kind: "RESERVATION" },
  });

  return ok({ data: reservation }, 201);
});
