import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

/** Delete an allowed email entry (only if unclaimed) */
export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "allowed_email", "delete");

  const entry = await db.allowedEmail.findUnique({
    where: { id: params.id },
  });

  if (!entry) {
    throw new HttpError(404, "Allowed email not found");
  }

  if (entry.claimedAt) {
    throw new HttpError(
      400,
      "Cannot delete an allowlist entry that has already been claimed"
    );
  }

  await db.allowedEmail.delete({ where: { id: params.id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "allowed_email",
    entityId: entry.id,
    action: "deleted",
    before: { email: entry.email, role: entry.role },
  });

  return ok({ success: true });
});
