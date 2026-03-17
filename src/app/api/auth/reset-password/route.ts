import { db } from "@/lib/db";
import { tokenHash, hashPassword } from "@/lib/auth";
import { ok } from "@/lib/http";
import { HttpError } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";

export const POST = withHandler(async (req) => {
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
