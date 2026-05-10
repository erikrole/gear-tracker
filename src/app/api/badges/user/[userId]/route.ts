import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { badgesEnabled } from "@/lib/badges";
import { getUserBadgeProfile } from "@/lib/badges/queries";

export const GET = withAuth<{ userId: string }>(async (_req, { user, params }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  if (!badgesEnabled()) {
    return ok({
      data: {
        userId: params.userId,
        peerVisible: false,
        earnedCount: 0,
        totalCount: 0,
        badges: [],
        disabled: true,
      },
    });
  }

  const profile = await getUserBadgeProfile(user, params.userId);
  return ok({ data: profile });
});
