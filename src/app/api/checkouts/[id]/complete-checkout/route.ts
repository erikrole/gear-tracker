import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { completeCheckoutScan } from "@/lib/services/scans";
import { createAuditEntry } from "@/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "checkout", "complete");
    const params = await ctx.params;
    const result = await completeCheckoutScan(params.id, actor.id, actor.role);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "booking",
      entityId: params.id,
      action: "complete_checkout",
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
