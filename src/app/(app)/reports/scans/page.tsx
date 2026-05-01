"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { syncUrl } from "@/lib/url-sync";
import dynamic from "next/dynamic";

const LazyDailyScanVolumeChart = dynamic(
  () => import("./charts").then((m) => ({ default: m.DailyScanVolumeChart })),
  { ssr: false }
);
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <div className="flex flex-col gap-1 px-4 py-3 border-b last:border-b-0">
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
      <Link href={`/checkouts/${s.bookingId}`} className="text-foreground font-medium text-sm no-underline hover:underline">
        {s.bookingTitle}
      </Link>
    </div>
  );
}

function downloadCsv(entries: ScanEntry[]) {
  const header = "Timestamp,Actor,Item,Phase,Booking,Result\n";
  const rows = entries.map((s) =>
    `"${s.createdAt}","${s.actor}","${s.item}","${s.phase}","${s.bookingTitle}","${s.success ? "ok" : "fail"}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scan-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

  if (loading && !data) {
    return (
      <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
          <Card className="p-4 text-center">
            <Skeleton className="h-8 mx-auto mb-2 w-[40px]" />
            <Skeleton className="h-4 mx-auto w-[80px]" />
          </Card>
        </div>
        <Card className="p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex gap-4 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4" style={{ width: `${50 + (i % 3) * 10}%` }} />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </Card>
      </>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load scan report</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>{error === "network" ? "You appear to be offline. Check your connection and try again." : "Unable to load scan report. Please try again."}</span>
          <Button variant="outline" size="sm" onClick={() => { setPage(0); }}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const totalPages = Math.ceil(data.total / limit);
  const entries = data.data ?? [];

  return (
    <FadeUp>
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
        <span className="text-sm text-muted-foreground ml-2">Phase:</span>
        {[{ v: "", label: "All" }, { v: "CHECKOUT", label: "Checkout" }, { v: "CHECKIN", label: "Check-in" }].map(({ v, label }) => (
          <Button
            key={v}
            variant={phaseFilter === v ? "default" : "outline"} size="sm"
            onClick={() => { setPhaseFilter(v); setPage(0); syncUrl({ phase: v, page: "" }); }}
          >
            {label}
          </Button>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={reload}>
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
        <MetricCard value={data.total} label="Total scans" tooltip="Total scan events in the selected period" />
        <MetricCard
          value={`${data.successRate}%`}
          label="Success rate"
          color={data.successRate < 95 ? "var(--red)" : undefined}
          tooltip="Percentage of scans that matched an asset"
        />
      </div>

      {data.dailyScans && data.dailyScans.length > 1 && (
        <LazyDailyScanVolumeChart dailyScans={data.dailyScans} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scan history</CardTitle>
          <span className="text-sm text-muted-foreground">{data.total} events</span>
        </CardHeader>

        {entries.length === 0 ? (
          <EmptyState icon="search" title="No scan events recorded" />
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
                        <Link href={`/checkouts/${s.bookingId}`} className="text-foreground font-medium text-sm hover:underline">
                          {s.bookingTitle}
                        </Link>
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
