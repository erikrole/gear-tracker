"use client";

import { useEffect, useState } from "react";

type UtilizationData = {
  totalAssets: number;
  statusCounts: Record<string, number>;
  byLocation: { location: string; count: number }[];
  byType: { type: string; count: number }[];
  byDepartment: { department: string; count: number }[];
};

const statusLabel: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  RESERVED: "Reserved",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};

const statusBadge: Record<string, string> = {
  AVAILABLE: "badge-green",
  CHECKED_OUT: "badge-blue",
  RESERVED: "badge-purple",
  MAINTENANCE: "badge-orange",
  RETIRED: "badge-gray",
};

export default function UtilizationPage() {
  const [data, setData] = useState<UtilizationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports?type=utilization")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state">Failed to load report</div>;

  return (
    <>
      <div className="summary-grid mb-16">
        {Object.entries(data.statusCounts).map(([status, count]) => (
          <div key={status} className="card p-16 text-center">
            <div className="metric-value">{count}</div>
            <div className="text-sm text-muted">
              <span className={`badge ${statusBadge[status] || "badge-gray"}`}>
                {statusLabel[status] || status}
              </span>
            </div>
          </div>
        ))}
        <div className="card p-16 text-center">
          <div className="metric-value">{data.totalAssets}</div>
          <div className="text-sm text-muted">Total assets</div>
        </div>
      </div>

      <div className="grid-2col gap-16">
        <div className="card">
          <div className="card-header"><h2>By location</h2></div>
          {data.byLocation.length === 0 ? (
            <div className="empty-state">No data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Location</th><th className="text-right">Count</th></tr></thead>
              <tbody>
                {data.byLocation.map((r) => (
                  <tr key={r.location}><td>{r.location}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h2>By type</h2></div>
          {data.byType.length === 0 ? (
            <div className="empty-state">No data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Type</th><th className="text-right">Count</th></tr></thead>
              <tbody>
                {data.byType.map((r) => (
                  <tr key={r.type}><td>{r.type}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data.byDepartment.length > 0 && (
          <div className="card col-span-full">
            <div className="card-header"><h2>By department</h2></div>
            <table className="data-table">
              <thead><tr><th>Department</th><th className="text-right">Count</th></tr></thead>
              <tbody>
                {data.byDepartment.map((r) => (
                  <tr key={r.department}><td>{r.department}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
