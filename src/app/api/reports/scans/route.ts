import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { csvField } from "@/lib/csv";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getScanHistoryReport, getScanHistoryReportExport } from "@/lib/services/reports";

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

function buildScanReportCsv(rows: Awaited<ReturnType<typeof getScanHistoryReportExport>>["data"]) {
  const headers = ["Timestamp", "Actor", "Item", "Phase", "Booking", "Result"];
  const csvRows = rows.map((scan) => [
    csvField(scan.createdAt),
    csvField(scan.actor),
    csvField(scan.item),
    csvField(scan.phase),
    csvField(scan.bookingTitle),
    csvField(scan.success ? "ok" : "fail"),
  ]);

  return [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
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

  if (searchParams.get("format") === "csv") {
    const exportData = await getScanHistoryReportExport(startDate, endDate, phase);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`${buildScanReportCsv(exportData.data)}\n`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scan-report-${date}.csv"`,
        "X-Exported-Count": String(exportData.data.length),
        "X-Total-Count": String(exportData.total),
        ...(exportData.truncated ? {
          "X-Truncated": "true",
        } : {}),
      },
    });
  }

  return ok(await getScanHistoryReport(limit, offset, startDate, endDate, phase));
});
