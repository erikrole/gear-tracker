"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateFull } from "@/lib/format";

type CheckoutData = {
  days: number;
  totalCheckouts: number;
  overdueCheckouts: number;
  recentCheckouts: {
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
  }[];
  topRequesters: { name: string; count: number }[];
};

export default function CheckoutsReportPage() {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=checkouts&days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state">Failed to load report. Please try refreshing the page.</div>;

  return (
    <>
      <div className="flex-center gap-12 mb-16">
        <span className="text-sm text-muted">Period:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            className={`btn btn-sm${days === d ? " btn-primary" : ""}`}
            onClick={() => setDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="summary-grid mb-16">
        <div className="card p-16 text-center">
          <div className="metric-value">{data.totalCheckouts}</div>
          <div className="text-sm text-muted">Checkouts ({days}d)</div>
        </div>
        <div className="card p-16 text-center">
          <div className="metric-value" style={{ color: data.overdueCheckouts > 0 ? "var(--red)" : undefined }}>
            {data.overdueCheckouts}
          </div>
          <div className="text-sm text-muted">Currently overdue</div>
        </div>
      </div>

      <div className="grid-2col gap-16">
        <div className="card">
          <div className="card-header"><h2>Recent checkouts</h2></div>
          {data.recentCheckouts.length === 0 ? (
            <div className="empty-state">No checkouts in this period</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Requester</th>
                  <th>Due</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCheckouts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/checkouts/${c.id}`} className="row-link">
                        {c.title}
                      </Link>
                    </td>
                    <td>{c.requester}</td>
                    <td>{formatDateFull(c.endsAt)}</td>
                    <td>{c.itemCount}</td>
                    <td>
                      <span className={`badge ${c.isOverdue ? "badge-red" : c.status === "OPEN" ? "badge-green" : "badge-gray"}`}>
                        {c.isOverdue ? "overdue" : c.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h2>Top requesters</h2></div>
          {data.topRequesters.length === 0 ? (
            <div className="empty-state">No data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th className="text-right">Checkouts</th></tr></thead>
              <tbody>
                {data.topRequesters.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
