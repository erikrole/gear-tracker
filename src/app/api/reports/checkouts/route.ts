import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getCheckoutReport } from "@/lib/services/reports";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  return ok(await getCheckoutReport(days));
});
