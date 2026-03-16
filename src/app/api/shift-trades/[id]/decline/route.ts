export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { declineTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";

export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_trade", "approve");
    const { id } = await ctx.params;

    const trade = await declineTrade(id);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_trade",
      entityId: id,
      action: "trade_declined",
    });

    return ok({ data: trade });
  } catch (error) {
    return fail(error);
  }
}
