import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getOverdueReport } from "@/lib/services/reports";

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "report", "view");
  return ok(await getOverdueReport());
});
