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
  const [submitting, setSubmitting] = useState(false);
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

  async function reload() {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/checkouts?${params}`);
    const json: Response = await res.json();
    setItems(json.data);
    setTotal(json.total);
  }

  async function handleNewCheckout() {
    const optionsRes = await fetch("/api/form-options");
    const optionsJson = await optionsRes.json();
    const users: Array<{ id: string; name: string }> = optionsJson.data.users;
    const locations: Array<{ id: string; name: string }> = optionsJson.data.locations;
    const assets: Array<{ id: string; assetTag: string; locationId: string }> = optionsJson.data.availableAssets;

    if (users.length === 0 || locations.length === 0) {
      alert("Missing users or locations for checkout creation.");
      return;
    }

    const title = window.prompt("Checkout title", "New checkout");
    if (!title) return;

    const requesterName = window.prompt(
      `Requester (${users.slice(0, 10).map((u) => u.name).join(", ")})`,
      users[0].name
    );
    const requesterUserId = users.find((u) => u.name === requesterName)?.id ?? users[0].id;

    const locationName = window.prompt(
      `Location (${locations.map((l) => l.name).join(", ")})`,
      locations[0].name
    );
    const location = locations.find((l) => l.name === locationName) ?? locations[0];

    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const locationAssets = assets.filter((a) => a.locationId === location.id);
    const selectedAssetTag = window.prompt(
      `Optional asset tag (${locationAssets.slice(0, 10).map((a) => a.assetTag).join(", ")})`
    );
    const selectedAssetId = locationAssets.find((a) => a.assetTag === selectedAssetTag)?.id;

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          requesterUserId,
          locationId: location.id,
          startsAt,
          endsAt,
          serializedAssetIds: selectedAssetId ? [selectedAssetId] : [],
          bulkItems: []
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create checkout");
      }

      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create checkout");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Check-outs</h1>
        <button className="btn btn-primary" onClick={handleNewCheckout} disabled={submitting}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {submitting ? "Saving..." : "New check-out"}
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
