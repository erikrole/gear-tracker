import { withAuth } from "@/lib/api";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getScanHistoryReport } from "@/lib/services/reports";

const SCAN_PHASES = new Set(["CHECKOUT", "CHECKIN"]);

function parseOptionalDate(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return value;
}

function parseOptionalPhase(searchParams: URLSearchParams) {
  const phase = searchParams.get("phase");
  if (!phase) return null;
  if (!SCAN_PHASES.has(phase)) {
    throw new HttpError(400, "Invalid phase");
  }
  return phase;
}

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);
  const startDate = parseOptionalDate(searchParams, "startDate");
  const endDate = parseOptionalDate(searchParams, "endDate");
  const phase = parseOptionalPhase(searchParams);

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new HttpError(400, "startDate must be before endDate");
  }

  return ok(await getScanHistoryReport(limit, offset, startDate, endDate, phase));
});
