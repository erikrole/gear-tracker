import { env } from "@/lib/env";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send a transactional email via Resend.
 * Falls back to console.log when RESEND_API_KEY is not set (dev mode).
 * Failures are non-fatal — logged but never thrown.
 */
export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  if (!env.resendApiKey) {
    console.log(`[EMAIL-DEV] To: ${to} | Subject: ${subject}`);
    return true;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.resendApiKey);

    const { error } = await resend.emails.send({
      from: env.emailFrom,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[EMAIL] Resend error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err);
    return false;
  }
}

/**
 * Build notification email HTML. Minimal inline-styled template.
 */
export function buildNotificationEmail({
  title,
  body,
  bookingTitle,
  dueAt,
}: {
  title: string;
  body: string;
  bookingTitle?: string;
  dueAt?: string;
}): string {
  const dueStr = dueAt
    ? new Date(dueAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="border-bottom: 3px solid #c5050c; padding-bottom: 12px; margin-bottom: 20px;">
    <strong style="font-size: 18px;">${escapeHtml(title)}</strong>
  </div>
  <p style="font-size: 15px; line-height: 1.5; color: #333;">${escapeHtml(body)}</p>
  ${bookingTitle ? `<p style="font-size: 13px; color: #6b7280;">Booking: <strong>${escapeHtml(bookingTitle)}</strong></p>` : ""}
  ${dueStr ? `<p style="font-size: 13px; color: #6b7280;">Due: ${escapeHtml(dueStr)}</p>` : ""}
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 11px; color: #9ca3af;">Gear Tracker — Wisconsin Athletics</p>
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
