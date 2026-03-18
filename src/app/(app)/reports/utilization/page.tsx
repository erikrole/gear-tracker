"use client";

import { useEffect, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";

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
    <div className="card">
      <div className="card-header"><h2>{title}</h2></div>

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
    </div>
  );
}

export default function UtilizationPage() {
  const [data, setData] = useState<UtilizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/reports?type=utilization")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <div className="summary-grid mb-16">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card p-16 text-center">
              <div className="skeleton skeleton-text-lg" style={{ width: 40, margin: "0 auto 8px" }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 80, margin: "0 auto" }} />
            </div>
          ))}
        </div>
        <div className="grid-2col gap-16">
          <div className="card"><SkeletonTable rows={4} cols={2} /></div>
          <div className="card"><SkeletonTable rows={4} cols={2} /></div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon="chart"
        title="Failed to load report"
        description="Something went wrong. Please try refreshing the page."
      />
    );
  }

  return (
    <>
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
