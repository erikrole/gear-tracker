import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const GET = withAuth(async (_req, { user }) => {
  const unreadCount = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return ok({ unreadCount });
});
