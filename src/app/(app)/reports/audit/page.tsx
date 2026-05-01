"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatRelativeTime } from "@/lib/format";
import { useFetch } from "@/hooks/use-fetch";
import { syncUrl } from "@/lib/url-sync";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { FadeUp } from "@/components/ui/motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import MetricCard from "../MetricCard";
import ActivityTimeline, { TimelineSkeleton, type AuditEntry as TimelineEntry } from "@/components/ActivityTimeline";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit";

const LazyActionBreakdownChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.ActionBreakdownChart })),
  { ssr: false }
);
const LazyEntityTypeBreakdownChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.EntityTypeBreakdownChart })),
  { ssr: false }
);
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AuditEntry = {
  id: string;
  actor: string;
  actorId?: string | null;
  actorAvatarUrl?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
};

type AuditData = {
  data: AuditEntry[];
  total: number;
  byAction: { action: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
  limit: number;
  offset: number;
};

/** Convert the report API shape to the shared AuditEntry shape */
function toTimelineEntries(entries: AuditEntry[]): TimelineEntry[] {
  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    createdAt: e.createdAt,
    beforeJson: e.beforeJson ?? null,
    afterJson: e.afterJson ?? null,
    actor: {
      id: e.actorId ?? undefined,
      name: e.actor,
      avatarUrl: e.actorAvatarUrl ?? null,
    },
  }));
}

function downloadCsv(entries: AuditEntry[]) {
  const header = "Timestamp,Actor,Action,Entity Type,Entity ID\n";
  const rows = entries.map((e) =>
    `"${e.createdAt}","${e.actor}","${e.action}","${e.entityType}","${e.entityId}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditReportPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(() => {
    const p = searchParams.get("page");
    return p ? Math.max(0, Number(p) - 1) : 0;
  });
  const [periodDays, setPeriodDays] = useState(() => {
    const p = searchParams.get("period");
    return p && [7, 30, 90].includes(Number(p)) ? Number(p) : 0;
  });
  const [now, setNow] = useState(() => new Date());
  const limit = 25;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    return `/api/reports/audit?${params}`;
  }, [page, periodDays]);

  const { data, loading, error, lastRefreshed, reload: loadData } = useFetch<AuditData>({
    url: fetchUrl,
    transform: (json) => json as unknown as AuditData,
  });

  const timelineEntries = useMemo(
    () => (data?.data ? toTimelineEntries(data.data) : []),
    [data?.data],
  );

  if (loading && !data) {
    return (
      <Card className="p-0">
        <TimelineSkeleton />
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load audit report</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>{error === "network" ? "Check your connection and try again." : "Unable to load audit report. Please try again."}</span>
          <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const totalPages = Math.ceil(data.total / limit);
  const entries = data.data ?? [];

  return (
    <FadeUp>
      {/* Retention notice */}
      <p className="text-xs text-muted-foreground mb-2">
        Audit logs are retained for {AUDIT_RETENTION_DAYS} days. Older entries are automatically archived weekly.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="text-sm text-muted-foreground">Period:</span>
        {[{ d: 0, label: "All" }, { d: 7, label: "7d" }, { d: 30, label: "30d" }, { d: 90, label: "90d" }].map(({ d, label }) => (
          <Button
            key={d}
            variant={periodDays === d ? "default" : "outline"} size="sm"
            onClick={() => { setPeriodDays(d); setPage(0); syncUrl({ period: d, page: "" }); }}
          >
            {label}
          </Button>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={loadData}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), now)}` : "Refresh"}
          </TooltipContent>
        </Tooltip>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(entries)} className="ml-auto">
            Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
        <MetricCard value={data.total} label="Total events" tooltip="Total audit entries in the selected period" />
      </div>

      {(data.byAction?.length > 0 || data.byEntityType?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-1">
          {data.byAction?.length > 0 && <LazyActionBreakdownChart byAction={data.byAction} />}
          {data.byEntityType?.length > 0 && <LazyEntityTypeBreakdownChart byEntityType={data.byEntityType} />}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
          <span className="text-sm text-muted-foreground">{data.total} entries</span>
        </CardHeader>

        {entries.length === 0 ? (
          <EmptyState icon="clipboard" title="No audit log entries" />
        ) : (
          <>
            <CardContent className="p-0">
              <ActivityTimeline
                entries={timelineEntries}
                context="report"
                loading={loading}
              />
            </CardContent>

            {totalPages > 1 && (
              <>
                <Separator />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => { setPage(page - 1); syncUrl({ page: page === 1 ? "" : page }); }}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => { setPage(page + 1); syncUrl({ page: page + 2 }); }}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </FadeUp>
  );
}
