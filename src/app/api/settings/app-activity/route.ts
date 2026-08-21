import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { getAppActivityReport } from "@/lib/services/app-activity-report";
import { canViewUsageAnalytics } from "@/lib/usage-analytics";

export const GET = withAuth(async (_req, { user }) => {
  if (!canViewUsageAnalytics(user)) throw new HttpError(403, "Forbidden");
  return ok(await getAppActivityReport());
});
