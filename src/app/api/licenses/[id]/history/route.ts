import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getClaimHistory } from "@/lib/services/licenses";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "license", "manage");
  const history = await getClaimHistory(params.id);
  return ok({ data: history });
});
