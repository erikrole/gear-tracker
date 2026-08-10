import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getBadgeReport, parseBadgeReportPeriod } from "@/lib/services/reports";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  return ok(await getBadgeReport(parseBadgeReportPeriod(searchParams.get("days"))));
});
