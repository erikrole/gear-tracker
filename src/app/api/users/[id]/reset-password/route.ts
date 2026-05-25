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

  // Generate a secure temporary password (~16 chars, 96 bits of entropy).
  // Returned once in the response body, which ok() serves no-store; the user
  // is forced to change it on next login via forcePasswordChange.
  const tempPassword = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  // Atomic: update password + invalidate sessions together
  await db.$transaction([
    db.user.update({ where: { id }, data: { passwordHash, forcePasswordChange: true } }),
    db.session.deleteMany({ where: { userId: id } }),
  ]);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: id,
    action: "password_reset",
    after: { resetBy: user.name, forcePasswordChange: true },
  });

  return ok({ data: { temporaryPassword: tempPassword, forcePasswordChange: true } });
});
