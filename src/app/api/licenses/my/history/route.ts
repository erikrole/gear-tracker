import { withAuth } from "@/lib/api";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getClaimHistoryForUser } from "@/lib/services/licenses";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "license", "view");
  const { searchParams } = new URL(req.url);
  const { limit } = parsePagination(searchParams);
  const boundedLimit = Math.min(limit, 100);
  const history = await getClaimHistoryForUser(user.id, boundedLimit);
  return ok({ data: history, limit: boundedLimit });
});
