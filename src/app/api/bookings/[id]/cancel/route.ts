export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { cancelBooking } from "@/lib/services/bookings";
import { requireCheckoutAction, requireReservationAction } from "@/lib/services/booking-rules";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;

    const booking = await db.booking.findUnique({ where: { id } });
    if (booking?.kind === "CHECKOUT") {
      await requireCheckoutAction(id, actor, "cancel");
    } else if (booking?.kind === "RESERVATION") {
      await requireReservationAction(id, actor, "cancel");
    }

    const result = await cancelBooking(id, actor.id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
