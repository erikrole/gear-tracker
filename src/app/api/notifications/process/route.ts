import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { processOverdueNotifications } from "@/lib/services/notifications";

/**
 * POST /api/notifications/process
 * Triggers overdue-notification processing. Restricted to ADMIN / STAFF.
 */
export const POST = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "notification", "process");

  const result = await processOverdueNotifications();

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "notification",
    entityId: "overdue-batch",
    action: "processed",
    after: { scanned: result.scanned, notificationsCreated: result.notificationsCreated },
  });

  return ok(result);
});
