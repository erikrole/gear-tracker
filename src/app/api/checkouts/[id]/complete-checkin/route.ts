export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { completeCheckinScan } from "@/lib/services/scans";
import { fail, ok } from "@/lib/http";
import { requireCheckoutAction } from "@/lib/services/checkout-rules";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;

    await requireCheckoutAction(params.id, actor, "checkin");

    const result = await completeCheckinScan(params.id, actor.id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
