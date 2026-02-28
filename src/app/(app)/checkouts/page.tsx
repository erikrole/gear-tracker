"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

type CheckoutUser = { id: string; name: string };
type Location = { id: string; name: string };
type AssetOption = { id: string; assetTag: string; locationId: string };

type Response = { data: Checkout[]; total: number; limit: number; offset: number };

const statusBadge: Record<string, string> = {
  DRAFT: "badge-gray",
  OPEN: "badge-green",
  COMPLETED: "badge-purple",
  CANCELLED: "badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

export default function CheckoutsPage() {
  const [items, setItems] = useState<Checkout[]>([]);
  const [users, setUsers] = useState<CheckoutUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createLocationId, setCreateLocationId] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalDateTimeValue(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/checkouts?${params}`);
      if (res.ok) {
        const json: Response = await res.json();
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } catch { /* network error */ }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [page, statusFilter]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) return;
        setUsers(json.data.users || []);
        setLocations(json.data.locations || []);
        setAssets(json.data.availableAssets || []);
        setCreateLocationId(json.data.locations?.[0]?.id || "");
      });
  }, []);

  async function handleCreateCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const serializedAssetIds = form.getAll("serializedAssetIds").map(String).filter(Boolean);

    const payload = {
      title: String(form.get("title") || ""),
      requesterUserId: String(form.get("requesterUserId") || ""),
      locationId: String(form.get("locationId") || ""),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      serializedAssetIds,
      bulkItems: []
    };

    const res = await fetch("/api/checkouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create checkout");
      setSubmitting(false);
      return;
    }

    e.currentTarget.reset();
    setStartsAt(toLocalDateTimeValue(new Date()));
    setEndsAt(toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    setShowCreate(false);
    setSubmitting(false);
    await reload();
  }

  const locationAssets = useMemo(() => assets.filter((asset) => asset.locationId === createLocationId), [assets, createLocationId]);
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>Check-outs</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : "New check-out"}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2>Create check-out</h2></div>
          <form onSubmit={handleCreateCheckout} style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <input name="title" placeholder="Title" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <select name="requesterUserId" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">Requester</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select
              name="locationId"
              value={createLocationId}
              onChange={(e) => setCreateLocationId(e.target.value)}
              required
              style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}
            >
              <option value="">Location</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <input type="datetime-local" step={900} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input type="datetime-local" step={900} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <div />
            <select name="serializedAssetIds" multiple style={{ gridColumn: "span 3", minHeight: 120, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
              {locationAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag}</option>)}
            </select>
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--text-secondary)" }}>
              Use the date/time pickers and hold Ctrl/Cmd to select multiple serialized assets.
            </div>
            <div style={{ gridColumn: "span 3", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Saving..." : "Create check-out"}</button>
            </div>
            {error && <div style={{ gridColumn: "1 / -1", color: "var(--red)", fontSize: 13 }}>{error}</div>}
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>All check-outs</h2>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "white" }}
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
                      <td style={{ fontWeight: 500 }}><Link href={`/checkouts/${c.id}`} className="row-link">{c.title}</Link></td>
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
