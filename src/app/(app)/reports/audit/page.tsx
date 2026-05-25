"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFetch } from "@/hooks/use-fetch";
import { syncUrl } from "@/lib/url-sync";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FadeUp } from "@/components/ui/motion";
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
  downloadReportCsv,
  ReportEmptyState,
  ReportErrorState,
  ReportExportButton,
  ReportMetricGrid,
  ReportPaginationFooter,
  ReportSegmentedControl,
  ReportSectionCard,
  ReportToolbar,
  ReportToolbarGroup,
} from "../report-ui";

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

const VALID_PERIODS = [0, 7, 30, 90] as const;

function parsePageParam(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function parsePeriodParam(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return VALID_PERIODS.includes(parsed as (typeof VALID_PERIODS)[number]) ? parsed : 0;
}

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
  downloadReportCsv("audit-report", [
    ["Timestamp", "Actor", "Action", "Entity Type", "Entity ID"],
    ...entries.map((e) => [e.createdAt, e.actor, e.action, e.entityType, e.entityId]),
  ]);
}

export default function AuditReportPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [periodDays, setPeriodDays] = useState(() => parsePeriodParam(searchParams.get("period")));
  const [now, setNow] = useState(() => new Date());
  const limit = 25;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const nextPage = parsePageParam(searchParams.get("page"));
    const nextPeriod = parsePeriodParam(searchParams.get("period"));
    setPage((current) => (current === nextPage ? current : nextPage));
    setPeriodDays((current) => (current === nextPeriod ? current : nextPeriod));

    const corrections: Record<string, string | number> = {};
    if (searchParams.get("page") && nextPage === 0) {
      corrections.page = "";
    }
    if (searchParams.get("period") && nextPeriod === 0) {
      corrections.period = "";
    }
    if (Object.keys(corrections).length > 0) {
      syncUrl(corrections);
    }
  }, [searchParams]);

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
  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  useEffect(() => {
    if (!data || page === 0) return;
    const lastPage = Math.max(0, totalPages - 1);
    if (page > lastPage) {
      setPage(lastPage);
      syncUrl({ page: lastPage > 0 ? lastPage + 1 : "" });
    }
  }, [data, page, totalPages]);

  if (loading && !data) {
    return (
      <Card className="p-0">
        <TimelineSkeleton />
      </Card>
    );
  }

  if (error && !data) {
    return (
      <ReportErrorState
        error={error}
        onRetry={loadData}
        title="Failed to load audit report"
      />
    );
  }

  if (!data) return null;

  const entries = data.data ?? [];
  const activeFilters = periodDays > 0
    ? [{
        key: "period",
        label: `Period: ${periodDays}d`,
        onRemove: () => {
          setPeriodDays(0);
          setPage(0);
          syncUrl({ period: "", page: "" });
        },
      }]
    : [];

  return (
    <FadeUp>
      {/* Retention notice */}
      <p className="text-xs text-muted-foreground mb-2">
        Audit logs are retained for {AUDIT_RETENTION_DAYS} days. Older entries are automatically archived weekly.
      </p>

      {/* Filters */}
      <ReportToolbar
        activeFilters={activeFilters}
        lastRefreshed={lastRefreshed}
        loading={loading}
        now={now}
        onRefresh={loadData}
        exportAction={entries.length > 0 ? (
          <ReportExportButton onClick={() => downloadCsv(entries)} />
        ) : null}
      >
        <ReportToolbarGroup label="Period">
          <ReportSegmentedControl
            ariaLabel="Audit report period"
            value={periodDays}
            options={[
              { value: 0, label: "All" },
              { value: 7, label: "7d" },
              { value: 30, label: "30d" },
              { value: 90, label: "90d" },
            ]}
            onChange={(nextPeriod) => {
              setPeriodDays(nextPeriod);
              setPage(0);
              syncUrl({ period: nextPeriod, page: "" });
            }}
          />
        </ReportToolbarGroup>
      </ReportToolbar>

      <ReportMetricGrid>
        <MetricCard value={data.total} label="Total events" tooltip="Total audit entries in the selected period" />
      </ReportMetricGrid>

      {(data.byAction?.length > 0 || data.byEntityType?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {data.byAction?.length > 0 && <LazyActionBreakdownChart byAction={data.byAction} />}
          {data.byEntityType?.length > 0 && <LazyEntityTypeBreakdownChart byEntityType={data.byEntityType} />}
        </div>
      )}

      <ReportSectionCard title="Audit trail" description={`${data.total} entries`} contentClassName="p-0">

        {entries.length === 0 ? (
          <ReportEmptyState
            icon="clipboard"
            title="No audit log entries"
            description="Try a wider period to inspect older retained activity."
          />
        ) : (
          <>
            <ActivityTimeline
              entries={timelineEntries}
              context="report"
              loading={loading}
            />

            {totalPages > 1 && (
              <>
                <Separator />
                <ReportPaginationFooter
                  page={page}
                  totalPages={totalPages}
                  onPrevious={() => {
                    setPage(page - 1);
                    syncUrl({ page: page === 1 ? "" : page });
                  }}
                  onNext={() => {
                    setPage(page + 1);
                    syncUrl({ page: page + 2 });
                  }}
                />
              </>
            )}
          </>
        )}
      </ReportSectionCard>
    </FadeUp>
  );
}
