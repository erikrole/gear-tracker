export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { checkinItems } from "@/lib/services/bookings";
import { requireCheckoutAction } from "@/lib/services/checkout-rules";

const checkinItemsSchema = z.object({
  assetIds: z.array(z.string().cuid()).min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;
    const body = checkinItemsSchema.parse(await req.json());

    await requireCheckoutAction(params.id, actor, "checkin");

    const result = await checkinItems(params.id, actor.id, body.assetIds);
    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
