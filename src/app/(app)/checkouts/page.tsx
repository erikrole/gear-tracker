"use client";

import { useEffect, useState } from "react";

type Checkout = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  requester: { name: string };
  location: { name: string };
  serializedItems: Array<{ asset: { assetTag: string; brand: string; model: string } }>;
  bulkItems: Array<{ bulkSku: { name: string }; plannedQuantity: number }>;
};

type Response = { data: Checkout[]; total: number; limit: number; offset: number };

const statusBadge: Record<string, string> = {
  DRAFT: "badge-gray",
  OPEN: "badge-green",
  COMPLETED: "badge-purple",
  CANCELLED: "badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CheckoutsPage() {
  const [items, setItems] = useState<Checkout[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/checkouts?${params}`)
      .then((res) => res.json())
      .then((json: Response) => { setItems(json.data); setTotal(json.total); })
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>Check-outs</h1>
        <button className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New check-out
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>All check-outs</h2>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              background: "white",
            }}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No check-outs found</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Requester</th>
                  <th>Period</th>
                  <th>Location</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const isOverdue = c.status === "OPEN" && new Date(c.endsAt) < new Date();
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.title}</td>
                      <td>{c.requester.name}</td>
                      <td>{formatDate(c.startsAt)} &ndash; {formatDate(c.endsAt)}</td>
                      <td>{c.location.name}</td>
                      <td>{c.serializedItems.length + c.bulkItems.length}</td>
                      <td>
                        <span className={`badge ${isOverdue ? "badge-red" : (statusBadge[c.status] || "badge-gray")}`}>
                          {isOverdue ? "overdue" : c.status.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="pagination">
                <span>Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
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
