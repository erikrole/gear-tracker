import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { claimTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_trade", "claim");
  const { id } = params;

  const trade = await claimTrade(id, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_trade",
    entityId: id,
    action: "trade_claimed",
    after: { status: trade.status },
  });

  return ok({ data: trade });
});
