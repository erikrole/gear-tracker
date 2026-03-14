"use client";

import { FormEvent, useEffect, useState } from "react";

type BulkSkuUnit = {
  id: string;
  unitNumber: number;
  status: "AVAILABLE" | "CHECKED_OUT" | "LOST" | "RETIRED";
  notes: string | null;
};

type BulkSku = {
  id: string;
  name: string;
  category: string;
  unit: string;
  binQrCodeValue: string;
  minThreshold: number;
  trackByNumber: boolean;
  active: boolean;
  location?: { name: string };
  balances?: Array<{ onHandQuantity: number }>;
  units?: BulkSkuUnit[];
};

type Location = { id: string; name: string };

type Response = { data: BulkSku[]; total: number; limit: number; offset: number };

const UNIT_STATUS_COLORS: Record<string, { bg: string; dot: string; label: string }> = {
  AVAILABLE: { bg: "#dcfce7", dot: "#22c55e", label: "Available" },
  CHECKED_OUT: { bg: "#dbeafe", dot: "#3b82f6", label: "Checked Out" },
  LOST: { bg: "#fee2e2", dot: "#ef4444", label: "Lost" },
  RETIRED: { bg: "#f3f4f6", dot: "#9ca3af", label: "Retired" },
};

export default function BulkInventoryPage() {
  const [items, setItems] = useState<BulkSku[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [trackByNumber, setTrackByNumber] = useState(false);
  const [addingUnits, setAddingUnits] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(10);
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
      trackByNumber,
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
    setTrackByNumber(false);
    setShowCreate(false);
    setSubmitting(false);
    reload();
  }

  async function handleAddUnits(skuId: string) {
    if (addCount <= 0) return;
    setSubmitting(true);
    const res = await fetch(`/api/bulk-skus/${skuId}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: addCount }),
    });
    if (res.ok) {
      setAddingUnits(null);
      reload();
    }
    setSubmitting(false);
  }

  async function handleUnitStatusChange(skuId: string, unitNumber: number, status: string) {
    await fetch(`/api/bulk-skus/${skuId}/units/${unitNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  const totalPages = Math.ceil(total / limit);

  function unitSummary(units: BulkSkuUnit[]) {
    const available = units.filter((u) => u.status === "AVAILABLE").length;
    const checkedOut = units.filter((u) => u.status === "CHECKED_OUT").length;
    const lost = units.filter((u) => u.status === "LOST").length;
    const retired = units.filter((u) => u.status === "RETIRED").length;
    const parts: string[] = [];
    if (available > 0) parts.push(`${available} available`);
    if (checkedOut > 0) parts.push(`${checkedOut} out`);
    if (lost > 0) parts.push(`${lost} lost`);
    if (retired > 0) parts.push(`${retired} retired`);
    return parts.join(" \u00b7 ");
  }

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

            {/* Track by number toggle */}
            <label style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              cursor: "pointer",
              userSelect: "none",
            }}>
              <div
                role="switch"
                aria-checked={trackByNumber}
                onClick={() => setTrackByNumber(!trackByNumber)}
                onKeyDown={(e) => e.key === "Enter" && setTrackByNumber(!trackByNumber)}
                tabIndex={0}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: trackByNumber ? "#3b82f6" : "#d1d5db",
                  position: "relative", transition: "background 0.2s",
                  flexShrink: 0, cursor: "pointer",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "white", position: "absolute",
                  top: 2, left: trackByNumber ? 20 : 2,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Track by number</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Number each unit individually for loss tracking
                </div>
              </div>
            </label>

            {trackByNumber && (
              <div style={{
                gridColumn: "1 / -1",
                padding: "10px 14px",
                background: "#eff6ff",
                borderRadius: 8,
                fontSize: 13,
                color: "#1e40af",
              }}>
                This will create individually numbered units. Make sure to physically label each item with its number.
              </div>
            )}

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
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
                  const isExpanded = expandedSku === sku.id;
                  const units = sku.units ?? [];

                  return (
                    <tr key={sku.id} style={{ cursor: sku.trackByNumber ? "pointer" : undefined }}
                      onClick={() => sku.trackByNumber && setExpandedSku(isExpanded ? null : sku.id)}
                    >
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {sku.name}
                          {sku.trackByNumber && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 6px",
                              borderRadius: 4, background: "#eff6ff", color: "#3b82f6",
                            }}>#</span>
                          )}
                        </div>
                        {sku.trackByNumber && units.length > 0 && (
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                            {unitSummary(units)}
                          </div>
                        )}
                      </td>
                      <td>{sku.category}</td>
                      <td>{sku.unit}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: isLow ? "var(--red)" : "inherit" }}>
                          {sku.trackByNumber ? `${units.filter((u) => u.status === "AVAILABLE").length}/${units.length}` : onHand}
                        </span>
                      </td>
                      <td>{sku.minThreshold}</td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-orange">low stock</span>
                        ) : (
                          <span className="badge badge-green">in stock</span>
                        )}
                        {sku.trackByNumber && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            style={{ marginLeft: 8, color: "var(--text-secondary)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Expanded units grid */}
            {expandedSku && (() => {
              const sku = items.find((s) => s.id === expandedSku);
              if (!sku?.trackByNumber) return null;
              const units = sku.units ?? [];

              return (
                <div style={{ padding: 16, borderTop: "1px solid var(--border)", background: "#fafbfc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{sku.name} — Units</h3>
                    {addingUnits === sku.id ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="number" min={1} max={500} value={addCount}
                          onChange={(e) => setAddCount(Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 70, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 14 }}
                        />
                        <button className="btn btn-sm btn-primary" disabled={submitting}
                          onClick={(e) => { e.stopPropagation(); handleAddUnits(sku.id); }}>
                          {submitting ? "..." : "Add"}
                        </button>
                        <button className="btn btn-sm"
                          onClick={(e) => { e.stopPropagation(); setAddingUnits(null); }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-sm"
                        onClick={(e) => { e.stopPropagation(); setAddingUnits(sku.id); }}>
                        Add more units
                      </button>
                    )}
                  </div>

                  {units.length === 0 ? (
                    <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>No units created yet.</div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                      gap: 6,
                    }}>
                      {units.map((u) => {
                        const colors = UNIT_STATUS_COLORS[u.status];
                        return (
                          <div
                            key={u.id}
                            title={`#${u.unitNumber} — ${colors.label}${u.notes ? ` (${u.notes})` : ""}`}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              gap: 4, padding: "6px 4px",
                              background: colors.bg, borderRadius: 6,
                              fontSize: 13, fontWeight: 600,
                              cursor: u.status !== "CHECKED_OUT" ? "pointer" : "default",
                              position: "relative",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (u.status === "CHECKED_OUT") return;
                              const next = u.status === "AVAILABLE" ? "LOST"
                                : u.status === "LOST" ? "RETIRED"
                                : "AVAILABLE";
                              handleUnitStatusChange(sku.id, u.unitNumber, next);
                            }}
                          >
                            <div style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: colors.dot, flexShrink: 0,
                            }} />
                            {u.unitNumber}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                    Click a unit to cycle status: Available &rarr; Lost &rarr; Retired &rarr; Available
                  </div>
                </div>
              );
            })()}

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
