import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { startScanSession } from "@/lib/services/scans";
import { startScanSessionSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;
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
