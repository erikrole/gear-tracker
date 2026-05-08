import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { cachedOk } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = withAuth(async (_req, { user }) => {
  await enforceRateLimit(`notifications:count:${user.id}`, { max: 180, windowMs: 60_000 });
  const unreadCount = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return cachedOk({ unreadCount });
});
