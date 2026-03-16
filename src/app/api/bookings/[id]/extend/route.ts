import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { extendBooking } from "@/lib/services/bookings";
import { requireCheckoutAction, requireReservationAction } from "@/lib/services/booking-rules";
import { extendBookingSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;
    const body = extendBookingSchema.parse(await req.json());

    const booking = await db.booking.findUnique({ where: { id } });
    if (booking?.kind === "CHECKOUT") {
      await requireCheckoutAction(id, actor, "extend");
    } else if (booking?.kind === "RESERVATION") {
      await requireReservationAction(id, actor, "extend");
    }

    const updated = await extendBooking(id, actor.id, new Date(body.endsAt));
    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: id,
      action: "extend",
      after: { endsAt: body.endsAt },
    });
    return ok({ data: updated });
  } catch (error) {
    return fail(error);
  }
}
