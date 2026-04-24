import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getActiveClaimForUser } from "@/lib/services/licenses";

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "license", "view");
  const claim = await getActiveClaimForUser(user.id);
  return ok({ data: claim });
});
