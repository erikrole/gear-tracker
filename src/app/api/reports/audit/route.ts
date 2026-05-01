import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getAuditReport } from "@/lib/services/reports";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const action = searchParams.get("action");
  return ok(await getAuditReport(limit, offset, startDate, endDate, action));
});
