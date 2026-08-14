import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { canViewUsageAnalytics } from "@/lib/usage-analytics";
import { getUsageAnalyticsReport, parseUsageAnalyticsPeriod } from "@/lib/services/usage-analytics-report";

export const GET = withAuth(async (req, { user }) => {
  if (!canViewUsageAnalytics(user)) throw new HttpError(403, "Forbidden");
  const { searchParams } = new URL(req.url);
  return ok(await getUsageAnalyticsReport(parseUsageAnalyticsPeriod(searchParams.get("days"))));
});
