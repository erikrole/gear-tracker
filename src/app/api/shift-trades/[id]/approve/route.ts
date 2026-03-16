import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { approveTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";

export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_trade", "approve");
    const { id } = await ctx.params;

    const trade = await approveTrade(id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_trade",
      entityId: id,
      action: "trade_approved",
    });

    return ok({ data: trade });
  } catch (error) {
    return fail(error);
  }
}
