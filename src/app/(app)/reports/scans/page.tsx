"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  limit: number;
  offset: number;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ScanHistoryPage() {
  const [data, setData] = useState<ScanData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=scans&limit=${limit}&offset=${page * limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state">Failed to load report</div>;

  const totalPages = Math.ceil(data.total / limit);

  return (
    <>
      <div className="summary-grid mb-16">
        <div className="card p-16 text-center">
          <div className="metric-value">{data.total}</div>
          <div className="text-sm text-muted">Total scans</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Scan history</h2>
          <span className="text-sm text-muted">{data.total} events</span>
        </div>
        {data.data.length === 0 ? (
          <div className="empty-state">No scan events recorded</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Item</th>
                  <th>Phase</th>
                  <th>Booking</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((s) => (
                  <tr key={s.id}>
                    <td className="nowrap text-sm">{formatDateTime(s.createdAt)}</td>
                    <td>{s.actor}</td>
                    <td className="font-mono text-sm">{s.item}</td>
                    <td>
                      <span className={`badge ${s.phase === "CHECKOUT" ? "badge-blue" : "badge-purple"}`}>
                        {s.phase.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <Link href={`/checkouts/${s.bookingId}`} className="row-link text-sm">
                        {s.bookingTitle}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${s.success ? "badge-green" : "badge-red"}`}>
                        {s.success ? "ok" : "fail"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="pagination">
                <span>Page {page + 1} of {totalPages}</span>
                <div className="pagination-btns">
                  <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
