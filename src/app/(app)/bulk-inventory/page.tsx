"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { useFetch } from "@/hooks/use-fetch";
import { useUrlState } from "@/hooks/use-url-state";
import { PlusIcon, ChevronDownIcon, AlertCircleIcon } from "lucide-react";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { FadeUp } from "@/components/ui/motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  allocations?: Array<{
    bookingBulkItem: {
      booking: {
        refNumber: string | null;
        title: string;
        requester: { name: string };
      };
    };
  }>;
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
  availableQuantity?: number;
  location?: { name: string };
  balances?: Array<{ onHandQuantity: number }>;
  units?: BulkSkuUnit[];
  categoryRel?: { id: string; name: string } | null;
};

import type { CategoryOption } from "@/types/category";
type Location = { id: string; name: string };

type BulkSkuResponse = { data: BulkSku[]; total: number; limit: number; offset: number };

const UNIT_STATUS_CLASSES: Record<string, { card: string; dot: string; label: string }> = {
  AVAILABLE: { card: "bg-[var(--green-bg)]", dot: "bg-[var(--green)]", label: "Available" },
  CHECKED_OUT: { card: "bg-[var(--blue-bg)]", dot: "bg-[var(--blue)]", label: "Checked Out" },
  LOST: { card: "bg-[var(--red-bg)]", dot: "bg-destructive", label: "Lost" },
  RETIRED: { card: "bg-muted", dot: "bg-muted-foreground", label: "Retired" },
};

