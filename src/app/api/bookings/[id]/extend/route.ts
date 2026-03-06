export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { extendBooking } from "@/lib/services/bookings";
import { requireCheckoutAction } from "@/lib/services/checkout-rules";
import { extendBookingSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;
    const body = extendBookingSchema.parse(await req.json());

    // If the booking is a checkout, enforce action gating
    const booking = await db.booking.findUnique({ where: { id } });
    if (booking?.kind === "CHECKOUT") {
      await requireCheckoutAction(id, actor, "extend");
    }

    const updated = await extendBooking(id, actor.id, new Date(body.endsAt));
    return ok({ data: updated });
  } catch (error) {
    return fail(error);
  }
}
