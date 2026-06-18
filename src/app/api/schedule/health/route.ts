import { withAuth } from "@/lib/api";
import { assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getScheduleHealth } from "@/lib/services/schedule-health";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift", "view");

  const { searchParams } = new URL(req.url);
  const parsedStartDate = parseOptionalDate(searchParams.get("startDate"), "startDate");
  const parsedEndDate = parseOptionalDate(searchParams.get("endDate"), "endDate");
  assertDateOrder(parsedStartDate, parsedEndDate);

  const data = await getScheduleHealth({
    userId: user.id,
    parsedStartDate,
    parsedEndDate,
    includePast: searchParams.get("includePast") === "true",
    includeArchived: searchParams.get("includeArchived") === "true",
    sportCode: searchParams.get("sportCode"),
  });

  return ok({ data });
});
