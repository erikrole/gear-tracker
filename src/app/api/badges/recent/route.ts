import { badgesEnabled } from "@/lib/badges";
import { listEarnedBadgesSince } from "@/lib/badges/queries";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export const GET = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  const through = new Date();
  const nextCursor = through.toISOString();
  if (!badgesEnabled()) {
    return ok({ data: { awards: [], nextCursor }, disabled: true });
  }

  const afterValue = new URL(req.url).searchParams.get("after");
  if (!afterValue) {
    // Establish a server-time cursor without replaying the user's history.
    return ok({ data: { awards: [], nextCursor } });
  }

  const after = new Date(afterValue);
  if (Number.isNaN(after.getTime()) || after > through) {
    throw new HttpError(400, "after must be a valid prior ISO timestamp");
  }

  const awards = await listEarnedBadgesSince({
    userId: user.id,
    after,
    through,
  });

  return ok({ data: { awards, nextCursor } });
});
