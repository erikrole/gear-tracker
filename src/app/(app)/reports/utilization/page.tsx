"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import MetricCard from "../MetricCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { statusBadgeVariantEquipment, statusLabelEquipment } from "@/lib/status-colors";
import {
  ReportChartLoading,
  ReportErrorState,
  ReportExportButton,
  ReportListRow,
  ReportLoadingState,
  ReportMetricGrid,
  ReportSectionCard,
  ReportToolbar,
} from "../report-ui";
import { handleAuthRedirect, isAbortError } from "@/lib/errors";
import {
  getReportExportCompletionToast,
  getReportExportFilename,
  readReportExportFailureMessage,
} from "../report-export";

const LazyStatusDonut = dynamic(
  () => import("./charts").then((m) => ({ default: m.StatusDonut })),
  { ssr: false, loading: () => <ReportChartLoading heightClassName="h-[300px]" variant="donut" /> }
);
const LazyTopBreakdownChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.TopBreakdownChart })),
  { ssr: false, loading: () => <ReportChartLoading /> }
);

type UtilizationData = {
  totalAssets: number;
  statusCounts: Record<string, number>;
  byLocation: { location: string; count: number }[];
  byType: { type: string; count: number }[];
  byDepartment: { department: string; count: number }[];
};

function BreakdownCard({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows: { label: string; count: number }[];
  labelKey: string;
}) {
  if (rows.length === 0) return null;

  return (
    <ReportSectionCard title={title} contentClassName="p-0">

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labelKey}</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {rows.map((r) => (
          <ReportListRow key={r.label}>
            <span>{r.label}</span>
            <span className="text-muted-foreground tabular-nums">{r.count}</span>
          </ReportListRow>
        ))}
      </div>
    </ReportSectionCard>
  );
}

async function downloadUtilizationCsv() {
  try {
    const res = await fetch("/api/reports/utilization?format=csv");
    if (handleAuthRedirect(res, "/reports/utilization")) return;

    if (!res.ok) {
      toast.error(await readReportExportFailureMessage(res, "Utilization report"));
      return;
    }

    const blob = await res.blob();
    const filename = getReportExportFilename(
      res.headers.get("Content-Disposition"),
      "utilization-report.csv",
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const exportedCount = Number.parseInt(res.headers.get("X-Exported-Count") ?? "", 10);
    const completionToast = getReportExportCompletionToast({
      reportLabel: "Utilization report",
      rowCount: Number.isFinite(exportedCount) ? exportedCount : 0,
      scopeLabel: "inventory rows",
      total: res.headers.get("X-Total-Count"),
      truncated: res.headers.get("X-Truncated") === "true",
    });

    if (completionToast.variant === "warning") {
      toast.warning(completionToast.message);
    } else {
      toast.success(completionToast.message);
    }
  } catch (err) {
    if (isAbortError(err)) return;
    toast.error("Utilization report CSV export failed. Check your connection and try again.");
  }
}

export default function UtilizationPage() {
  const [now, setNow] = useState(() => new Date());

  // Update "ago" display every 60s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, loading, error, lastRefreshed, reload } = useFetch<UtilizationData>({
    url: "/api/reports/utilization",
  });

  if (loading && !data) {
    return <ReportLoadingState metricCount={5} rows={5} />;
  }

  if (error && !data) {
    return (
      <ReportErrorState
        error={error}
        onRetry={reload}
        title="Failed to load utilization report"
      />
    );
  }

  if (!data) return null;

  return (
    <FadeUp>
      <ReportToolbar
        lastRefreshed={lastRefreshed}
        loading={loading}
        now={now}
        onRefresh={reload}
        exportAction={(
          <ReportExportButton
            ariaLabel="Export utilization inventory rows CSV"
            label="Export inventory rows"
            onClick={downloadUtilizationCsv}
          />
        )}
      />
      <ReportMetricGrid>
        {Object.entries(data.statusCounts).map(([status, count]) => {
          const label = statusLabelEquipment(status);
          return (
            <MetricCard
              key={status}
              value={count}
              label={label}
              badge={{ text: label, variant: statusBadgeVariantEquipment(status) }}
              href={`/items?status=${status}`}
            />
          );
        })}
        <MetricCard value={data.totalAssets} label="Total assets" tooltip="Total number of assets in the system" href="/items" />
      </ReportMetricGrid>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <LazyStatusDonut statusCounts={data.statusCounts} />
        <LazyTopBreakdownChart
          title="By location"
          labelKey="Assets"
          data={(data.byLocation ?? []).map((r) => ({ label: r.location, count: r.count }))}
        />
        <LazyTopBreakdownChart
          title="By type"
          labelKey="Assets"
          data={(data.byType ?? []).map((r) => ({ label: r.type, count: r.count }))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownCard
          title="By location"
          labelKey="Location"
          rows={(data.byLocation ?? []).map((r) => ({ label: r.location, count: r.count }))}
        />
        <BreakdownCard
          title="By type"
          labelKey="Type"
          rows={(data.byType ?? []).map((r) => ({ label: r.type, count: r.count }))}
        />
        {(data.byDepartment ?? []).length > 0 && (
          <div className="md:col-span-2">
            <BreakdownCard
              title="By department"
              labelKey="Department"
              rows={data.byDepartment.map((r) => ({ label: r.department, count: r.count }))}
            />
          </div>
        )}
      </div>

    </FadeUp>
  );
}
