import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { completeCheckoutScan } from "@/lib/services/scans";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "checkout", "complete");
  const { id } = params;
  const result = await completeCheckoutScan(id, user.id, user.role);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "complete_checkout",
  });

  return ok(result);
});
