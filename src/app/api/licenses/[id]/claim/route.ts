import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { claimCode } from "@/lib/services/licenses";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "license", "claim");
  const code = await claimCode(params.id, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "claim",
    after: { userId: user.id, status: code.status, at: new Date().toISOString() },
  });

  return ok({ data: { id: code.id, code: code.code } });
});
