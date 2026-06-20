import { withAuth } from "@/lib/api";
import { assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { getScheduleAutomationDigest } from "@/lib/services/schedule-automation";
import { optionalSportCodeSchema } from "@/lib/validation";

export const GET = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const { searchParams } = new URL(req.url);
  const parsedStartDate = parseOptionalDate(searchParams.get("startDate"), "startDate");
  const parsedEndDate = parseOptionalDate(searchParams.get("endDate"), "endDate");
  assertDateOrder(parsedStartDate, parsedEndDate);

  const data = await getScheduleAutomationDigest({
    userId: user.id,
    parsedStartDate,
    parsedEndDate,
    includePast: searchParams.get("includePast") === "true",
    includeArchived: searchParams.get("includeArchived") === "true",
    sportCode: optionalSportCodeSchema.parse(searchParams.get("sportCode") ?? undefined) ?? null,
  });

  return ok({ data });
});
