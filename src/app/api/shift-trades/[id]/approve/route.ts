import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { approveTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SCHEDULE_MUTATION_LIMIT } from "@/lib/rate-limit";

export const PATCH = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_trade", "approve");
  await enforceRateLimit(`shift-trade:review:${user.id}`, SCHEDULE_MUTATION_LIMIT);
  const { id } = params;

  const trade = await approveTrade(id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_trade",
    entityId: id,
    action: "trade_approved",
  });

  return ok({ data: trade });
});
