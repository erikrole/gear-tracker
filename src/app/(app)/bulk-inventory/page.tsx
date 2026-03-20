"use client";

import { FormEvent, useEffect, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  categoryRel?: { id: string; name: string } | null;
};

type Location = { id: string; name: string };
type CategoryOption = { id: string; name: string; parentId: string | null };

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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState("");
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
    fetch("/api/categories")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setCategories(json.data); });
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const selectedCategoryId = String(form.get("categoryId") || "");
    const payload = {
      name: String(form.get("name") || ""),
      category: String(form.get("category") || "general"),
      ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
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

  async function handleConvertToNumbered(skuId: string) {
    if (!confirm("Convert this SKU to numbered tracking? This will create individual unit records from the current on-hand quantity.")) return;
    setSubmitting(true);
    const res = await fetch(`/api/bulk-skus/${skuId}/convert-to-numbered`, { method: "POST" });
    if (res.ok) reload();
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

  const filteredItems = items.filter((sku) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const catName = sku.categoryRel?.name || sku.category;
    return sku.name.toLowerCase().includes(q) || catName.toLowerCase().includes(q);
  });

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
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : (
            <>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add SKU
            </>
          )}
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-16">
          <CardHeader><CardTitle>Add bulk SKU</CardTitle></CardHeader>
          <form onSubmit={handleCreate} className="form-grid form-grid-3 p-16">
            <Input name="name" placeholder="Name" required />
            <select name="categoryId" className="form-select">
              <option value="">Category</option>
              {categories.filter((c) => !c.parentId).map((parent) => (
                <optgroup key={parent.id} label={parent.name}>
                  {categories.filter((c) => c.parentId === parent.id).map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                  {categories.filter((c) => c.parentId === parent.id).length === 0 && (
                    <option value={parent.id}>{parent.name}</option>
                  )}
                </optgroup>
              ))}
            </select>
            <input name="category" type="hidden" defaultValue="general" />
            <Input name="unit" placeholder="Unit (e.g. each, pair)" required />
            <select name="locationId" required className="form-select">
              <option value="">Location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <Input name="binQrCodeValue" placeholder="Bin QR code value" required />
            <Input name="minThreshold" type="number" min={0} defaultValue={0} placeholder="Min threshold" />
            <Input name="initialQuantity" type="number" min={0} defaultValue={0} placeholder="Initial quantity" />

            {/* Track by number toggle */}
            <label className="col-span-full flex-center gap-10 cursor-pointer" style={{ padding: "8px 0", userSelect: "none" }}>
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
                <div className="font-semibold text-base">Track by number</div>
                <div className="text-sm text-secondary">
                  Number each unit individually for loss tracking
                </div>
              </div>
            </label>

            {trackByNumber && (
              <div className="col-span-full text-sm" style={{
                padding: "10px 14px",
                background: "#eff6ff",
                borderRadius: 8,
                color: "#1e40af",
              }}>
                This will create individually numbered units. Make sure to physically label each item with its number.
              </div>
            )}

            <div className="col-span-full flex-end">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create SKU"}</Button>
            </div>
            {error && <div className="col-span-full text-red">{error}</div>}
          </form>
        </Card>
      )}

      <Card>
        <CardHeader className="filter-chip-bar">
          <Input
            className="filter-chip-search"
            type="text"
            placeholder="Search by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : filteredItems.length === 0 ? (
          <EmptyState icon="box" title="No bulk SKUs found" description={search ? "Try adjusting your search." : "Add your first bulk SKU above."} />
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
                {filteredItems.map((sku) => {
                  const onHand = sku.balances?.[0]?.onHandQuantity ?? 0;
                  const isLow = onHand <= sku.minThreshold && sku.minThreshold > 0;
                  const isExpanded = expandedSku === sku.id;
                  const units = sku.units ?? [];

                  return (
                    <tr key={sku.id} style={{ cursor: sku.trackByNumber ? "pointer" : undefined }}
                      onClick={() => sku.trackByNumber && setExpandedSku(isExpanded ? null : sku.id)}
                    >
                      <td className="font-medium">
                        <div className="flex-center gap-6">
                          {sku.name}
                          {sku.trackByNumber && (
                            <span style={{
                              fontSize: "var(--text-2xs)", fontWeight: 600, padding: "2px 6px",
                              borderRadius: 4, background: "#eff6ff", color: "#3b82f6",
                            }}>#</span>
                          )}
                        </div>
                        {sku.trackByNumber && units.length > 0 && (
                          <div className="text-sm text-secondary mt-2">
                            {unitSummary(units)}
                          </div>
                        )}
                        {!sku.trackByNumber && (
                          <Button
                            variant="outline" size="sm" className="mt-4"
                            style={{ fontSize: "var(--text-3xs)", padding: "2px 8px" }}
                            onClick={(e) => { e.stopPropagation(); handleConvertToNumbered(sku.id); }}
                            disabled={submitting}
                          >
                            Convert to numbered
                          </Button>
                        )}
                      </td>
                      <td>{sku.categoryRel?.name || sku.category}</td>
                      <td>{sku.unit}</td>
                      <td>
                        <span className="font-semibold" style={{ color: isLow ? "var(--red)" : "inherit" }}>
                          {sku.trackByNumber ? `${units.filter((u) => u.status === "AVAILABLE").length}/${units.length}` : onHand}
                        </span>
                      </td>
                      <td>{sku.minThreshold}</td>
                      <td>
                        {isLow ? (
                          <Badge variant="orange">low stock</Badge>
                        ) : (
                          <Badge variant="green">in stock</Badge>
                        )}
                        {sku.trackByNumber && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className="ml-8 text-secondary" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
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
                <div className="p-16" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
                  <div className="flex-between mb-12">
                    <h3 className="m-0" style={{ fontSize: "var(--text-md)" }}>{sku.name} — Units</h3>
                    {addingUnits === sku.id ? (
                      <div className="flex-center gap-8">
                        <input
                          type="number" min={1} max={500} value={addCount}
                          onChange={(e) => setAddCount(Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 70, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "var(--text-base)" }}
                        />
                        <Button size="sm" disabled={submitting}
                          onClick={(e) => { e.stopPropagation(); handleAddUnits(sku.id); }}>
                          {submitting ? "..." : "Add"}
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={(e) => { e.stopPropagation(); setAddingUnits(null); }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm"
                        onClick={(e) => { e.stopPropagation(); setAddingUnits(sku.id); }}>
                        Add more units
                      </Button>
                    )}
                  </div>

                  {units.length === 0 ? (
                    <div className="text-secondary text-base">No units created yet.</div>
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
                              fontSize: "var(--text-sm)", fontWeight: 600,
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

                  <div className="mt-10 text-sm text-secondary">
                    Click a unit to cycle status: Available &rarr; Lost &rarr; Retired &rarr; Available
                  </div>
                </div>
              );
            })()}

            {totalPages > 1 && (
              <div className="pagination">
                <span>Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
                <div className="pagination-btns">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
