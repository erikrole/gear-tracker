"use client";

import { useEffect, useState } from "react";
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
import { AlertCircle } from "lucide-react";

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
  const [error, setError] = useState(false);

  function loadData() {
    setLoading(true);
    setError(false);
    fetch("/api/reports?type=utilization")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  if (loading) {
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

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load utilization report</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>Check your connection and try again.</span>
          <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex items-center mb-1 justify-end">
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
            />
          );
        })}
        <MetricCard value={data.totalAssets} label="Total assets" />
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
