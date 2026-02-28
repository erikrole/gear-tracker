"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Reservation = {
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

type User = { id: string; name: string };
type Location = { id: string; name: string };
type AssetOption = { id: string; assetTag: string; locationId: string };

type Response = { data: Reservation[]; total: number; limit: number; offset: number };

const statusBadge: Record<string, string> = {
  DRAFT: "badge-gray",
  BOOKED: "badge-blue",
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

export default function ReservationsPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createLocationId, setCreateLocationId] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalDateTimeValue(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  async function reload() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    const res = await fetch(`/api/reservations?${params}`);
    const json: Response = await res.json();
    setItems(json.data);
    setTotal(json.total);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [page]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.json())
      .then((json) => {
        setUsers(json.data.users || []);
        setLocations(json.data.locations || []);
        setAssets(json.data.availableAssets || []);
        setCreateLocationId(json.data.locations?.[0]?.id || "");
      });
  }, []);

  async function handleCreateReservation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      title: String(form.get("title") || ""),
      requesterUserId: String(form.get("requesterUserId") || ""),
      locationId: String(form.get("locationId") || ""),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      serializedAssetIds: form.getAll("serializedAssetIds").map(String).filter(Boolean),
      bulkItems: []
    };

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create reservation");
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
        <h1>Reservations</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : "New reservation"}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2>Create reservation</h2></div>
          <form onSubmit={handleCreateReservation} style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <input name="title" placeholder="Title" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <select name="requesterUserId" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">Requester</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select name="locationId" value={createLocationId} onChange={(e) => setCreateLocationId(e.target.value)} required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
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
              <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create reservation"}</button>
            </div>
            {error && <div style={{ gridColumn: "1 / -1", color: "var(--red)" }}>{error}</div>}
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No reservations found</div>
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
                {items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}><Link href={`/reservations/${r.id}`} className="row-link">{r.title}</Link></td>
                    <td>{r.requester.name}</td>
                    <td>{formatDate(r.startsAt)} &ndash; {formatDate(r.endsAt)}</td>
                    <td>{r.location.name}</td>
                    <td>{r.serializedItems.length + r.bulkItems.length}</td>
                    <td>
                      <span className={`badge ${statusBadge[r.status] || "badge-gray"}`}>
                        {r.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
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
