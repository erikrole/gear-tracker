export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { updateReservation } from "@/lib/services/bookings";
import { updateReservationSchema } from "@/lib/validation";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const reservation = await db.booking.findUnique({
      where: { id },
      include: {
        location: true,
        requester: { select: { id: true, name: true, email: true } },
        serializedItems: { include: { asset: true } },
        bulkItems: { include: { bulkSku: true } }
      }
    });

    if (!reservation || reservation.kind !== "RESERVATION") {
      throw new HttpError(404, "Reservation not found");
    }

    return ok({ data: reservation });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;
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

    return ok({ data: reservation });
  } catch (error) {
    return fail(error);
  }
}
