import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { cancelBlast } from "@/lib/services/blasts";

/**
 * Stops the banner on every recipient's next fetch. Already-delivered APNs alerts
 * cannot be recalled -- the confirm dialog says so.
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "blast", "cancel");
  await enforceRateLimit(`blasts:cancel:${user.id}`, SETTINGS_MUTATION_LIMIT);

  await cancelBlast(params.id, user);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "blast",
    entityId: params.id,
    action: "cancelled",
  });

  return ok({ success: true });
});
