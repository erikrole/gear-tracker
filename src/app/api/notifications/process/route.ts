import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { processOverdueNotifications } from "@/lib/services/notifications";

/**
 * POST /api/notifications/process
 * Triggers overdue-notification processing. Restricted to ADMIN / STAFF.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    requirePermission(user.role, "notification", "process");

    const result = await processOverdueNotifications();
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
