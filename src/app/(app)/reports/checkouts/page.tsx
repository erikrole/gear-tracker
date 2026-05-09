"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { formatDateFull } from "@/lib/format";
import MetricCard from "../MetricCard";
import { Badge } from "@/components/ui/badge";
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
import { syncUrl } from "@/lib/url-sync";
import {
  ReportChartLoading,
  downloadReportCsv,
  ReportEmptyState,
  ReportErrorState,
  ReportExportButton,
  ReportListRow,
  ReportLoadingState,
  ReportMetaLine,
  ReportMetricGrid,
  ReportMobileCardLink,
  ReportSegmentedControl,
  ReportSectionCard,
  ReportTableLink,
  ReportToolbar,
  ReportToolbarGroup,
} from "../report-ui";

const LazyCheckoutTrendChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.CheckoutTrendChart })),
  { ssr: false, loading: () => <ReportChartLoading /> }
);
const LazyTopRequestersChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.TopRequestersChart })),
  { ssr: false, loading: () => <ReportChartLoading /> }
);
const LazyHeatmap = dynamic(
  () => import("@/components/ui/heatmap"),
  { ssr: false }
);

type CheckoutRow = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  requester: string;
  location: string;
  itemCount: number;
  isOverdue: boolean;
};

type CheckoutData = {
  days: number;
  totalCheckouts: number;
  overdueCheckouts: number;
  dailyTrend?: { date: string; count: number }[];
  heatmap?: { date: string; value: number }[];
  recentCheckouts: CheckoutRow[];
  topRequesters: { name: string; count: number }[];
};

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const variant = isOverdue ? "red" : status === "OPEN" ? "green" : "gray";
  return <Badge variant={variant}>{isOverdue ? "overdue" : status.toLowerCase()}</Badge>;
}

function CheckoutMobileCard({ c }: { c: CheckoutRow }) {
  return (
    <ReportMobileCardLink href={`/checkouts/${c.id}`}>
      <div className="flex items-center justify-between">
        <span className="text-foreground font-medium">{c.title}</span>
        <StatusBadge status={c.status} isOverdue={c.isOverdue} />
      </div>
      <ReportMetaLine
        className="text-sm"
        items={[
          c.requester,
          `${c.itemCount} item${c.itemCount !== 1 ? "s" : ""}`,
          `Due ${formatDateFull(c.endsAt)}`,
        ]}
      />
    </ReportMobileCardLink>
  );
}

function downloadCsv(rows: CheckoutRow[]) {
  downloadReportCsv("checkouts-report", [
    ["Title", "Requester", "Status", "Due", "Items", "Overdue"],
    ...rows.map((c) => [c.title, c.requester, c.status, c.endsAt, c.itemCount, c.isOverdue]),
  ]);
}

export default function CheckoutsReportPage() {
  const searchParams = useSearchParams();
  const [days, setDays] = useState(() => {
    const p = searchParams.get("days");
    return p && [7, 30, 90].includes(Number(p)) ? Number(p) : 30;
  });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, loading, error, lastRefreshed, reload } = useFetch<CheckoutData>({
    url: `/api/reports/checkouts?days=${days}`,
  });

  if (loading && !data) return <ReportLoadingState metricCount={2} rows={6} />;

  if (error && !data) {
    return (
      <ReportErrorState
        error={error}
        onRetry={reload}
        title="Failed to load checkout report"
      />
    );
  }

  if (!data) return null;

  return (
    <FadeUp>
      {/* Period selector */}
      <ReportToolbar
        lastRefreshed={lastRefreshed}
        loading={loading}
        now={now}
        onRefresh={reload}
        exportAction={(data.recentCheckouts ?? []).length > 0 ? (
          <ReportExportButton onClick={() => downloadCsv(data.recentCheckouts)} />
        ) : null}
      >
        <ReportToolbarGroup label="Period">
          <ReportSegmentedControl
            ariaLabel="Checkout report period"
            value={days}
            options={[
              { value: 7, label: "7d" },
              { value: 30, label: "30d" },
              { value: 90, label: "90d" },
            ]}
            onChange={(nextDays) => {
              setDays(nextDays);
              syncUrl({ days: nextDays });
            }}
          />
        </ReportToolbarGroup>
      </ReportToolbar>

      {/* Summary metrics */}
      <ReportMetricGrid>
        <MetricCard value={data.totalCheckouts} label={`Checkouts (${days}d)`} tooltip="Checkouts created in the selected period" href="/bookings?tab=checkouts" />
        <MetricCard
          value={data.overdueCheckouts}
          label="Currently overdue"
          color={data.overdueCheckouts > 0 ? "var(--red)" : undefined}
          tooltip="Checkouts currently past their return date"
          href="/checkouts?status=overdue"
        />
      </ReportMetricGrid>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {(data.dailyTrend ?? []).length > 1 && (
          <LazyCheckoutTrendChart dailyTrend={data.dailyTrend!} days={days} />
        )}
        {(data.topRequesters ?? []).length > 0 && (
          <LazyTopRequestersChart topRequesters={data.topRequesters} days={days} />
        )}
      </div>

      {/* Activity heatmap (365 days) */}
      {data.heatmap && data.heatmap.length > 0 && (
        <ReportSectionCard title="Checkout activity (past year)" contentClassName="overflow-x-auto">
            <LazyHeatmap
              data={data.heatmap}
              startDate={new Date(Date.now() - 365 * 86_400_000)}
              endDate={new Date()}
              colorMode="interpolate"
              cellSize={12}
              gap={2}
              valueDisplayFunction={(v) => `${v} checkout${v === 1 ? "" : "s"}`}
            />
        </ReportSectionCard>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent checkouts */}
        <ReportSectionCard title="Recent checkouts" contentClassName="p-0">
          {(data.recentCheckouts ?? []).length === 0 ? (
            <ReportEmptyState
              icon="clipboard"
              title="No checkouts in this period"
              description="Try a longer period or clear filters to inspect older checkout activity."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentCheckouts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <ReportTableLink href={`/checkouts/${c.id}`}>{c.title}</ReportTableLink>
                        </TableCell>
                        <TableCell>{c.requester}</TableCell>
                        <TableCell>{formatDateFull(c.endsAt)}</TableCell>
                        <TableCell className="tabular-nums">{c.itemCount}</TableCell>
                        <TableCell><StatusBadge status={c.status} isOverdue={c.isOverdue} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden">
                {data.recentCheckouts.map((c) => (
                  <CheckoutMobileCard key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
        </ReportSectionCard>

        {/* Top requesters */}
        <ReportSectionCard title="Top requesters" contentClassName="p-0">
          {(data.topRequesters ?? []).length === 0 ? (
            <ReportEmptyState
              icon="users"
              title="No requesters in this period"
              description="Requester rankings appear after checkout activity exists for the selected period."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Checkouts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topRequesters.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden">
                {data.topRequesters.map((r) => (
                  <ReportListRow key={r.name}>
                    <span>{r.name}</span>
                    <span className="text-muted-foreground tabular-nums">{r.count}</span>
                  </ReportListRow>
                ))}
              </div>
            </>
          )}
        </ReportSectionCard>
      </div>
    </FadeUp>
  );
}
