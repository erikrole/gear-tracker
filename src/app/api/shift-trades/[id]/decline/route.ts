import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { declineTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SCHEDULE_MUTATION_LIMIT } from "@/lib/rate-limit";

export const PATCH = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_trade", "approve");
  await enforceRateLimit(`shift-trade:review:${user.id}`, SCHEDULE_MUTATION_LIMIT);
  const { id } = params;

  const trade = await declineTrade(id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_trade",
    entityId: id,
    action: "trade_declined",
  });

  return ok({ data: trade });
});
