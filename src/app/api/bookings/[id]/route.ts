export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import {
  getBookingDetail,
  updateReservation,
  updateCheckout
} from "@/lib/services/bookings";
import { requireCheckoutAction, getAllowedActions } from "@/lib/services/checkout-rules";
import { getAllowedReservationActions, requireReservationAction } from "@/lib/services/reservation-rules";
import { updateBookingSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;
    const detail = await getBookingDetail(id);

    const allowedActions = detail.kind === "CHECKOUT"
      ? getAllowedActions(actor, detail)
      : detail.kind === "RESERVATION"
        ? getAllowedReservationActions(actor, detail)
        : undefined;

    return ok({ data: { ...detail, allowedActions } });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;
    const body = updateBookingSchema.parse(await req.json());

    // Fetch the booking to determine kind
    const detail = await getBookingDetail(id);

    if (detail.kind === "CHECKOUT") {
      await requireCheckoutAction(id, actor, "edit");
    } else if (detail.kind === "RESERVATION") {
      await requireReservationAction(id, actor, "edit");
    }

    let updated;
    if (detail.kind === "RESERVATION") {
      updated = await updateReservation(id, actor.id, {
        title: body.title,
        requesterUserId: body.requesterUserId,
        locationId: body.locationId,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        serializedAssetIds: body.serializedAssetIds,
        bulkItems: body.bulkItems,
        notes: body.notes
      });
    } else {
      updated = await updateCheckout(id, actor.id, {
        title: body.title,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        serializedAssetIds: body.serializedAssetIds,
        bulkItems: body.bulkItems,
        notes: body.notes
      });
    }

    return ok({ data: updated });
  } catch (error) {
    return fail(error);
  }
}
