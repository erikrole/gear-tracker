"use client";

import { useEffect, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type UtilizationData = {
  totalAssets: number;
  statusCounts: Record<string, number>;
  byLocation: { location: string; count: number }[];
  byType: { type: string; count: number }[];
  byDepartment: { department: string; count: number }[];
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  AVAILABLE: { label: "Available", badge: "badge-green" },
  CHECKED_OUT: { label: "Checked out", badge: "badge-blue" },
  RESERVED: { label: "Reserved", badge: "badge-purple" },
  MAINTENANCE: { label: "Maintenance", badge: "badge-orange" },
  RETIRED: { label: "Retired", badge: "badge-gray" },
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
      <div className="hide-mobile-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>{labelKey}</th>
              <th className="text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="text-right">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="show-mobile-only">
        {rows.map((r) => (
          <div key={r.label} className="report-mobile-card">
            <span>{r.label}</span>
            <span className="text-muted">{r.count}</span>
          </div>
        ))}
      </div>
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
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <>
        <div className="summary-grid mb-16">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="p-16 text-center">
              <Skeleton className="skeleton-text-lg mx-auto mb-2 w-[40px]" />
              <Skeleton className="skeleton-text-sm mx-auto w-[80px]" />
            </Card>
          ))}
        </div>
        <div className="grid-2col gap-16">
          <Card><SkeletonTable rows={4} cols={2} /></Card>
          <Card><SkeletonTable rows={4} cols={2} /></Card>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-16 text-center">
        <p className="text-secondary mb-8">Failed to load utilization report.</p>
        <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
      </Card>
    );
  }

  return (
    <>
      <div className="flex-center mb-16" style={{ justifyContent: "flex-end" }}>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(data)}>
          Export CSV
        </Button>
      </div>
      <div className="summary-grid mb-16">
        {Object.entries(data.statusCounts).map(([status, count]) => {
          const meta = STATUS_META[status];
          return (
            <MetricCard
              key={status}
              value={count}
              label={meta?.label || status}
              badge={meta ? { text: meta.label, className: meta.badge } : undefined}
            />
          );
        })}
        <MetricCard value={data.totalAssets} label="Total assets" />
      </div>

      <div className="grid-2col gap-16">
        <BreakdownCard
          title="By location"
          labelKey="Location"
          rows={data.byLocation.map((r) => ({ label: r.location, count: r.count }))}
        />
        <BreakdownCard
          title="By type"
          labelKey="Type"
          rows={data.byType.map((r) => ({ label: r.type, count: r.count }))}
        />
        {data.byDepartment.length > 0 && (
          <div className="col-span-full">
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
