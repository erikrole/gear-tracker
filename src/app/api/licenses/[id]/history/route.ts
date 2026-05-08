import { withAuth } from "@/lib/api";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getClaimHistory } from "@/lib/services/licenses";

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "manage");
  const { searchParams } = new URL(req.url);
  const { limit } = parsePagination(searchParams);
  const history = await getClaimHistory(params.id, Math.min(limit, 100));
  return ok({ data: history, limit: Math.min(limit, 100) });
});
