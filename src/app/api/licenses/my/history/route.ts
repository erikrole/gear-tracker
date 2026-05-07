import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getClaimHistoryForUser } from "@/lib/services/licenses";

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "license", "view");
  const history = await getClaimHistoryForUser(user.id);
  return ok({ data: history });
});
