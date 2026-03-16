import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { createBooking } from "@/lib/services/bookings";
import { createAuditEntry } from "@/lib/audit";
import { requireReservationAction } from "@/lib/services/booking-rules";

/**
 * POST /api/reservations/[id]/convert
 *
 * Converts a BOOKED reservation into a checkout.
 * Atomically creates checkout from reservation items and cancels the reservation.
 *
 * Permission: staff+ or owner (enforced via "convert" action).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;

    // Enforce convert permission
    const reservation = await requireReservationAction(id, actor, "convert");

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
      createdBy: actor.id,
      sourceReservationId: id,
      eventId: full.eventId ?? undefined,
      sportCode: full.sportCode ?? undefined,
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: id,
      action: "convert",
      after: { checkoutId: checkout.id, sourceReservationId: id },
    });

    return ok({ data: checkout });
  } catch (error) {
    return fail(error);
  }
}
