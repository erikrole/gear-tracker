"use client";

import { FormEvent, useEffect, useState } from "react";

type BulkSku = {
  id: string;
  name: string;
  category: string;
  unit: string;
  binQrCodeValue: string;
  minThreshold: number;
  active: boolean;
  location?: { name: string };
  balances?: Array<{ onHandQuantity: number }>;
};

type Location = { id: string; name: string };

type Response = { data: BulkSku[]; total: number; limit: number; offset: number };

export default function BulkInventoryPage() {
  const [items, setItems] = useState<BulkSku[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const limit = 20;

  function reload() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    fetch(`/api/bulk-skus?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json: Response | null) => { if (json) { setItems(json.data ?? []); setTotal(json.total ?? 0); } })
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [page]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data?.locations) setLocations(json.data.locations); });
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      category: String(form.get("category") || ""),
      unit: String(form.get("unit") || ""),
      locationId: String(form.get("locationId") || ""),
      binQrCodeValue: String(form.get("binQrCodeValue") || ""),
      minThreshold: Number(form.get("minThreshold") || 0),
      initialQuantity: Number(form.get("initialQuantity") || 0),
      active: true,
    };

    const res = await fetch("/api/bulk-skus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create SKU");
      setSubmitting(false);
      return;
    }

    e.currentTarget.reset();
    setShowCreate(false);
    setSubmitting(false);
    reload();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>Bulk Inventory</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : (
            <>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add SKU
            </>
          )}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2>Add bulk SKU</h2></div>
          <form onSubmit={handleCreate} className="form-grid form-grid-3" style={{ padding: 16 }}>
            <input name="name" placeholder="Name" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="category" placeholder="Category" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="unit" placeholder="Unit (e.g. each, pair)" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <select name="locationId" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">Location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input name="binQrCodeValue" placeholder="Bin QR code value" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="minThreshold" type="number" min={0} defaultValue={0} placeholder="Min threshold" style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input name="initialQuantity" type="number" min={0} defaultValue={0} placeholder="Initial quantity" style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
            <div />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create SKU"}</button>
            </div>
            {error && <div style={{ gridColumn: "1 / -1", color: "var(--red)" }}>{error}</div>}
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No bulk SKUs found</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>On Hand</th>
                  <th>Min Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sku) => {
                  const onHand = sku.balances?.[0]?.onHandQuantity ?? 0;
                  const isLow = onHand <= sku.minThreshold && sku.minThreshold > 0;
                  return (
                    <tr key={sku.id}>
                      <td style={{ fontWeight: 500 }}>{sku.name}</td>
                      <td>{sku.category}</td>
                      <td>{sku.unit}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: isLow ? "var(--red)" : "inherit" }}>
                          {onHand}
                        </span>
                      </td>
                      <td>{sku.minThreshold}</td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-orange">low stock</span>
                        ) : (
                          <span className="badge badge-green">in stock</span>
                        )}
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
