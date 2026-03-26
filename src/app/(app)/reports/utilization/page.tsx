"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { formatRelativeTime } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type UtilizationData = {
  totalAssets: number;
  statusCounts: Record<string, number>;
  byLocation: { location: string; count: number }[];
  byType: { type: string; count: number }[];
  byDepartment: { department: string; count: number }[];
};

const STATUS_META: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  AVAILABLE: { label: "Available", variant: "green" },
  CHECKED_OUT: { label: "Checked out", variant: "blue" },
  RESERVED: { label: "Reserved", variant: "purple" },
  MAINTENANCE: { label: "Maintenance", variant: "orange" },
  RETIRED: { label: "Retired", variant: "gray" },
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "hsl(142 60% 45%)",
  CHECKED_OUT: "hsl(220 70% 55%)",
  RESERVED: "hsl(270 60% 60%)",
  MAINTENANCE: "hsl(25 90% 55%)",
  RETIRED: "hsl(0 0% 60%)",
};

const BAR_COLORS = [
  "hsl(220 70% 55%)", "hsl(270 60% 60%)", "hsl(142 60% 45%)",
  "hsl(25 90% 55%)", "hsl(340 70% 55%)", "hsl(180 50% 45%)",
  "hsl(45 80% 50%)", "hsl(0 0% 60%)",
];

function StatusDonut({ statusCounts }: { statusCounts: Record<string, number> }) {
  const chartData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: STATUS_META[status]?.label ?? status,
      count,
      fill: STATUS_COLORS[status] ?? "hsl(0 0% 50%)",
    }));

  if (chartData.length === 0) return null;

  const config: ChartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.status, color: d.fill }])
  );

  return (
    <Card>
      <CardHeader><CardTitle>Status distribution</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={chartData} dataKey="count" nameKey="status" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {chartData.map((d) => (
                <Cell key={d.status} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {chartData.map((d) => (
            <div key={d.status} className="flex items-center gap-1.5 text-xs">
              <span className="size-2.5 rounded-full" style={{ background: d.fill }} />
              {d.status} ({d.count})
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TopBreakdownChart({ title, data, labelKey }: { title: string; data: { label: string; count: number }[]; labelKey: string }) {
  if (data.length === 0) return null;
  const top = data.sort((a, b) => b.count - a.count).slice(0, 8);

  const config: ChartConfig = Object.fromEntries(
    top.map((d, i) => [d.label, { label: d.label, color: BAR_COLORS[i % BAR_COLORS.length] }])
  );

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config} className="w-full" style={{ height: Math.max(150, top.length * 36) }}>
          <BarChart data={top} layout="vertical" margin={{ left: 0, right: 12 }}>
            <YAxis dataKey="label" type="category" width={100} tickLine={false} axisLine={false} className="text-xs" />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name={labelKey} radius={[0, 4, 4, 0]}>
              {top.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

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
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>

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
                <TableCell className="text-right">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <CardContent className="md:hidden space-y-0 p-0">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
            <span>{r.label}</span>
            <span className="text-muted-foreground">{r.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function downloadCsv(data: UtilizationData) {
  let csv = "Status,Count\n";
  for (const [status, count] of Object.entries(data.statusCounts)) {
    csv += `"${status}",${count}\n`;
  }
  csv += `\nLocation,Count\n`;
  for (const r of data.byLocation) csv += `"${r.location}",${r.count}\n`;
  csv += `\nType,Count\n`;
  for (const r of data.byType) csv += `"${r.type}",${r.count}\n`;
  if (data.byDepartment.length > 0) {
    csv += `\nDepartment,Count\n`;
    for (const r of data.byDepartment) csv += `"${r.department}",${r.count}\n`;
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `utilization-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UtilizationPage() {
  const [data, setData] = useState<UtilizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | false>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const abortRef = useRef<AbortController | null>(null);

  // Update "ago" display every 60s
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
      const res = await fetch("/api/reports?type=utilization", { signal: controller.signal });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { setError("Unable to load utilization report. Please try again."); return; }
      const json = await res.json();
      setData(json ?? null);
      setLastRefreshed(new Date());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("You appear to be offline. Check your connection and try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => { abortRef.current?.abort(); };
  }, [loadData]);

  if (loading && !data) {
    return (
      <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="p-4 text-center">
              <Skeleton className="h-8 mx-auto mb-2 w-[40px]" />
              <Skeleton className="h-4 mx-auto w-[80px]" />
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-2.5">
          <Card className="p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className="h-4" style={{ width: `${60 - i * 8}%` }} />
                <Skeleton className="h-4 w-10 ml-auto" />
              </div>
            ))}
          </Card>
          <Card className="p-4">
            {Array.from({ length: 4 }, (_, i) => (
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
        <AlertTitle>Failed to load utilization report</AlertTitle>
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
      <div className="flex items-center mb-1 justify-end gap-2">
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
        <Button variant="outline" size="sm" onClick={() => downloadCsv(data)}>
          Export CSV
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
        {Object.entries(data.statusCounts).map(([status, count]) => {
          const meta = STATUS_META[status];
          return (
            <MetricCard
              key={status}
              value={count}
              label={meta?.label || status}
              badge={meta ? { text: meta.label, variant: meta.variant } : undefined}
              href={`/items?status=${status}`}
            />
          );
        })}
        <MetricCard value={data.totalAssets} label="Total assets" tooltip="Total number of assets in the system" href="/items" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-2.5 mb-2.5">
        <StatusDonut statusCounts={data.statusCounts} />
        <TopBreakdownChart
          title="By location"
          labelKey="Assets"
          data={(data.byLocation ?? []).map((r) => ({ label: r.location, count: r.count }))}
        />
        <TopBreakdownChart
          title="By type"
          labelKey="Assets"
          data={(data.byType ?? []).map((r) => ({ label: r.type, count: r.count }))}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-2.5">
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
    </>
  );
}
