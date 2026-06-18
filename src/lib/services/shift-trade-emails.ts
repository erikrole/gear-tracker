import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { normalizePrefs, shouldDeliverCategory, shouldDeliverEmail } from "@/lib/services/notification-prefs";

export type ShiftTradeEmail = {
  userId: string;
  title: string;
  body: string;
  eventSummary: string;
  area: string;
};

export async function sendShiftTradeEmail({
  userId,
  title,
  body,
  eventSummary,
  area,
}: ShiftTradeEmail): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPrefs: true },
  });

  if (!user?.email) return false;
  const prefs = normalizePrefs(user.notificationPrefs);
  if (!shouldDeliverEmail(prefs)) return false;
  if (!shouldDeliverCategory(prefs, "trade")) return false;

  return sendEmail({
    to: user.email,
    subject: title,
    html: buildShiftTradeEmail({ title, body, eventSummary, area }),
  });
}

function buildShiftTradeEmail({
  title,
  body,
  eventSummary,
  area,
}: {
  title: string;
  body: string;
  eventSummary: string;
  area: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="border-bottom: 3px solid #A00000; padding-bottom: 12px; margin-bottom: 20px;">
    <strong style="font-size: 18px;">${escapeHtml(title)}</strong>
  </div>
  <p style="font-size: 15px; line-height: 1.5; color: #333;">${escapeHtml(body)}</p>
  <p style="font-size: 13px; color: #6b7280;">Event: <strong>${escapeHtml(eventSummary)}</strong></p>
  <p style="font-size: 13px; color: #6b7280;">Area: ${escapeHtml(area)}</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 11px; color: #9ca3af;">Wisconsin Creative - University of Wisconsin-Madison</p>
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
