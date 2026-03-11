export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { duplicateReservation } from "@/lib/services/bookings";
import { requireReservationAction } from "@/lib/services/booking-rules";

/**
 * POST /api/reservations/[id]/duplicate
 *
 * Creates a DRAFT copy of a reservation with the same items, location, and notes.
 * User must edit dates and confirm (DRAFT → BOOKED) to allocate items.
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

    const duplicate = await duplicateReservation(id, actor.id);

    return ok({ data: duplicate });
  } catch (error) {
    return fail(error);
  }
}
