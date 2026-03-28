"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { PlusIcon, ChevronDownIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

import type { CategoryOption } from "@/types/category";
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
  const [actionLoading, setActionLoading] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
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

  const { submit: submitCreate, submitting: createSubmitting, formError, clearErrors } = useFormSubmit({
    url: "/api/bulk-skus",
    successMessage: "SKU created",
    onSuccess: () => {
      createFormRef.current?.reset();
      setTrackByNumber(false);
      setShowCreate(false);
      reload();
    },
  });

  const submitting = createSubmitting || actionLoading;

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const rawCategoryId = String(form.get("categoryId") || "");
    const selectedCategoryId = rawCategoryId === "__none__" ? "" : rawCategoryId;
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

    await submitCreate(payload);
  }

  async function handleAddUnits(skuId: string) {
    if (addCount <= 0) return;
    setActionLoading(true);
    const res = await fetch(`/api/bulk-skus/${skuId}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: addCount }),
    });
    if (res.ok) {
      setAddingUnits(null);
      reload();
    }
    setActionLoading(false);
  }

  async function handleConvertToNumbered(skuId: string) {
    if (!confirm("Convert this SKU to numbered tracking? This will create individual unit records from the current on-hand quantity.")) return;
    setActionLoading(true);
    const res = await fetch(`/api/bulk-skus/${skuId}/convert-to-numbered`, { method: "POST" });
    if (res.ok) reload();
    setActionLoading(false);
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
      <PageHeader title="Bulk Inventory">
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : (
            <>
              <PlusIcon className="size-3.5" />
              Add SKU
            </>
          )}
        </Button>
      </PageHeader>

      {showCreate && (
        <Card className="mb-1">
          <CardHeader><CardTitle>Add bulk SKU</CardTitle></CardHeader>
          <form ref={createFormRef} onSubmit={handleCreate} className="form-grid form-grid-3 p-4">
            <Input name="name" placeholder="Name" required />
            <Select name="categoryId" defaultValue="__none__">
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Category</SelectItem>
                {categories.filter((c) => !c.parentId).map((parent) => (
                  <SelectGroup key={parent.id}>
                    <SelectLabel>{parent.name}</SelectLabel>
                    {categories.filter((c) => c.parentId === parent.id).map((child) => (
                      <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
                    ))}
                    {categories.filter((c) => c.parentId === parent.id).length === 0 && (
                      <SelectItem value={parent.id}>{parent.name}</SelectItem>
                    )}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <input name="category" type="hidden" defaultValue="general" />
            <Input name="unit" placeholder="Unit (e.g. each, pair)" required />
            <Select name="locationId" required defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input name="binQrCodeValue" placeholder="Bin QR code value" required />
            <Input name="minThreshold" type="number" min={0} defaultValue={0} placeholder="Min threshold" />
            <Input name="initialQuantity" type="number" min={0} defaultValue={0} placeholder="Initial quantity" />

            {/* Track by number toggle */}
            <div className="col-span-full flex items-center gap-3 py-2">
              <Switch
                id="trackByNumber"
                checked={trackByNumber}
                onCheckedChange={setTrackByNumber}
              />
              <Label htmlFor="trackByNumber" className="cursor-pointer">
                <div className="font-semibold text-base">Track by number</div>
                <div className="text-sm text-secondary">
                  Number each unit individually for loss tracking
                </div>
              </Label>
            </div>

            {trackByNumber && (
              <div className="col-span-full text-sm rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3.5 py-2.5 text-blue-800 dark:text-blue-300">
                This will create individually numbered units. Make sure to physically label each item with its number.
              </div>
            )}

            <div className="col-span-full flex-end">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create SKU"}</Button>
            </div>
            {formError && <div className="col-span-full text-destructive">{formError}</div>}
          </form>
        </Card>
      )}

      <Card>
        <CardHeader className="!flex !flex-row items-center gap-2.5 flex-nowrap max-md:flex-wrap">
          <Input
            className="flex-1 min-w-[120px] max-w-full max-md:flex-[1_1_100%] max-md:min-w-0"
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
                        <div className="flex-center gap-1.5">
                          {sku.name}
                          {sku.trackByNumber && (
                            <Badge variant="blue" size="sm">#</Badge>
                          )}
                        </div>
                        {sku.trackByNumber && units.length > 0 && (
                          <div className="text-sm text-secondary mt-2">
                            {unitSummary(units)}
                          </div>
                        )}
                        {!sku.trackByNumber && (
                          <Button
                            variant="outline" size="sm" className="mt-1 text-xs px-2 py-0.5"
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
                        <span className={`font-semibold ${isLow ? "text-red" : ""}`}>
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
                          <ChevronDownIcon className={`ml-2 size-3 text-secondary transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
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
                <div className="p-4 border-t border-border bg-[var(--bg)]">
                  <div className="flex-between mb-3">
                    <h3 className="m-0 text-md">{sku.name} — Units</h3>
                    {addingUnits === sku.id ? (
                      <div className="flex-center gap-2">
                        <Input
                          type="number" min={1} max={500} value={addCount}
                          onChange={(e) => setAddCount(Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[70px] px-2 py-1"
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
                    <div className="py-4 text-center text-sm text-muted-foreground">No units created yet. Click &ldquo;Add more units&rdquo; to get started.</div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
                      {units.map((u) => {
                        const colors = UNIT_STATUS_COLORS[u.status];
                        return (
                          <div
                            key={u.id}
                            title={`#${u.unitNumber} — ${colors.label}${u.notes ? ` (${u.notes})` : ""}`}
                            className={`flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-sm font-semibold relative ${u.status !== "CHECKED_OUT" ? "cursor-pointer" : "cursor-default"}`}
                            style={{ background: colors.bg }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (u.status === "CHECKED_OUT") return;
                              const next = u.status === "AVAILABLE" ? "LOST"
                                : u.status === "LOST" ? "RETIRED"
                                : "AVAILABLE";
                              handleUnitStatusChange(sku.id, u.unitNumber, next);
                            }}
                          >
                            <div className="size-1.5 rounded-full shrink-0" style={{ background: colors.dot }} />
                            {u.unitNumber}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-2.5 text-sm text-secondary">
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
