import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { csvField } from "@/lib/csv";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { enforceRateLimit, REPORT_EXPORT_LIMIT } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import { getAuditReport, getAuditReportExport } from "@/lib/services/reports";

function parseOptionalDate(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return value;
}

function buildAuditReportCsv(rows: Awaited<ReturnType<typeof getAuditReportExport>>["data"]) {
  const headers = ["Timestamp", "Actor", "Action", "Entity Type", "Entity ID"];
  const csvRows = rows.map((entry) => [
    csvField(entry.createdAt),
    csvField(entry.actor),
    csvField(entry.action),
    csvField(entry.entityType),
    csvField(entry.entityId),
  ]);

  return [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
}

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "audit");
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);
  const startDate = parseOptionalDate(searchParams, "startDate");
  const endDate = parseOptionalDate(searchParams, "endDate");
  const action = searchParams.get("action");

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new HttpError(400, "startDate must be before endDate");
  }

  if (searchParams.get("format") === "csv") {
    await enforceRateLimit(`report:export:${user.id}`, REPORT_EXPORT_LIMIT);
    const exportData = await getAuditReportExport(startDate, endDate, action);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`${buildAuditReportCsv(exportData.data)}\n`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-report-${date}.csv"`,
        "X-Exported-Count": String(exportData.data.length),
        "X-Total-Count": String(exportData.total),
        ...(exportData.truncated ? {
          "X-Truncated": "true",
        } : {}),
      },
    });
  }

  return ok(await getAuditReport(limit, offset, startDate, endDate, action));
});
