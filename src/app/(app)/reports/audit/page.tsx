"use client";

import { useEffect, useState } from "react";

type AuditData = {
  data: {
    id: string;
    actor: string;
    entityType: string;
    entityId: string;
    action: string;
    createdAt: string;
  }[];
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
  });
}

export default function AuditReportPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=audit&limit=${limit}&offset=${page * limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state">Failed to load report</div>;

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Audit trail</h2>
        <span className="text-sm text-muted">{data.total} entries</span>
      </div>
      {data.data.length === 0 ? (
        <div className="empty-state">No audit log entries</div>
      ) : (
        <>
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
                  <td>
                    <span className="badge badge-gray">{entry.action}</span>
                  </td>
                  <td className="text-sm font-mono">
                    {entry.entityType}:{entry.entityId.slice(0, 8)}
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
  );
}
