import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { listActiveBlastsForUser } from "@/lib/services/blasts";

/**
 * The unacknowledged blasts the iOS dashboard banner renders.
 *
 * Deliberately its own endpoint rather than a section of /api/dashboard: the home
 * view's 60-second freshness window would delay a blast, and the dashboard route
 * degrades failed sections into `partialFailures`, which is the wrong failure mode
 * for a message someone is being asked to acknowledge.
 *
 * No `requirePermission` -- every role can receive a blast, and the query is scoped
 * to the caller's own recipient rows, matching /api/notifications.
 */
export const GET = withAuth(async (_req, { user }) => {
  await enforceRateLimit(`me:blasts:${user.id}`, { max: 180, windowMs: 60_000 });

  const blasts = await listActiveBlastsForUser(user.id);

  // First fetch is the earliest moment the server can honestly claim the client has
  // the message. APNs offers no delivery receipt, so this is what "delivered" means
  // on the tracking page.
  const undelivered = blasts.map((b) => b.id);
  if (undelivered.length > 0) {
    await db.blastRecipient.updateMany({
      where: { userId: user.id, blastId: { in: undelivered }, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
  }

  return ok({ data: blasts });
});
