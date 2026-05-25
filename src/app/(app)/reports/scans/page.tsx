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

const PHASE_ALL = "ALL";
const VALID_PERIODS = [0, 7, 30, 90] as const;
type PhaseFilter = typeof PHASE_ALL | "CHECKOUT" | "CHECKIN";

function parsePageParam(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function parsePhaseParam(value: string | null): PhaseFilter {
  return value === "CHECKOUT" || value === "CHECKIN" ? value : PHASE_ALL;
}

function parsePeriodParam(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return VALID_PERIODS.includes(parsed as (typeof VALID_PERIODS)[number]) ? parsed : 0;
}

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
  const [page, setPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>(() => parsePhaseParam(searchParams.get("phase")));
  const [periodDays, setPeriodDays] = useState(() => parsePeriodParam(searchParams.get("period")));
  const [now, setNow] = useState(() => new Date());
  const limit = 50;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const nextPage = parsePageParam(searchParams.get("page"));
    const nextPhase = parsePhaseParam(searchParams.get("phase"));
    const nextPeriod = parsePeriodParam(searchParams.get("period"));
    setPage((current) => (current === nextPage ? current : nextPage));
    setPhaseFilter((current) => (current === nextPhase ? current : nextPhase));
    setPeriodDays((current) => (current === nextPeriod ? current : nextPeriod));

    const corrections: Record<string, string | number> = {};
    if (searchParams.get("page") && nextPage === 0) {
      corrections.page = "";
    }
    if (searchParams.get("phase") && nextPhase === PHASE_ALL) {
      corrections.phase = "";
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
    if (phaseFilter !== PHASE_ALL) params.set("phase", phaseFilter);
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    return `/api/reports/scans?${params}`;
  }, [page, phaseFilter, periodDays]);

  const { data, loading, error, lastRefreshed, reload } = useFetch<ScanData>({
    url: fetchUrl,
    transform: (json) => json as unknown as ScanData,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  useEffect(() => {
    if (!data || page === 0) return;
    const lastPage = Math.max(0, totalPages - 1);
    if (page > lastPage) {
      setPage(lastPage);
      syncUrl({ page: lastPage > 0 ? lastPage + 1 : "" });
    }
  }, [data, page, totalPages]);

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

  const entries = data.data ?? [];
  const activeFilters = [
    ...(periodDays > 0
      ? [{
          key: "period",
          label: `Period: ${periodDays}d`,
          onRemove: () => {
            setPeriodDays(0);
            setPage(0);
            syncUrl({ period: "", page: "" });
          },
        }]
      : []),
    ...(phaseFilter !== PHASE_ALL
      ? [{
          key: "phase",
          label: `Phase: ${phaseFilter === "CHECKOUT" ? "Checkout" : "Check-in"}`,
          onRemove: () => {
            setPhaseFilter(PHASE_ALL);
            setPage(0);
            syncUrl({ phase: "", page: "" });
          },
        }]
      : []),
  ];

  return (
    <FadeUp>
      {/* Filters */}
      <ReportToolbar
        activeFilters={activeFilters}
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
              { value: PHASE_ALL, label: "All" },
              { value: "CHECKOUT", label: "Checkout" },
              { value: "CHECKIN", label: "Check-in" },
            ]}
            onChange={(nextPhase) => {
              setPhaseFilter(nextPhase);
              setPage(0);
              syncUrl({ phase: nextPhase === PHASE_ALL ? "" : nextPhase, page: "" });
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
