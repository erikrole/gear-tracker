export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, HttpError, ok } from "@/lib/http";
import { processOverdueNotifications } from "@/lib/services/notifications";

/**
 * POST /api/notifications/process
 * Triggers overdue-notification processing. Restricted to ADMIN / STAFF.
 */
export async function POST() {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new HttpError(403, "Only admins and staff can trigger notification processing");
    }

    const result = await processOverdueNotifications();
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
