import { db } from "@/lib/db";
import { tokenHash, hashPassword } from "@/lib/auth";
import { ok, HttpError } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const RESET_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 }; // 5 per 15 min

export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(`reset:${ip}`, RESET_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many attempts. Please try again later.");

  const body = resetPasswordSchema.parse(await req.json());

  const hashed = await tokenHash(body.token);
  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashed },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw new HttpError(400, "Invalid or expired reset link");
  }

  const newPasswordHash = await hashPassword(body.password);

  // Update password, delete all reset tokens, and invalidate all sessions
  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash },
    }),
    db.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    }),
    db.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  return ok({ message: "Password reset successfully. Please sign in." });
});
