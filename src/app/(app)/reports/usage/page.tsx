"use client";

import { useState } from "react";
import MetricCard from "../MetricCard";
import { useFetch } from "@/hooks/use-fetch";
import {
  ReportDataRegion,
  ReportErrorState,
  ReportLoadingState,
  ReportMetricGrid,
  ReportSectionCard,
  ReportSegmentedControl,
  ReportToolbar,
  ReportToolbarGroup,
} from "../report-ui";

type CountRow = { name: string; count: number };
type UsageReport = {
  days: number;
  totalEvents: number;
  activeUsers: number;
  platforms: CountRow[];
  surfaces: CountRow[];
  events: CountRow[];
  versions: Array<{ platform: string; version: string; count: number }>;
};

function CountList({ rows }: { rows: CountRow[] }) {
  return rows.length === 0 ? <p className="text-sm text-muted-foreground">No counted activity in this period.</p> : (
    <div className="divide-y">
      {rows.map((row) => (
        <div key={row.name} className="flex items-center justify-between gap-4 py-3 text-sm">
          <span className="capitalize">{row.name.replaceAll("_", " ")}</span>
          <span className="tabular-nums text-muted-foreground">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function UsageReportPage() {
  const [days, setDays] = useState(30);
  const [now] = useState(() => new Date());
  const { data, loading, refreshing, error, lastRefreshed, reload } = useFetch<UsageReport>({
    url: `/api/reports/usage?days=${days}`,
    keepPreviousData: true,
  });

  if (loading && !data) return <ReportLoadingState metricCount={2} rows={6} />;
  if (error && !data) return <ReportErrorState title="Failed to load private usage counts" error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <ReportToolbar lastRefreshed={lastRefreshed} loading={loading || refreshing} now={now} onRefresh={reload}>
        <ReportToolbarGroup label="Period">
          <ReportSegmentedControl ariaLabel="Usage report period" value={days} options={[7, 30, 90].map((value) => ({ value, label: `${value}d` }))} onChange={setDays} />
        </ReportToolbarGroup>
      </ReportToolbar>
      <ReportDataRegion refreshing={refreshing}>
        <ReportMetricGrid>
          <MetricCard label="Counted events" value={data.totalEvents} />
          <MetricCard label="Active people" value={data.activeUsers} helper="Pseudonymous yearly identifiers" />
        </ReportMetricGrid>
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportSectionCard title="Platforms" description="Web, iOS, and kiosk activity."><CountList rows={data.platforms} /></ReportSectionCard>
          <ReportSectionCard title="Surfaces" description="Normalized areas only. URLs and record IDs are never stored."><CountList rows={data.surfaces} /></ReportSectionCard>
          <ReportSectionCard title="Events" description="Allowlisted product events only."><CountList rows={data.events} /></ReportSectionCard>
          <ReportSectionCard title="App versions" description="Version adoption by platform.">
            <CountList rows={data.versions.map((row) => ({ name: `${row.platform} ${row.version}`, count: row.count }))} />
          </ReportSectionCard>
        </div>
      </ReportDataRegion>
    </div>
  );
}
