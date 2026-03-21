"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { AlertCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Asset, getColumns } from "./columns";
import { DataTable } from "./data-table";
import { FacetedFilter } from "./faceted-filter";

type CategoryOption = { id: string; name: string; parentId: string | null };
type Location = { id: string; name: string };

type Response = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
};

type ItemKind = "serialized" | "bulk";

function CreateItemCard({
  locations,
  categories,
  onCreated,
  onClose,
}: {
  locations: Location[];
  categories: CategoryOption[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ItemKind>("serialized");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);

    try {
      let res: globalThis.Response;
      if (kind === "serialized") {
        const notes: Record<string, string> = {};
        const desc = String(form.get("description") || "").trim();
        const owner = String(form.get("owner") || "").trim();
        if (desc) notes.description = desc;
        if (owner) notes.owner = owner;

        const rawCategoryId = String(form.get("categoryId") || "");
        const categoryId = rawCategoryId === "__none__" ? "" : rawCategoryId;
        const itemName = String(form.get("itemName") || "").trim();
        res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetTag: String(form.get("assetTag") || ""),
            type: String(form.get("type") || "equipment"),
            brand: String(form.get("brand") || ""),
            model: String(form.get("model") || ""),
            serialNumber: String(form.get("serialNumber") || ""),
            qrCodeValue: String(form.get("qrCodeValue") || ""),
            locationId: String(form.get("locationId") || ""),
            ...(categoryId ? { categoryId } : {}),
            ...(itemName ? { name: itemName } : {}),
            ...(Object.keys(notes).length ? { notes: JSON.stringify(notes) } : {}),
          }),
        });
      } else {
        const rawBulkCategoryId = String(form.get("categoryId") || "");
        const bulkCategoryId = rawBulkCategoryId === "__none__" ? "" : rawBulkCategoryId;
        res = await fetch("/api/bulk-skus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name") || ""),
            category: String(form.get("category") || "general"),
            ...(bulkCategoryId ? { categoryId: bulkCategoryId } : {}),
            unit: String(form.get("unit") || ""),
            locationId: String(form.get("locationId") || ""),
            binQrCodeValue: String(form.get("binQrCodeValue") || ""),
            initialQuantity: parseInt(String(form.get("initialQuantity") || "0"), 10),
            minThreshold: parseInt(String(form.get("minThreshold") || "0"), 10),
          }),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create item");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      onClose();
      onCreated();
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>New item</CardTitle>
        <div className="flex gap-4">
          {(["serialized", "bulk"] as const).map((k) => (
            <Button
              key={k}
              type="button"
              variant={kind === k ? "default" : "outline"}
              size="sm"
              onClick={() => { setKind(k); setError(""); }}
            >
              {k === "serialized" ? "Serialized" : "Bulk"}
            </Button>
          ))}
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} className="px-6 pb-6">
        {kind === "serialized" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Input name="assetTag" placeholder="Tag name *" required />
              <Input name="itemName" placeholder="Product name" />
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
              <input name="type" type="hidden" defaultValue="equipment" />
              <Select name="locationId" required defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Location *" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input name="brand" placeholder="Brand *" required />
              <Input name="model" placeholder="Model *" required />
              <Input name="serialNumber" placeholder="Serial number *" required />
              <Input name="qrCodeValue" placeholder="QR code value *" required />
            </div>

            <Button
              type="button"
              variant="link"
              onClick={() => setShowMeta((v) => !v)}
              className="mt-3"
            >
              {showMeta ? "Hide" : "Show"} optional fields
            </Button>

            {showMeta && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
                <Input name="description" placeholder="Description" />
                <Input name="owner" placeholder="Owner" />
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <Input name="name" placeholder="Product name *" required />
              <p className="text-muted-foreground text-xs mt-1">e.g. &ldquo;AA Batteries&rdquo;, &ldquo;USB-C Cables&rdquo;</p>
            </div>
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
            <div>
              <Input name="unit" placeholder="Unit (e.g. ea, box) *" required />
              <p className="text-muted-foreground text-xs mt-1">How you count them: ea, box, pack, pair, roll</p>
            </div>
            <Select name="locationId" required defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="Location *" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div>
              <Input name="binQrCodeValue" placeholder="Bin QR code *" required />
              <p className="text-muted-foreground text-xs mt-1">Scan or type the QR code on the storage bin</p>
            </div>
            <div>
              <Input name="initialQuantity" type="number" min="0" defaultValue="0" placeholder="Initial qty" />
              <p className="text-muted-foreground text-xs mt-1">How many are on hand right now</p>
            </div>
            <div>
              <Input name="minThreshold" type="number" min="0" defaultValue="0" placeholder="Min threshold" />
              <p className="text-muted-foreground text-xs mt-1">Alert when stock falls below this</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3.5">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : kind === "serialized" ? "Create asset" : "Create bulk item"}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </form>
    </Card>
  );
}