export default function BulkInventoryPage() {
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const focusedSkuId = searchParams.get("sku");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [trackByNumber, setTrackByNumber] = useState(false);
  const [addingUnits, setAddingUnits] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(10);
  const [search, setSearch] = useUrlState<string>(
    "q",
    (v) => v ?? "",
    (v) => (v || null),
  );
  const limit = 20;

  // Data fetching via React Query (cached, auto-refresh on focus)
  const { data: skuData, loading, error: loadError, reload } = useFetch<BulkSkuResponse>({
    url: `/api/bulk-skus?limit=${limit}&offset=${page * limit}`,
    transform: (json) => json as unknown as BulkSkuResponse,
  });
  const items = skuData?.data ?? [];
  const total = skuData?.total ?? 0;

  // When navigated from the items list with ?sku=, scroll to and highlight that row
  useEffect(() => {
    if (!focusedSkuId || loading) return;
    const el = rowRefs.current[focusedSkuId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedSkuId, loading]);

  const { data: formOpts } = useFetch<{ locations: Location[] }>({
    url: "/api/form-options",
    transform: (json) => (json as { data: { locations: Location[] } }).data,
  });
  const locations = formOpts?.locations ?? [];

  const { data: categories } = useFetch<CategoryOption[]>({
    url: "/api/categories",
  });

  const { submit: submitCreate, submitting: createSubmitting, formError } = useFormSubmit({
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
    try {
      const res = await fetch(`/api/bulk-skus/${skuId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: addCount }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to add units");
        toast.error(msg);
        return;
      }
      toast.success(`Added ${addCount} units`);
      setAddingUnits(null);
      reload();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConvertToNumbered(skuId: string) {
    const ok = await confirm({
      title: "Convert to numbered tracking",
      message: "This will create individual unit records from the current on-hand quantity.",
      confirmLabel: "Convert",
    });
    if (!ok) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bulk-skus/${skuId}/convert-to-numbered`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to convert");
        toast.error(msg);
        return;
      }
      toast.success("Converted to numbered tracking");
      reload();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnitStatusChange(skuId: string, unitNumber: number, status: string) {
    try {
      const res = await fetch(`/api/bulk-skus/${skuId}/units/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to update unit");
        toast.error(msg);
        return;
      }
      reload();
    } catch {
      toast.error("Network error — try again");
    }
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
    <FadeUp>
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
                {(categories ?? []).filter((c) => !c.parentId).map((parent) => (
                  <SelectGroup key={parent.id}>
                    <SelectLabel>{parent.name}</SelectLabel>
                    {(categories ?? []).filter((c) => c.parentId === parent.id).map((child) => (
                      <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
                    ))}
                    {(categories ?? []).filter((c) => c.parentId === parent.id).length === 0 && (
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
                <div className="text-sm text-muted-foreground">
                  Number each unit individually for loss tracking
                </div>
              </Label>
            </div>

            {trackByNumber && (
              <div className="col-span-full text-sm rounded-lg bg-[var(--blue-bg)] px-3.5 py-2.5 text-[var(--blue-text)]">
                This will create individually numbered units. Make sure to physically label each item with its number.
              </div>
            )}

            <div className="col-span-full flex justify-end">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Create SKU"}</Button>
            </div>
            {formError && <div className="col-span-full text-destructive">{formError}</div>}
          </form>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center gap-2.5 flex-nowrap max-md:flex-wrap">
          <Input
            className="flex-1 min-w-[120px] max-w-full max-md:flex-[1_1_100%] max-md:min-w-0"
            type="text"
            placeholder="Search by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bulk SKUs by name or category"
          />
        </CardHeader>
        {loadError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription className="flex items-center gap-3">
                {loadError === "network" ? "Network error — check your connection" : "Failed to load bulk inventory"}
                <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="box"
            title={search ? `No results for "${search}"` : "No bulk SKUs yet"}
            description={search ? "Try a different search term or clear to see all SKUs." : "Add your first bulk SKU using the form above."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Available / On Hand</TableHead>
                  <TableHead>Min Threshold</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((sku) => {
                  const onHand = sku.balances?.[0]?.onHandQuantity ?? 0;
                  const available = sku.availableQuantity ?? (sku.trackByNumber ? (sku.units ?? []).filter((u) => u.status === "AVAILABLE").length : onHand);
                  const isLow = available <= sku.minThreshold && sku.minThreshold > 0;
                  const isExpanded = expandedSku === sku.id;
                  const units = sku.units ?? [];
                  const isFocused = focusedSkuId === sku.id;

                  return (
                    <TableRow
                      key={sku.id}
                      ref={(el) => { rowRefs.current[sku.id] = el; }}
                      className={[
                        sku.trackByNumber ? "cursor-pointer" : undefined,
                        isFocused ? "ring-2 ring-inset ring-primary/40 bg-primary/5 transition-colors" : undefined,
                      ].filter(Boolean).join(" ")}
                      onClick={() => sku.trackByNumber && setExpandedSku(isExpanded ? null : sku.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {sku.name}
                          {sku.trackByNumber && <Badge variant="blue" size="sm">#</Badge>}
                        </div>
                        {sku.trackByNumber && units.length > 0 && (
                          <div className="text-sm text-muted-foreground mt-1">
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
                      </TableCell>
                      <TableCell>{sku.categoryRel?.name || sku.category}</TableCell>
                      <TableCell>{sku.unit}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${isLow ? "text-destructive" : ""}`}>
                          {sku.trackByNumber
                            ? `${units.filter((u) => u.status === "AVAILABLE").length} / ${units.length}`
                            : `${available} / ${onHand}`}
                        </span>
                      </TableCell>
                      <TableCell>{sku.minThreshold}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {available === 0 ? (
                            <Badge variant="red">none available</Badge>
                          ) : isLow ? (
                            <Badge variant="orange">low stock</Badge>
                          ) : (
                            <Badge variant="green">in stock</Badge>
                          )}
                          {sku.trackByNumber && (
                            <ChevronDownIcon className={`size-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Expanded units grid */}
            {expandedSku && (() => {
              const sku = items.find((s) => s.id === expandedSku);
              if (!sku?.trackByNumber) return null;
              const units = sku.units ?? [];

              return (
                <div className="p-4 border-t border-border bg-[var(--bg)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="m-0 text-base font-semibold">{sku.name} — Units</h3>
                    {addingUnits === sku.id ? (
                      <div className="flex items-center gap-2">
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
                        const colors = UNIT_STATUS_CLASSES[u.status];
                        const lastAlloc = u.allocations?.[0]?.bookingBulkItem?.booking;
                        const lastUser = lastAlloc?.requester?.name;
                        const lastRef = lastAlloc?.refNumber || lastAlloc?.title;
                        const lastInfo = lastUser ? ` · Last: ${lastUser}${lastRef ? ` (${lastRef})` : ""}` : "";
                        return (
                          <div
                            key={u.id}
                            title={`#${u.unitNumber} — ${colors.label}${lastInfo}${u.notes ? ` · ${u.notes}` : ""}`}
                            className={`flex flex-col items-center justify-center gap-0 px-1 py-1 rounded-md text-sm font-semibold relative ${colors.card} ${u.status !== "CHECKED_OUT" ? "cursor-pointer" : "cursor-default"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (u.status === "CHECKED_OUT") return;
                              const next = u.status === "AVAILABLE" ? "LOST"
                                : u.status === "LOST" ? "RETIRED"
                                : "AVAILABLE";
                              handleUnitStatusChange(sku.id, u.unitNumber, next);
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <div className={`size-1.5 rounded-full shrink-0 ${colors.dot}`} />
                              {u.unitNumber}
                            </div>
                            {u.status === "LOST" && lastUser && (
                              <div className="text-[9px] font-normal text-muted-foreground truncate max-w-full leading-tight">
                                {lastUser.split(" ")[0]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-2.5 text-sm text-muted-foreground">
                    Click a unit to cycle status: Available &rarr; Lost &rarr; Retired &rarr; Available
                  </div>
                </div>
              );
            })()}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
                <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPage(page - 1)} aria-disabled={page === 0} className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={() => setPage(page + 1)} aria-disabled={page >= totalPages - 1} className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card>
    </FadeUp>
  );
}
