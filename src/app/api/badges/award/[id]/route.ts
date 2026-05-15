import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { badgesEnabled } from "@/lib/badges";
import { revokeStudentBadge } from "@/lib/badges/queries";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export const DELETE = withAuth(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN"]);
  if (!badgesEnabled()) {
    throw new HttpError(409, "Badges are disabled");
  }
  if (!params.id) throw new HttpError(400, "Missing badge award ID");

  const revoked = await revokeStudentBadge({
    studentBadgeId: params.id,
    revokedById: user.id,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "badge_award",
    entityId: params.id,
    action: "badge_revoked_manually",
    after: {
      userId: revoked.userId,
      definitionId: revoked.definitionId,
      studentBadgeId: params.id,
    },
  });

  return ok({ data: { id: params.id } });
});
