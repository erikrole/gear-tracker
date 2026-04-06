import { withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import crypto from "crypto";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN"]);

  const { id } = params;

  if (user.id === id) {
    throw new HttpError(400, "Cannot reset your own password via this endpoint. Use your profile settings.");
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!target) throw new HttpError(404, "User not found");

  // Generate a secure temporary password
  const tempPassword = crypto.randomBytes(6).toString("base64url"); // ~8 chars
  const passwordHash = await hashPassword(tempPassword);

  // Atomic: update password + invalidate sessions together
  await db.$transaction([
    db.user.update({ where: { id }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId: id } }),
  ]);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: id,
    action: "password_reset",
    after: { resetBy: user.name },
  });

  return ok({ data: { temporaryPassword: tempPassword } });
});
