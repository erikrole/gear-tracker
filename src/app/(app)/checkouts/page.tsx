"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";

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
type Location = { id: string; name: string };
type User = { id: string; name: string; email: string };
type Asset = { id: string; assetTag: string; brand: string; model: string; status: string };

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

  // Modal state
  const [showNew, setShowNew] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [requesterUserId, setRequesterUserId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const fetchCheckouts = useCallback(() => {
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

  useEffect(() => {
    fetchCheckouts();
  }, [fetchCheckouts]);

  function openNewModal() {
    setTitle("");
    setRequesterUserId("");
    setLocationId("");
    setStartsAt(new Date().toISOString().slice(0, 10));
    setEndsAt("");
    setSelectedAssetIds([]);
    setNotes("");
    setFormError("");
    setShowNew(true);

    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/assets?limit=200&status=AVAILABLE").then((r) => r.json()),
    ]).then(([locJson, userJson, assetJson]) => {
      setLocations(locJson.data);
      setUsers(userJson.data);
      setAssets(assetJson.data);
      if (locJson.data.length > 0) setLocationId(locJson.data[0].id);
      if (userJson.data.length > 0) setRequesterUserId(userJson.data[0].id);
    });
  }

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (selectedAssetIds.length === 0) {
      setFormError("Select at least one item");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          requesterUserId,
          locationId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          serializedAssetIds: selectedAssetIds,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setFormError(json.error || "Failed to create checkout");
        return;
      }
      setShowNew(false);
      fetchCheckouts();
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>Check-outs</h1>
        <button className="btn btn-primary" onClick={openNewModal}>
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

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New check-out">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Weekend shoot" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Requester *</label>
              <select value={requesterUserId} onChange={(e) => setRequesterUserId(e.target.value)} required>
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Location *</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                <option value="">Select location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start date *</label>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>End date *</label>
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Items ({selectedAssetIds.length} selected)</label>
            <div style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              maxHeight: 180,
              overflowY: "auto",
            }}>
              {assets.length === 0 ? (
                <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>No available items</div>
              ) : (
                assets.map((a) => (
                  <label
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 13,
                      borderBottom: "1px solid var(--border-light)",
                      background: selectedAssetIds.includes(a.id) ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.includes(a.id)}
                      onChange={() => toggleAsset(a.id)}
                    />
                    <span style={{ fontWeight: 600 }}>{a.assetTag}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{a.brand} {a.model}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create check-out"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
