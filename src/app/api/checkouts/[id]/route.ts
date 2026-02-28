export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const checkout = await db.booking.findUnique({
      where: { id },
      include: {
        location: true,
        requester: { select: { id: true, name: true, email: true } },
        serializedItems: { include: { asset: true } },
        bulkItems: { include: { bulkSku: true } }
      }
    });

    if (!checkout || checkout.kind !== "CHECKOUT") {
      throw new HttpError(404, "Checkout not found");
    }

    return ok({ data: checkout });
  } catch (error) {
    return fail(error);
  }
}
