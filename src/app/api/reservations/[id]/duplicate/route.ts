export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { createBooking } from "@/lib/services/bookings";
import { requireReservationAction } from "@/lib/services/booking-rules";

/**
 * POST /api/reservations/[id]/duplicate
 *
 * Creates a new reservation with the same items, dates, and settings
 * as the source reservation. The original is left unchanged.
 *
 * Permission: staff+ or owner (enforced via "duplicate" action).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;

    await requireReservationAction(id, actor, "duplicate");

    const source = await db.booking.findUniqueOrThrow({
      where: { id },
      include: {
        serializedItems: true,
        bulkItems: true,
      },
    });

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
      createdBy: actor.id,
      eventId: source.eventId ?? undefined,
      sportCode: source.sportCode ?? undefined,
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: duplicate.id,
      action: "duplicate",
      after: { sourceReservationId: id, title: duplicate.title },
    });

    return ok({ data: duplicate }, 201);
  } catch (error) {
    return fail(error);
  }
}
