import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { csvField } from "@/lib/csv";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getOverdueReport, getOverdueReportExport } from "@/lib/services/reports";

function buildOverdueReportCsv(rows: Awaited<ReturnType<typeof getOverdueReportExport>>["data"]) {
  const headers = ["Requester", "Booking", "Due", "Overdue Hours", "Location", "Outstanding Items", "Item Summary"];
  const csvRows = rows.map((booking) => [
    csvField(booking.requester),
    csvField(booking.title),
    csvField(booking.endsAt),
    csvField(booking.overdueHours),
    csvField(booking.location),
    csvField(booking.itemCount),
    csvField(booking.itemSummary),
  ]);

  return [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
}

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);

  if (searchParams.get("format") === "csv") {
    const exportData = await getOverdueReportExport();
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`${buildOverdueReportCsv(exportData.data)}\n`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="overdue-report-${date}.csv"`,
        "X-Exported-Count": String(exportData.data.length),
        "X-Total-Count": String(exportData.total),
        ...(exportData.truncated ? {
          "X-Truncated": "true",
        } : {}),
      },
    });
  }

  return ok(await getOverdueReport());
});
