import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "location_mapping", "delete");
  await enforceRateLimit(`location-mappings:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const { id } = params;
  await db.locationMapping.delete({ where: { id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "location_mapping",
    entityId: id,
    action: "delete",
  });

  return ok({ deleted: true });
});
