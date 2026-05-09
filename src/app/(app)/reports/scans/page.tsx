"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import MetricCard from "../MetricCard";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import dynamic from "next/dynamic";

const LazyDailyScanVolumeChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.DailyScanVolumeChart })),
  { ssr: false }
);
import {
  downloadReportCsv,
  ReportEmptyState,
  ReportErrorState,
  ReportExportButton,
  ReportLoadingState,
  ReportMetricGrid,
  ReportMobileCard,
  ReportPaginationFooter,
  ReportSegmentedControl,
  ReportSectionCard,
  ReportTableLink,
  ReportToolbar,
  ReportToolbarGroup,
} from "../report-ui";

type ScanEntry = {
  id: string;
  actor: string;
  scanType: string;
  scanValue: string;
  success: boolean;
  phase: string;
  item: string;
  bookingId: string;
  bookingTitle: string;
  createdAt: string;
};

type ScanData = {
  data: ScanEntry[];
  total: number;
  successCount: number;
  successRate: number;
  dailyScans: { date: string; success: number; fail: number }[];
  limit: number;
  offset: number;
};

function ScanMobileCard({ s }: { s: ScanEntry }) {
  return (
    <ReportMobileCard>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={s.phase === "CHECKOUT" ? "blue" : "purple"}>
            {s.phase.toLowerCase()}
          </Badge>
          <Badge variant={s.success ? "green" : "red"}>
            {s.success ? "ok" : "fail"}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">{s.actor}</span> scanned <span className="font-mono">{s.item}</span>
      </div>
      <ReportTableLink href={`/checkouts/${s.bookingId}`} className="text-sm">
        {s.bookingTitle}
      </ReportTableLink>
    </ReportMobileCard>
  );
}

function downloadCsv(entries: ScanEntry[]) {
  downloadReportCsv("scan-report", [
    ["Timestamp", "Actor", "Item", "Phase", "Booking", "Result"],
    ...entries.map((s) => [
      s.createdAt,
      s.actor,
      s.item,
      s.phase,
      s.bookingTitle,
      s.success ? "ok" : "fail",
    ]),
  ]);
}

export default function ScanHistoryPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(() => {
    const p = searchParams.get("page");
    return p ? Math.max(0, Number(p) - 1) : 0;
  });
  const [phaseFilter, setPhaseFilter] = useState(() => searchParams.get("phase") ?? "");
  const [periodDays, setPeriodDays] = useState(() => {
    const p = searchParams.get("period");
    return p && [7, 30, 90].includes(Number(p)) ? Number(p) : 0;
  });
  const [now, setNow] = useState(() => new Date());
  const limit = 50;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (phaseFilter) params.set("phase", phaseFilter);
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    return `/api/reports/scans?${params}`;
  }, [page, phaseFilter, periodDays]);

  const { data, loading, error, lastRefreshed, reload } = useFetch<ScanData>({
    url: fetchUrl,
    transform: (json) => json as unknown as ScanData,
  });

  if (loading && !data) return <ReportLoadingState metricCount={2} rows={8} />;

  if (error && !data) {
    return (
      <ReportErrorState
        error={error}
        onRetry={() => {
          setPage(0);
          reload();
        }}
        title="Failed to load scan report"
      />
    );
  }

  if (!data) return null;

  const totalPages = Math.ceil(data.total / limit);
  const entries = data.data ?? [];

  return (
    <FadeUp>
      {/* Filters */}
      <ReportToolbar
        lastRefreshed={lastRefreshed}
        loading={loading}
        now={now}
        onRefresh={reload}
        exportAction={entries.length > 0 ? (
          <ReportExportButton onClick={() => downloadCsv(entries)} />
        ) : null}
      >
        <ReportToolbarGroup label="Period">
          <ReportSegmentedControl
            ariaLabel="Scan report period"
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
        <ReportToolbarGroup label="Phase">
          <ReportSegmentedControl
            ariaLabel="Scan report phase"
            value={phaseFilter}
            options={[
              { value: "", label: "All" },
              { value: "CHECKOUT", label: "Checkout" },
              { value: "CHECKIN", label: "Check-in" },
            ]}
            onChange={(nextPhase) => {
              setPhaseFilter(nextPhase);
              setPage(0);
              syncUrl({ phase: nextPhase, page: "" });
            }}
          />
        </ReportToolbarGroup>
      </ReportToolbar>

      <ReportMetricGrid>
        <MetricCard value={data.total} label="Total scans" tooltip="Total scan events in the selected period" />
        <MetricCard
          value={`${data.successRate}%`}
          label="Success rate"
          color={data.successRate < 95 ? "var(--red)" : undefined}
          tooltip="Percentage of scans that matched an asset"
        />
      </ReportMetricGrid>

      {data.dailyScans && data.dailyScans.length > 1 && (
        <LazyDailyScanVolumeChart dailyScans={data.dailyScans} />
      )}

      <ReportSectionCard title="Scan history" description={`${data.total} events`} contentClassName="p-0">

        {entries.length === 0 ? (
          <ReportEmptyState
            icon="search"
            title="No scan events recorded"
            description="Try another phase or period to inspect older scan activity."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDateTime(s.createdAt)}</TableCell>
                      <TableCell>{s.actor}</TableCell>
                      <TableCell className="font-mono text-sm">{s.item}</TableCell>
                      <TableCell>
                        <Badge variant={s.phase === "CHECKOUT" ? "blue" : "purple"}>
                          {s.phase.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ReportTableLink href={`/checkouts/${s.bookingId}`} className="text-sm">
                          {s.bookingTitle}
                        </ReportTableLink>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.success ? "green" : "red"}>
                          {s.success ? "ok" : "fail"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {entries.map((s) => (
                <ScanMobileCard key={s.id} s={s} />
              ))}
            </div>

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
