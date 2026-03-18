"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";

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

function ScanMobileCard({ s }: { s: ScanEntry }) {
  return (
    <div className="report-mobile-card" style={{ flexDirection: "column", gap: 4 }}>
      <div className="report-mobile-top">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${s.phase === "CHECKOUT" ? "badge-blue" : "badge-purple"}`}>
            {s.phase.toLowerCase()}
          </span>
          <span className={`badge ${s.success ? "badge-green" : "badge-red"}`}>
            {s.success ? "ok" : "fail"}
          </span>
        </div>
        <span className="text-xs text-muted">{formatDateTime(s.createdAt)}</span>
      </div>
      <div className="text-sm">
        <span className="text-muted">{s.actor}</span> scanned <span className="font-mono">{s.item}</span>
      </div>
      <Link href={`/checkouts/${s.bookingId}`} className="row-link text-sm no-underline">
        {s.bookingTitle}
      </Link>
    </div>
  );
}

export default function ScanHistoryPage() {
  const [data, setData] = useState<ScanData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/reports?type=scans&limit=${limit}&offset=${page * limit}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <>
        <div className="summary-grid mb-16">
          <div className="card p-16 text-center">
            <div className="skeleton skeleton-text-lg" style={{ width: 40, margin: "0 auto 8px" }} />
            <div className="skeleton skeleton-text-sm" style={{ width: 80, margin: "0 auto" }} />
          </div>
        </div>
        <div className="card"><SkeletonTable rows={8} cols={6} /></div>
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

  const totalPages = Math.ceil(data.total / limit);

  return (
    <>
      <div className="summary-grid mb-16">
        <MetricCard value={data.total} label="Total scans" />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Scan history</h2>
          <span className="text-sm text-muted">{data.total} events</span>
        </div>

        {data.data.length === 0 ? (
          <EmptyState icon="search" title="No scan events recorded" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hide-mobile-only">
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
            </div>

            {/* Mobile cards */}
            <div className="show-mobile-only">
              {data.data.map((s) => (
                <ScanMobileCard key={s.id} s={s} />
              ))}
            </div>

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
