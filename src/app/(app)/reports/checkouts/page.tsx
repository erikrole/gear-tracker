"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateFull, formatRelativeTime } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

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
  recentCheckouts: CheckoutRow[];
  topRequesters: { name: string; count: number }[];
};

const trendConfig: ChartConfig = {
  count: { label: "Checkouts", color: "hsl(220 70% 55%)" },
};

const BAR_COLORS = [
  "hsl(220 70% 55%)", "hsl(270 60% 60%)", "hsl(142 60% 45%)",
  "hsl(25 90% 55%)", "hsl(340 70% 55%)", "hsl(180 50% 45%)",
  "hsl(45 80% 50%)", "hsl(0 0% 60%)", "hsl(200 60% 50%)", "hsl(120 40% 50%)",
];

function formatDateLabel(dateStr: unknown) {
  if (typeof dateStr !== "string") return String(dateStr);
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const variant = isOverdue ? "red" : status === "OPEN" ? "green" : "gray";
  return <Badge variant={variant}>{isOverdue ? "overdue" : status.toLowerCase()}</Badge>;
}

function CheckoutMobileCard({ c }: { c: CheckoutRow }) {
  return (
    <Link href={`/checkouts/${c.id}`} className="flex flex-col gap-1 px-4 py-3 border-b last:border-b-0 no-underline">
      <div className="flex items-center justify-between">
        <span className="text-foreground font-medium">{c.title}</span>
        <StatusBadge status={c.status} isOverdue={c.isOverdue} />
      </div>
      <div className="text-sm text-muted-foreground">
        {c.requester} &middot; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""} &middot; Due {formatDateFull(c.endsAt)}
      </div>
    </Link>
  );
}

function downloadCsv(rows: CheckoutRow[]) {
  const header = "Title,Requester,Status,Due,Items,Overdue\n";
  const csv = rows.map((c) =>
    `"${c.title}","${c.requester}","${c.status}","${c.endsAt}",${c.itemCount},${c.isOverdue}`
  ).join("\n");
  const blob = new Blob([header + csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checkouts-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CheckoutsReportPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<CheckoutData | null>(null);
  const [days, setDays] = useState(() => {
    const p = searchParams.get("days");
    return p && [7, 30, 90].includes(Number(p)) ? Number(p) : 30;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | false>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/reports?type=checkouts&days=${days}`, { signal: controller.signal });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { setError("Unable to load checkout report. Please try again."); return; }
      const json = await res.json();
      setData(json ?? null);
      setLastRefreshed(new Date());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("You appear to be offline. Check your connection and try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadData();
    return () => { abortRef.current?.abort(); };
  }, [loadData]);

  if (loading && !data) {
    return (
      <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
          {[0, 1].map((i) => (
            <Card key={i} className="p-4 text-center">
              <Skeleton className="h-8 mx-auto mb-2 w-[40px]" />
              <Skeleton className="h-4 mx-auto w-[80px]" />
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-2.5">
          <Card className="p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className="h-4" style={{ width: `${65 - i * 7}%` }} />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </Card>
          <Card className="p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className="h-4" style={{ width: `${55 - i * 6}%` }} />
                <Skeleton className="h-4 w-10 ml-auto" />
              </div>
            ))}
          </Card>
        </div>
      </>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load checkout report</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* Period selector */}
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="text-sm text-muted-foreground">Period:</span>
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "outline"} size="sm"
            onClick={() => {
              setDays(d);
              const url = new URL(window.location.href);
              url.searchParams.set("days", String(d));
              window.history.replaceState(null, "", url.toString());
            }}
          >
            {d}d
          </Button>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), now)}` : "Refresh"}
          </TooltipContent>
        </Tooltip>
        {(data.recentCheckouts ?? []).length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(data.recentCheckouts)} className="ml-auto">
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
        <MetricCard value={data.totalCheckouts} label={`Checkouts (${days}d)`} tooltip="Checkouts created in the selected period" href="/bookings?tab=checkouts" />
        <MetricCard
          value={data.overdueCheckouts}
          label="Currently overdue"
          color={data.overdueCheckouts > 0 ? "var(--red)" : undefined}
          tooltip="Checkouts currently past their return date"
          href="/checkouts?status=overdue"
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-2.5 mb-2.5">
        {/* Checkout trend */}
        {(data.dailyTrend ?? []).length > 1 && (
          <Card>
            <CardHeader><CardTitle>Checkout trend ({days}d)</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="w-full h-[200px]">
                <AreaChart data={data.dailyTrend} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" tickFormatter={formatDateLabel}
                    interval={Math.max(0, Math.floor((data.dailyTrend?.length ?? 0) / 7) - 1)} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="count" name="Checkouts" fill="hsl(220 70% 55% / 0.2)" stroke="hsl(220 70% 55%)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Top requesters bar chart */}
        {(data.topRequesters ?? []).length > 0 && (
          <Card>
            <CardHeader><CardTitle>Top requesters ({days}d)</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{ count: { label: "Checkouts" } }} className="w-full" style={{ height: Math.max(150, data.topRequesters.length * 36) }}>
                <BarChart data={data.topRequesters} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} className="text-xs" />
                  <XAxis type="number" hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" name="Checkouts" radius={[0, 4, 4, 0]}>
                    {data.topRequesters.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-2.5">
        {/* Recent checkouts */}
        <Card>
          <CardHeader><CardTitle>Recent checkouts</CardTitle></CardHeader>
          {(data.recentCheckouts ?? []).length === 0 ? (
            <EmptyState icon="clipboard" title="No checkouts in this period" />
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
                          <Link href={`/checkouts/${c.id}`} className="text-foreground font-medium hover:underline">{c.title}</Link>
                        </TableCell>
                        <TableCell>{c.requester}</TableCell>
                        <TableCell>{formatDateFull(c.endsAt)}</TableCell>
                        <TableCell>{c.itemCount}</TableCell>
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
        </Card>

        {/* Top requesters */}
        <Card>
          <CardHeader><CardTitle>Top requesters</CardTitle></CardHeader>
          {(data.topRequesters ?? []).length === 0 ? (
            <EmptyState icon="users" title="No data" />
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
                        <TableCell className="text-right">{r.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden">
                {data.topRequesters.map((r) => (
                  <div key={r.name} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
                    <span>{r.name}</span>
                    <span className="text-muted-foreground">{r.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
