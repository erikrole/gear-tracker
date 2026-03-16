import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { cancelTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";

export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_trade", "post");
    const { id } = await ctx.params;

    const trade = await cancelTrade(id, actor.id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_trade",
      entityId: id,
      action: "trade_cancelled",
    });

    return ok({ data: trade });
  } catch (error) {
    return fail(error);
  }
}
