import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { claimTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";
import { evaluateBadges } from "@/lib/services/badges";

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

  // Badge evaluation: if trade completed immediately (no approval needed)
  if (trade.status === "COMPLETED" && trade.claimedByUserId) {
    evaluateBadges(trade.claimedByUserId, "shift_trade_completed", { shiftTradeId: id }).catch(
      (err) => console.error("Badge evaluation error:", err)
    );
  }

  return ok({ data: trade });
});
