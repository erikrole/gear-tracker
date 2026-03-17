import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { updateUserRoleSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const { id } = params;
  const body = updateUserRoleSchema.parse(await req.json());

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    throw new HttpError(404, "User not found");
  }

  if (target.id === user.id && body.role !== user.role) {
    throw new HttpError(400, "You cannot change your own role");
  }

  const previousRole = target.role;
  const updated = await db.user.update({
    where: { id },
    data: { role: body.role }
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: id,
    action: "role_changed",
    before: { role: previousRole },
    after: { role: updated.role },
  });

  return ok({
    data: {
      id: updated.id,
      role: updated.role
    }
  });
});
