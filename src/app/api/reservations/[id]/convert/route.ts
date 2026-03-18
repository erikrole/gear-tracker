import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { createBooking } from "@/lib/services/bookings";
import { createAuditEntry } from "@/lib/audit";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";

/**
 * POST /api/reservations/[id]/convert
 *
 * Converts a BOOKED reservation into a checkout.
 * Atomically creates checkout from reservation items and cancels the reservation.
 *
 * Permission: staff+ or owner (enforced via "convert" action).
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  // Enforce convert permission
  await requireBookingAction(id, user, "convert", BookingKind.RESERVATION);

  // Load full reservation with items for the conversion
  const full = await db.booking.findUniqueOrThrow({
    where: { id },
    include: {
      serializedItems: true,
      bulkItems: true,
    },
  });

  // Create checkout from reservation (this atomically cancels the reservation)
  const checkout = await createBooking({
    kind: "CHECKOUT",
    title: full.title,
    requesterUserId: full.requesterUserId,
    locationId: full.locationId,
    startsAt: full.startsAt,
    endsAt: full.endsAt,
    serializedAssetIds: full.serializedItems.map((i) => i.assetId),
    bulkItems: full.bulkItems.map((i) => ({
      bulkSkuId: i.bulkSkuId,
      quantity: i.plannedQuantity,
    })),
    notes: full.notes ?? undefined,
    createdBy: user.id,
    sourceReservationId: id,
    eventId: full.eventId ?? undefined,
    sportCode: full.sportCode ?? undefined,
    shiftAssignmentId: full.shiftAssignmentId ?? undefined,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "convert",
    after: { checkoutId: checkout.id, sourceReservationId: id },
  });

  return ok({ data: checkout });
});
