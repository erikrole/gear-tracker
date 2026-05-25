import { db } from "@/lib/db";
import { tokenHash, randomHex } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { HttpError, ok } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";

const RESET_TOKEN_EXPIRY_MS = 1000 * 60 * 60; // 1 hour
const FORGOT_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 }; // per IP; sized for shared NAT

export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`forgot:${ip}`, FORGOT_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please try again later.");

  const body = forgotPasswordSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  if (!env.resendApiKey) {
    return ok({
      message: "Email password reset is not configured yet. Contact an administrator for a temporary password.",
      resetEmailConfigured: false,
    });
  }

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
      subject: "Reset your password — Wisconsin Creative",
      html: buildResetEmail(user.name, resetUrl),
    });

    // Audit the issuance so reset abuse against a target account is traceable.
    // Consumption is logged separately in reset-password as password_reset_self.
    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "user",
      entityId: user.id,
      action: "password_reset_requested",
      after: { ip, userAgent: req.headers.get("user-agent") ?? null },
    });
  }

  return ok({ message: "If that email exists, we sent a reset link.", resetEmailConfigured: true });
});

function buildResetEmail(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="border-bottom: 3px solid #A00000; padding-bottom: 12px; margin-bottom: 20px;">
    <strong style="font-size: 18px;">Password Reset</strong>
  </div>
  <p style="font-size: 15px; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
  <p style="font-size: 15px; line-height: 1.5;">Click the link below to reset your password. This link expires in 1 hour.</p>
  <p><a href="${escapeHtml(resetUrl)}" style="display: inline-block; padding: 10px 24px; background: #A00000; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a></p>
  <p style="font-size: 13px; color: #6b7280;">If you didn&rsquo;t request this, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 11px; color: #9ca3af;">Wisconsin Creative &mdash; University of Wisconsin–Madison</p>
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
