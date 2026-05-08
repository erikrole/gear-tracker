import { withAuth } from "@/lib/api";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getScanHistoryReport } from "@/lib/services/reports";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const phase = searchParams.get("phase");
  return ok(await getScanHistoryReport(limit, offset, startDate, endDate, phase));
});
