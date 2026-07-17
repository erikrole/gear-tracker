import { db } from "@/lib/db";
import { tokenHash, randomHex } from "@/lib/auth";
import { EMAIL_THEME, buildEmailDocument, escapeEmailHtml, sendEmail } from "@/lib/email";
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
  return buildEmailDocument({
    title: "Password Reset",
    content: `
  <p style="font-size: 15px; line-height: 1.5; color: ${EMAIL_THEME.body};">Hi ${escapeEmailHtml(name)},</p>
  <p style="font-size: 15px; line-height: 1.5;">Click the link below to reset your password. This link expires in 1 hour.</p>
  <p><a href="${escapeEmailHtml(resetUrl)}" style="display: inline-block; padding: 10px 24px; background: ${EMAIL_THEME.brand}; color: ${EMAIL_THEME.onBrand}; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a></p>
  <p style="font-size: 13px; color: ${EMAIL_THEME.muted};">If you didn&rsquo;t request this, you can safely ignore this email.</p>`.trim(),
  });
}
