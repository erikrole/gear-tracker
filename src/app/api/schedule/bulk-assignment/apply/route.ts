import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import { bulkAssignmentApplySchema } from "@/lib/bulk-schedule-assignment-types";
import { enqueuePendingScheduleRelease } from "@/lib/schedule-auto-release";
import { applyBulkScheduleAssignment } from "@/lib/services/bulk-schedule-assignment";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift", "manage");
  await enforceRateLimit(`shift:bulk-assignment:apply:${user.id}`, { max: 10, windowMs: 60_000 });
  const input = bulkAssignmentApplySchema.parse(await req.json());
  const data = await applyBulkScheduleAssignment(input, user, enqueuePendingScheduleRelease);
  return ok({ data });
});
