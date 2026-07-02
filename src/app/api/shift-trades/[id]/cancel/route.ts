import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { cancelTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_trade", "post");
  const { id } = params;

  const trade = await cancelTrade(id, { id: user.id, role: user.role });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_trade",
    entityId: id,
    action: "trade_cancelled",
    after: {
      // Flag when staff removed someone else's post from the Trade Board.
      cancelledByPoster: trade.postedByUserId === user.id,
    },
  });

  return ok({ data: trade });
});
