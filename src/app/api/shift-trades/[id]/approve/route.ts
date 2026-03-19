import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { approveTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";
import { evaluateBadges } from "@/lib/services/badges";
import { db } from "@/lib/db";

export const PATCH = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_trade", "approve");
  const { id } = params;

  const trade = await approveTrade(id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_trade",
    entityId: id,
    action: "trade_approved",
  });

  // Badge evaluation: trade completed via approval
  if (trade.status === "COMPLETED") {
    const fullTrade = await db.shiftTrade.findUnique({
      where: { id },
      select: { claimedByUserId: true },
    });
    if (fullTrade?.claimedByUserId) {
      evaluateBadges(fullTrade.claimedByUserId, "shift_trade_completed", { shiftTradeId: id }).catch(
        (err) => console.error("Badge evaluation error:", err)
      );
    }
  }

  return ok({ data: trade });
});
