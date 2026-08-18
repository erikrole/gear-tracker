import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import { bulkAssignmentScopeSchema } from "@/lib/bulk-schedule-assignment-types";
import { getBulkAssignmentPreview } from "@/lib/services/bulk-schedule-assignment";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift", "manage");
  await enforceRateLimit(`shift:bulk-assignment:preview:${user.id}`, { max: 20, windowMs: 60_000 });
  const scope = bulkAssignmentScopeSchema.parse(await req.json());
  return ok({ data: await getBulkAssignmentPreview(scope) });
});
