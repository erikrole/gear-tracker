export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { completeCheckoutScan } from "@/lib/services/scans";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "checkout", "complete");
    const params = await ctx.params;
    const result = await completeCheckoutScan(params.id, actor.id, actor.role);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
