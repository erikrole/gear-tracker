export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { completeCheckinScan } from "@/lib/services/scans";
import { fail, ok } from "@/lib/http";
import { requireCheckoutAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;

    await requireCheckoutAction(params.id, actor, "checkin");

    const result = await completeCheckinScan(params.id, actor.id, actor.role);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: params.id,
      action: "complete_checkin",
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
