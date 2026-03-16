import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { updateReservation } from "@/lib/services/bookings";
import { getAllowedReservationActions, requireReservationAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { updateReservationSchema } from "@/lib/validation";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;

    const reservation = await db.booking.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        serializedItems: {
          select: {
            id: true, assetId: true, allocationStatus: true,
            asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true } },
          },
        },
        bulkItems: {
          select: {
            id: true, plannedQuantity: true, checkedOutQuantity: true, checkedInQuantity: true,
            bulkSku: { select: { id: true, name: true, unit: true } },
          },
        },
      }
    });

    if (!reservation || reservation.kind !== "RESERVATION") {
      throw new HttpError(404, "Reservation not found");
    }

    const allowedActions = getAllowedReservationActions(actor, reservation);

    return ok({ data: { ...reservation, allowedActions } });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;

    await requireReservationAction(params.id, actor, "edit");

    const body = updateReservationSchema.parse(await req.json());

    const reservation = await updateReservation(params.id, actor.id, {
      title: body.title,
      requesterUserId: body.requesterUserId,
      locationId: body.locationId,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      serializedAssetIds: body.serializedAssetIds,
      bulkItems: body.bulkItems,
      notes: body.notes,
      status: body.status
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: params.id,
      action: "edit",
      after: body,
    });

    return ok({ data: reservation });
  } catch (error) {
    return fail(error);
  }
}
