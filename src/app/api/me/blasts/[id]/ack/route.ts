import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * "Got it." Clears the banner and is the number the tracking page reports on.
 *
 * Idempotent, because an offline client queues this and replays it on reconnect.
 *
 * Acknowledging also stamps `readAt` if it is still null: someone can tap through
 * from a push notification without the banner ever rendering, and that person must
 * not show as unread. The reverse does not hold -- marking the inbox notification
 * read does not acknowledge the blast, because dismissing a list row is not "Got it".
 */
export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  await enforceRateLimit(`me:blast-ack:${user.id}`, { max: 60, windowMs: 60_000 });

  const recipient = await db.blastRecipient.findUnique({
    where: { blastId_userId: { blastId: params.id, userId: user.id } },
    select: { id: true, notificationId: true, acknowledgedAt: true, readAt: true },
  });
  if (!recipient) throw new HttpError(404, "Blast not found");

  const now = new Date();
  if (!recipient.acknowledgedAt) {
    await db.blastRecipient.update({
      where: { id: recipient.id },
      data: { acknowledgedAt: now, ...(recipient.readAt ? {} : { readAt: now }) },
    });
  }

  // Keep the unread badge honest: an acknowledged blast should not still count.
  if (recipient.notificationId) {
    await db.notification.updateMany({
      where: { id: recipient.notificationId, userId: user.id, readAt: null },
      data: { readAt: now },
    });
  }

  return ok({ success: true });
});
