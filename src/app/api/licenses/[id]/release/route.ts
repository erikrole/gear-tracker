import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { releaseCode } from "@/lib/services/licenses";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "license", "release");
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  const code = await releaseCode(params.id, user.id, isAdmin);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "license_code",
    entityId: params.id,
    action: "release",
    after: { status: code.status, releasedById: isAdmin ? user.id : null },
  });

  return ok({ data: code });
});
