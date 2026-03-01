export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { cancelBooking } from "@/lib/services/bookings";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;
    const result = await cancelBooking(id, actor.id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
