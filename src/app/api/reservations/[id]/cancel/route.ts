import { requireAuth } from "@/lib/auth";
import { cancelReservation } from "@/lib/services/bookings";
import { fail, ok } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;
    const result = await cancelReservation(params.id, actor.id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
