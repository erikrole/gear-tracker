import { db } from "@/lib/db";
import { tokenHash, randomHex } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";

const RESET_TOKEN_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

export async function POST(req: Request) {
  try {
    const body = forgotPasswordSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    // Always return success to prevent email enumeration
    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      // Delete any existing reset tokens for this user
      await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

      // Generate and store a hashed token
      const raw = randomHex(32);
      const hashed = await tokenHash(raw);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

      await db.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashed, expiresAt },
      });

      const resetUrl = `${env.appUrl}/reset-password?token=${raw}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your password — Gear Tracker",
        html: buildResetEmail(user.name, resetUrl),
      });
    }

    return ok({ message: "If that email exists, we sent a reset link." });
  } catch (error) {
    return fail(error);
  }
}

function buildResetEmail(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="border-bottom: 3px solid #c5050c; padding-bottom: 12px; margin-bottom: 20px;">
    <strong style="font-size: 18px;">Password Reset</strong>
  </div>
  <p style="font-size: 15px; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
  <p style="font-size: 15px; line-height: 1.5;">Click the link below to reset your password. This link expires in 1 hour.</p>
  <p><a href="${escapeHtml(resetUrl)}" style="display: inline-block; padding: 10px 24px; background: #c5050c; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a></p>
  <p style="font-size: 13px; color: #6b7280;">If you didn&rsquo;t request this, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 11px; color: #9ca3af;">Gear Tracker &mdash; Wisconsin Athletics</p>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
