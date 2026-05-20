import { db } from "@/lib/db";
import { tokenHash, hashPassword } from "@/lib/auth";
import { ok, HttpError } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";
import { Prisma } from "@prisma/client";

const RESET_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 }; // 5 per 15 min

export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`reset:${ip}`, RESET_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many attempts. Please try again later.");

  const body = resetPasswordSchema.parse(await req.json());

  const hashed = await tokenHash(body.token);
  const now = new Date();
  const newPasswordHash = await hashPassword(body.password);

  const resetUser = await db.$transaction(
    async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hashed },
        include: { user: { select: { id: true, role: true } } },
      });

      if (!resetToken || resetToken.expiresAt < now) {
        throw new HttpError(400, "Invalid or expired reset link");
      }

      const consumed = await tx.passwordResetToken.deleteMany({
        where: {
          id: resetToken.id,
          expiresAt: { gte: now },
        },
      });

      if (consumed.count !== 1) {
        throw new HttpError(400, "Invalid or expired reset link");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash, forcePasswordChange: false },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId },
      });
      await tx.session.deleteMany({
        where: { userId: resetToken.userId },
      });

      return resetToken.user;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await createAuditEntry({
    actorId: resetUser.id,
    actorRole: resetUser.role,
    entityType: "user",
    entityId: resetUser.id,
    action: "password_reset_self",
    after: {
      ip,
      userAgent: req.headers.get("user-agent") ?? null,
    },
  });

  return ok({ message: "Password reset successfully. Please sign in." });
});
