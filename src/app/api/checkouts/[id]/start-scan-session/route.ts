export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { startScanSession } from "@/lib/services/scans";
import { startScanSessionSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "checkout", "scan");
    const params = await ctx.params;

    // Students can only start scan sessions on their own checkouts
    if (actor.role === "STUDENT") {
      const booking = await db.booking.findUnique({
        where: { id: params.id },
        select: { requesterUserId: true, createdBy: true },
      });
      if (!booking || (booking.requesterUserId !== actor.id && booking.createdBy !== actor.id)) {
        throw new HttpError(403, "You can only scan items on your own checkouts");
      }
    }

    const body = startScanSessionSchema.parse(await req.json());

    const session = await startScanSession({
      bookingId: params.id,
      actorUserId: actor.id,
      phase: body.phase
    });

    return ok({ data: session });
  } catch (error) {
    return fail(error);
  }
}
