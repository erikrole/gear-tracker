"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

type AuditEntry = {
  id: string;
  actor: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
};

type AuditData = {
  data: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

function AuditMobileCard({ entry }: { entry: AuditEntry }) {
  return (
    <div className="report-mobile-card" style={{ flexDirection: "column", gap: 4 }}>
      <div className="report-mobile-top">
        <span className="badge badge-gray">{entry.action}</span>
        <span className="text-xs text-muted">{formatDateTime(entry.createdAt)}</span>
      </div>
      <div className="text-sm">
        <span>{entry.actor}</span>
        <span className="text-muted"> &middot; </span>
        <span className="font-mono text-xs">{entry.entityType}:{entry.entityId.slice(0, 8)}</span>
      </div>
    </div>
  );
}

function downloadCsv(entries: AuditEntry[]) {
  const header = "Timestamp,Actor,Action,Entity Type,Entity ID\n";
  const rows = entries.map((e) =>
    `"${e.createdAt}","${e.actor}","${e.action}","${e.entityType}","${e.entityId}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditReportPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [periodDays, setPeriodDays] = useState(0); // 0 = all time
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      type: "audit",
      limit: String(limit),
      offset: String(page * limit),
    });
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    fetch(`/api/reports?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, periodDays]);

  if (loading) {
    return <div className="card"><SkeletonTable rows={6} cols={4} /></div>;
  }

  if (error || !data) {
    return (
      <div className="card p-16 text-center">
        <p className="text-secondary mb-8">Failed to load audit report.</p>
        <button className="btn btn-sm" onClick={() => { setError(false); setLoading(true); setPage(0); }}>Retry</button>
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
        {data.data.length > 0 && (
          <button className="btn btn-sm" onClick={() => downloadCsv(data.data)} style={{ marginLeft: "auto" }}>
            Export CSV
          </button>
        )}
      </div>

    <div className="card">
      <div className="card-header">
        <h2>Audit trail</h2>
        <span className="text-sm text-muted">{data.total} entries</span>
      </div>

      {data.data.length === 0 ? (
        <EmptyState icon="clipboard" title="No audit log entries" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hide-mobile-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="nowrap text-sm">{formatDateTime(entry.createdAt)}</td>
                    <td>{entry.actor}</td>
                    <td><span className="badge badge-gray">{entry.action}</span></td>
                    <td className="text-sm font-mono">{entry.entityType}:{entry.entityId.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-mobile-only">
            {data.data.map((entry) => (
              <AuditMobileCard key={entry.id} entry={entry} />
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