function BulkActionBar({
  count,
  locations,
  categoryOptions,
  busy,
  error,
  onAction,
  onClear,
}: {
  count: number;
  locations: Location[];
  categoryOptions: { value: string; label: string }[];
  busy: boolean;
  error: string;
  onAction: (action: string, payload?: Record<string, string | null>) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 w-full flex-wrap">
      <span className="text-sm font-semibold">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>Clear</Button>
      <div className="flex-1" />

      {/* Move location */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>Move location</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-[180px] max-h-[240px] overflow-y-auto p-1">
          {locations.map((l) => (
            <Button key={l.id} variant="ghost" size="sm" className="w-full justify-start font-normal"
              onClick={() => onAction("move_location", { locationId: l.id })}>
              {l.name}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Change category */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>Change category</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-[200px] max-h-[240px] overflow-y-auto p-1">
          <Button variant="ghost" size="sm" className="w-full justify-start font-normal italic"
            onClick={() => onAction("change_category", { categoryId: null })}>
            None
          </Button>
          {categoryOptions.map((c) => (
            <Button key={c.value} variant="ghost" size="sm" className="w-full justify-start font-normal"
              onClick={() => onAction("change_category", { categoryId: c.value })}>
              {c.label}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" onClick={() => onAction("maintenance")} disabled={busy}>
        Maintenance
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(`Retire ${count} item${count > 1 ? "s" : ""}?`)) onAction("retire"); }} disabled={busy}>
        Retire
      </Button>

      {busy && <span className="text-sm text-muted">Processing...</span>}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "CHECKED_OUT", label: "Checked out" },
  { value: "RESERVED", label: "Reserved" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "RETIRED", label: "Retired" },
];

export default function ItemsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page") ?? "", 10);
    return Number.isFinite(p) && p > 0 ? p : 0;
  });
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => {
    const vals = searchParams.getAll("status").filter(Boolean);
    return new Set(vals);
  });
  const [locationFilter, setLocationFilter] = useState<Set<string>>(() => {
    const vals = searchParams.getAll("location").filter(Boolean);
    return new Set(vals);
  });
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(() => {
    const vals = searchParams.getAll("category").filter(Boolean);
    return new Set(vals);
  });
  const [brandFilter, setBrandFilter] = useState<Set<string>>(() => {
    const vals = searchParams.getAll("brand").filter(Boolean);
    return new Set(vals);
  });
  const [departmentFilter, setDepartmentFilter] = useState<Set<string>>(() => {
    const vals = searchParams.getAll("department").filter(Boolean);
    return new Set(vals);
  });
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [limit, setLimit] = useState(25);
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";
  const router = useRouter();

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const hasActiveFilters = statusFilter.size > 0 || locationFilter.size > 0 || categoryFilter.size > 0 || brandFilter.size > 0 || departmentFilter.size > 0;

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sync filters to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    statusFilter.forEach((v) => params.append("status", v));
    locationFilter.forEach((v) => params.append("location", v));
    categoryFilter.forEach((v) => params.append("category", v));
    brandFilter.forEach((v) => params.append("brand", v));
    departmentFilter.forEach((v) => params.append("department", v));
    if (page > 0) params.set("page", String(page));
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter, page]);

  // Serialize a Set to stable string for dependency tracking
  const statusKey = [...statusFilter].sort().join(",");
  const locationKey = [...locationFilter].sort().join(",");
  const categoryKey = [...categoryFilter].sort().join(",");
  const brandKey = [...brandFilter].sort().join(",");
  const departmentKey = [...departmentFilter].sort().join(",");

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (debouncedSearch) params.set("q", debouncedSearch);
    statusKey.split(",").filter(Boolean).forEach((v) => params.append("status", v));
    locationKey.split(",").filter(Boolean).forEach((v) => params.append("location_id", v));
    categoryKey.split(",").filter(Boolean).forEach((v) => params.append("category_id", v));
    brandKey.split(",").filter(Boolean).forEach((v) => params.append("brand", v));
    departmentKey.split(",").filter(Boolean).forEach((v) => params.append("department_id", v));

    try {
      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) { setLoadError(true); setLoading(false); return; }
      const json: Response = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [page, limit, debouncedSearch, statusKey, locationKey, categoryKey, brandKey, departmentKey]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); })
      .catch(() => {});
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json) {
          setLocations(json.data?.locations || []);
          setDepartments(json.data?.departments || []);
        }
      })
      .catch(() => {});
    fetch("/api/categories")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setCategories(json.data || []); })
      .catch(() => {});
    fetch("/api/assets/brands")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setBrands(json.data); })
      .catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);

  // Build flat category options for the chip dropdown
  const categoryOptions = categories
    .filter((c) => !c.parentId)
    .flatMap((parent) => {
      const children = categories.filter((c) => c.parentId === parent.id);
      if (children.length === 0) return [{ value: parent.id, label: parent.name }];
      return children.map((child) => ({ value: child.id, label: `${parent.name} / ${child.name}` }));
    });

  function clearAllFilters() {
    setStatusFilter(new Set());
    setLocationFilter(new Set());
    setCategoryFilter(new Set());
    setBrandFilter(new Set());
    setDepartmentFilter(new Set());
    setPage(0);
  }

  // Clear selection when page/filters change
  useEffect(() => { setRowSelection({}); }, [page, debouncedSearch, statusKey, locationKey, categoryKey, brandKey, departmentKey]);

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;

  async function executeBulkAction(action: string, payload?: Record<string, string | null>) {
    setBulkBusy(true);
    setBulkError("");
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json();
        setBulkError(json.error || "Bulk action failed");
        setBulkBusy(false);
        return;
      }
      setRowSelection({});
      setBulkBusy(false);
      reload();
    } catch {
      setBulkError("Network error");
      setBulkBusy(false);
    }
  }

  const handleRowAction = useCallback(async (action: string, asset: Asset) => {
    switch (action) {
      case "open":
        router.push(`/items/${asset.id}`);
        break;
      case "duplicate":
        try {
          const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
          if (res.ok) reload();
        } catch { /* ignore */ }
        break;
      case "maintenance":
        try {
          const res = await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
          if (res.ok) reload();
        } catch { /* ignore */ }
        break;
      case "retire":
        if (confirm(`Retire ${asset.assetTag}?`)) {
          try {
            const res = await fetch(`/api/assets/${asset.id}/retire`, { method: "POST" });
            if (res.ok) reload();
          } catch { /* ignore */ }
        }
        break;
    }
  }, [reload, router]);

  const columns = useMemo(
    () => getColumns({ canEdit, onRowAction: handleRowAction }),
    [canEdit, handleRowAction]
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Items</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/import">Import</Link></Button>
            <Button onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Close" : "New item"}
            </Button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateItemCard
          locations={locations}
          categories={categories}
          onCreated={reload}
          onClose={() => setShowCreate(false)}
        />
      )}

      <div className="space-y-4">
        {/* Table */}
        {loading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {Array.from({ length: 5 }, (_, i) => (
                    <TableHead key={i} className="border-t">
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r}>
                    {Array.from({ length: 5 }, (_, c) => (
                      <TableCell key={c}>
                        <Skeleton className="h-4" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : loadError ? (
          <EmptyState icon="box" title="Failed to load items" description="Something went wrong loading your inventory." actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon="search" title="No items found" description="Try adjusting your search or filters." />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            filterBar={
              <>
                {/* Input Group: search with icon */}
                <div className="relative w-48">
                  <Input
                    className="peer pl-9"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    placeholder="Search items"
                    type="text"
                  />
                  <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                    <SearchIcon size={16} />
                  </div>
                  {search && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="absolute inset-y-0 right-1.5 my-auto text-muted-foreground/80 hover:text-foreground"
                      onClick={() => { setSearch(""); setPage(0); }}
                    >
                      <XIcon size={14} />
                    </Button>
                  )}
                </div>

                {/* Faceted multi-select filters */}
                <FacetedFilter
                  title="Category"
                  options={categoryOptions}
                  selected={categoryFilter}
                  onSelectionChange={(s) => { setCategoryFilter(s); setPage(0); }}
                />
                <FacetedFilter
                  title="Status"
                  options={STATUS_OPTIONS}
                  selected={statusFilter}
                  onSelectionChange={(s) => { setStatusFilter(s); setPage(0); }}
                />
                <FacetedFilter
                  title="Location"
                  options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  selected={locationFilter}
                  onSelectionChange={(s) => { setLocationFilter(s); setPage(0); }}
                />
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={clearAllFilters}>
                    Clear filters
                    <XIcon className="ml-2 size-4" />
                  </Button>
                )}
              </>
            }
            bulkActionBar={
              canEdit && selectedCount > 0 ? (
                <BulkActionBar
                  count={selectedCount}
                  locations={locations}
                  categoryOptions={categoryOptions}
                  busy={bulkBusy}
                  error={bulkError}
                  onAction={executeBulkAction}
                  onClear={() => setRowSelection({})}
                />
              ) : undefined
            }
          />
        )}

        {/* Pagination footer */}
        {!loading && !loadError && items.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex-1">
              {selectedCount > 0
                ? `${selectedCount} of ${total} selected`
                : `${total} items`}
            </div>
            <div className="flex items-center gap-6 lg:gap-8">
              <div className="flex items-center gap-2">
                <p className="text-sm">Rows per page</p>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => { setLimit(Number(v)); setPage(0); }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm">
                Page {page + 1} of {totalPages || 1}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
