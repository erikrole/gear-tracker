import { withAuth } from "@/lib/api";
import { badges } from "@/lib/badges";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

/**
 * Records a signed-in app foreground event for server-authoritative easter
 * eggs. No client clock or timezone is accepted.
 */
export const POST = withAuth(async (_req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);

  await badges.onAppOpened({
    userId: user.id,
    occurredAt: new Date(),
  });

  return ok({ data: { accepted: true } });
});
