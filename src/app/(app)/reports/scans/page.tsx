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
  successCount: number;
  successRate: number;
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
  const [data, setData] = useState<ScanData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState("");
  const [periodDays, setPeriodDays] = useState(0); // 0 = all time
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      type: "scans",
      limit: String(limit),
      offset: String(page * limit),
    });
    if (phaseFilter) params.set("phase", phaseFilter);
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    fetch(`/api/reports?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, phaseFilter, periodDays]);

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

  function reload() {
    setPage(0);
    setError(false);
    setLoading(true);
    const params = new URLSearchParams({
      type: "scans",
      limit: String(limit),
      offset: "0",
    });
    if (phaseFilter) params.set("phase", phaseFilter);
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    fetch(`/api/reports?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  if (error || !data) {
    return (
      <div className="card p-16 text-center">
        <p className="text-secondary mb-8">Failed to load scan report.</p>
        <button className="btn btn-sm" onClick={reload}>Retry</button>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / limit);

  return (
    <>
      {/* Filters */}
      <div className="flex-center gap-12 mb-16" style={{ flexWrap: "wrap" }}>
        <span className="text-sm text-muted">Period:</span>
        {[{ d: 0, label: "All" }, { d: 7, label: "7d" }, { d: 30, label: "30d" }, { d: 90, label: "90d" }].map(({ d, label }) => (
          <button
            key={d}
            className={`btn btn-sm${periodDays === d ? " btn-primary" : ""}`}
            onClick={() => { setPeriodDays(d); setPage(0); }}
          >
            {label}
          </button>
        ))}
        <span className="text-sm text-muted" style={{ marginLeft: 8 }}>Phase:</span>
        {[{ v: "", label: "All" }, { v: "CHECKOUT", label: "Checkout" }, { v: "CHECKIN", label: "Check-in" }].map(({ v, label }) => (
          <button
            key={v}
            className={`btn btn-sm${phaseFilter === v ? " btn-primary" : ""}`}
            onClick={() => { setPhaseFilter(v); setPage(0); }}
          >
            {label}
          </button>
        ))}
        {data.data.length > 0 && (
          <button className="btn btn-sm" onClick={() => downloadCsv(data.data)} style={{ marginLeft: "auto" }}>
            Export CSV
          </button>
        )}
      </div>

      <div className="summary-grid mb-16">
        <MetricCard value={data.total} label="Total scans" />
        <MetricCard
          value={`${data.successRate}%`}
          label="Success rate"
          color={data.successRate < 95 ? "var(--red)" : undefined}
        />
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
