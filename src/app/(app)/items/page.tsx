"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Asset = {
  id: string;
  assetTag: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  location: { name: string };
};

type Location = { id: string; name: string };

type Response = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
};

const statusBadge: Record<string, string> = {
  AVAILABLE: "badge-green",
  MAINTENANCE: "badge-orange",
  RETIRED: "badge-gray",
};

export default function ItemsPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  async function reload() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/assets?${params}`);
    const json: Response = await res.json();
    setItems(json.data);
    setTotal(json.total);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.json())
      .then((json) => setLocations(json.data.locations || []));
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

  return (
    <>
      <div className="page-header">
        <h1>Items</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : "Add item"}
        </button>
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
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
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
                  <th>Asset Tag</th>
                  <th>Brand / Model</th>
                  <th>Type</th>
                  <th>Serial Number</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}><Link href={`/items/${item.id}`} className="row-link">{item.assetTag}</Link></td>
                    <td>{item.brand} {item.model}</td>
                    <td>{item.type}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{item.serialNumber}</td>
                    <td>{item.location.name}</td>
                    <td>
                      <span className={`badge ${statusBadge[item.status] || "badge-gray"}`}>
                        {item.status.toLowerCase()}
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

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add new item">
        <form onSubmit={handleAddItem}>
          <div className="form-row">
            <div className="form-group">
              <label>Asset tag *</label>
              <input type="text" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Type *</label>
              <input type="text" value={type} onChange={(e) => setType(e.target.value)} required placeholder="e.g. camera, lens, tripod" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Brand *</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Model *</label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Serial number *</label>
              <input type="text" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>QR code value *</label>
              <input type="text" value={qrCodeValue} onChange={(e) => setQrCodeValue(e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Purchase date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Purchase price</label>
              <input type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Location *</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                <option value="">Select location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="AVAILABLE">Available</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {formError && <div className="form-error">{formError}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Add item"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
