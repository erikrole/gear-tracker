"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type ActiveBooking = {
  id: string;
  kind: string;
  title: string;
  requesterName: string;
};

type Asset = {
  id: string;
  assetTag: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  computedStatus: string;
  location: { id: string; name: string };
  activeBooking: ActiveBooking | null;
};

type Location = { id: string; name: string };

type Response = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
};

const statusDotColor: Record<string, string> = {
  AVAILABLE: "#22c55e",
  CHECKED_OUT: "#ef4444",
  RESERVED: "#a855f7",
  MAINTENANCE: "#f59e0b",
  RETIRED: "#9ca3af",
};

function StatusDot({ item }: { item: Asset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const hasBooking = item.activeBooking !== null;
  const label = item.computedStatus.replace("_", " ").toLowerCase();
  const bookingPath = item.activeBooking
    ? item.activeBooking.kind === "CHECKOUT"
      ? `/checkouts/${item.activeBooking.id}`
      : `/reservations/${item.activeBooking.id}`
    : null;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
      onMouseEnter={() => hasBooking && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        onClick={(e) => {
          if (hasBooking) { e.stopPropagation(); setOpen((v) => !v); }
        }}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: statusDotColor[item.computedStatus] || "#9ca3af",
          cursor: hasBooking ? "pointer" : "default",
        }}
      />
      {open && item.activeBooking && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
            padding: "8px 12px",
            whiteSpace: "nowrap",
            zIndex: 50,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2, textTransform: "capitalize" }}>{label}</div>
          <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
            {item.activeBooking.title} &middot; {item.activeBooking.requesterName}
          </div>
          {bookingPath && (
            <Link
              href={bookingPath}
              style={{ color: "var(--primary)", fontWeight: 500, textDecoration: "none" }}
            >
              View {item.activeBooking.kind === "CHECKOUT" ? "checkout" : "reservation"} &rarr;
            </Link>
          )}
        </div>
      )}
    </span>
  );
}

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const limit = 25;

  async function reload() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (locationFilter) params.set("location_id", locationFilter);

    try {
      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const json: Response = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch { /* network error */ }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [page, search, statusFilter, locationFilter]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setLocations(json.data?.locations || []); });
  }, []);

  async function handleCreateItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);

    const payload = {
      assetTag: String(form.get("assetTag") || ""),
      type: String(form.get("type") || "equipment"),
      brand: String(form.get("brand") || "Unknown"),
      model: String(form.get("model") || "Unknown"),
      serialNumber: String(form.get("serialNumber") || ""),
      qrCodeValue: String(form.get("qrCodeValue") || ""),
      locationId: String(form.get("locationId") || "")
    };

    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to create item");
      setSubmitting(false);
      return;
    }

    e.currentTarget.reset();
    setShowCreate(false);
    setSubmitting(false);
    await reload();
  }

  const totalPages = Math.ceil(total / limit);
  const rangeStart = total === 0 ? 0 : page * limit + 1;
  const rangeEnd = Math.min((page + 1) * limit, total);

  return (
    <>
      <div className="page-header">
        <h1>Items</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/import" className="btn">Import</Link>
          <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Close" : "New asset"}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2>Create item</h2></div>
          <form onSubmit={handleCreateItem} style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <input name="assetTag" placeholder="Asset tag" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="brand" placeholder="Brand" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="model" placeholder="Model" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="type" placeholder="Type" defaultValue="equipment" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="serialNumber" placeholder="Serial number" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="qrCodeValue" placeholder="QR code value" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <select name="locationId" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">Select location</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Saving..." : "Create item"}</button>
            </div>
            {error && <div style={{ gridColumn: "1 / -1", color: "var(--red)", fontSize: 13 }}>{error}</div>}
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ gap: 12 }}>
          <input
            type="text"
            placeholder="Search by tag, brand, model, serial..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{
              flex: 1,
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              outline: "none",
              fontSize: 13,
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            style={{
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              background: "white",
            }}
          >
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="CHECKED_OUT">Checked out</option>
            <option value="RESERVED">Reserved</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
          <select
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(0); }}
            style={{
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              background: "white",
            }}
          >
            <option value="">All locations</option>
            {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No items found</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th className="hide-mobile">Brand</th>
                  <th className="hide-mobile">Model</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/items/${item.id}`)}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <StatusDot item={item} />
                        <div>
                          <span className="row-link" style={{ fontWeight: 600 }}>
                            {item.assetTag}
                          </span>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {item.brand} {item.model}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{item.type}</td>
                    <td>{item.location.name}</td>
                    <td className="hide-mobile">{item.brand}</td>
                    <td className="hide-mobile">{item.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pagination">
              <span>Showing {rangeStart} to {rangeEnd} of {total}</span>
              {totalPages > 1 && (
                <div className="pagination-btns">
                  <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
