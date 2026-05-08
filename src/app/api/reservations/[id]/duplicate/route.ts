import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { createBooking } from "@/lib/services/bookings";
import { BookingKind, BookingStatus } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";

/**
 * POST /api/reservations/[id]/duplicate
 *
 * Creates a new reservation with the same items, dates, and settings
 * as the source reservation. The original is left unchanged.
 *
 * Permission: staff+ or owner (enforced via "duplicate" action).
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "duplicate", BookingKind.RESERVATION);

  const source = await db.booking.findUniqueOrThrow({
    where: { id },
    include: {
      serializedItems: true,
      bulkItems: true,
    },
  });
  if (source.status !== BookingStatus.BOOKED) {
    throw new HttpError(400, `Cannot duplicate a ${source.status.toLowerCase()} reservation`);
  }

  const duplicate = await createBooking({
    kind: "RESERVATION",
    title: `Copy of ${source.title}`,
    requesterUserId: source.requesterUserId,
    locationId: source.locationId,
    startsAt: source.startsAt,
    endsAt: source.endsAt,
    serializedAssetIds: source.serializedItems.map((i) => i.assetId),
    bulkItems: source.bulkItems.map((i) => ({
      bulkSkuId: i.bulkSkuId,
      quantity: i.plannedQuantity,
    })),
    notes: source.notes ?? undefined,
    createdBy: user.id,
    eventId: source.eventId ?? undefined,
    sportCode: source.sportCode ?? undefined,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: duplicate.id,
    action: "duplicate",
    after: { sourceReservationId: id, title: duplicate.title },
  });

  return ok({ data: duplicate }, 201);
});
