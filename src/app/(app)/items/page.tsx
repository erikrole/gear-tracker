"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { MoreHorizontal, SlidersHorizontal, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <Card className="mb-16">
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

      <form onSubmit={handleSubmit} className="p-16">
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
              className="mt-12"
            >
              {showMeta ? "Hide" : "Show"} optional fields
            </Button>

            {showMeta && (
              <div className="grid-3col mt-12">
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
        {error && <div className="text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded-md px-4 py-2.5 mt-2">{error}</div>}
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
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-border rounded-md flex-wrap">
      <span className="text-sm font-semibold">{count} selected</span>
      <Button variant="outline" size="sm" onClick={onClear} disabled={busy}>Clear</Button>
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

const TOGGLEABLE_COLUMNS = [
  { id: "thumbnail", label: "Thumbnail" },
  { id: "status", label: "Status" },
  { id: "category", label: "Category" },
  { id: "location", label: "Location" },
];

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
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
  const [locationFilter, setLocationFilter] = useState(() => searchParams.get("location") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get("category") ?? "");
  const [brandFilter, setBrandFilter] = useState(() => searchParams.get("brand") ?? "");
  const [departmentFilter, setDepartmentFilter] = useState(() => searchParams.get("department") ?? "");
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

  const hasActiveFilters = statusFilter || locationFilter || categoryFilter || brandFilter || departmentFilter;
  const activeFilterCount = [statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter].filter(Boolean).length;

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sync filters to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (locationFilter) params.set("location", locationFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (brandFilter) params.set("brand", brandFilter);
    if (departmentFilter) params.set("department", departmentFilter);
    if (page > 0) params.set("page", String(page));
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter, page]);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (locationFilter) params.set("location_id", locationFilter);
    if (categoryFilter) params.set("category_id", categoryFilter);
    if (brandFilter) params.set("brand", brandFilter);
    if (departmentFilter) params.set("department_id", departmentFilter);

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
  }, [page, limit, debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter]);

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
    setStatusFilter("");
    setLocationFilter("");
    setCategoryFilter("");
    setBrandFilter("");
    setDepartmentFilter("");
    setPage(0);
  }

  // Clear selection when page/filters change
  useEffect(() => { setRowSelection({}); }, [page, debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter]);

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

  // Resolve display values for active filters
  const locationName = locations.find((l) => l.id === locationFilter)?.name;
  const categoryName = categoryOptions.find((c) => c.value === categoryFilter)?.label;
  const departmentName = departments.find((d) => d.id === departmentFilter)?.name;

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
      <div className="flex items-center justify-between mb-7 flex-col sm:flex-row gap-3">
        <h1>Items</h1>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>
              {total > 0 ? `${total} item${total !== 1 ? "s" : ""} in your inventory.` : "Manage your gear and equipment."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Filters popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="size-8">
                  <SlidersHorizontal className="size-4" />
                  <span className="sr-only">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 px-1 py-0 text-[10px] min-w-4 h-4 flex items-center justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[260px] space-y-3 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(0); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All statuses</SelectItem>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Location</Label>
                  <Select value={locationFilter} onValueChange={(v) => { setLocationFilter(v === "__all__" ? "" : v); setPage(0); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All locations</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === "__all__" ? "" : v); setPage(0); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All categories</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Brand</Label>
                  <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v === "__all__" ? "" : v); setPage(0); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All brands</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {departments.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Department</Label>
                    <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v === "__all__" ? "" : v); setPage(0); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All departments</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full">
                    Clear all filters
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">View options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {TOGGLEABLE_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={columnVisibility[col.id] !== false}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({ ...prev, [col.id]: !!checked }))
                    }
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6 pt-0">
          {/* Search bar */}
          <Input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="max-w-sm"
          />

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {statusFilter && (
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setStatusFilter(""); setPage(0); }}>
                  Status: {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}
                  <X className="size-3" />
                </Button>
              )}
              {locationFilter && (
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setLocationFilter(""); setPage(0); }}>
                  Location: {locationName}
                  <X className="size-3" />
                </Button>
              )}
              {categoryFilter && (
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setCategoryFilter(""); setPage(0); }}>
                  Category: {categoryName}
                  <X className="size-3" />
                </Button>
              )}
              {brandFilter && (
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setBrandFilter(""); setPage(0); }}>
                  Brand: {brandFilter}
                  <X className="size-3" />
                </Button>
              )}
              {departmentFilter && (
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setDepartmentFilter(""); setPage(0); }}>
                  Department: {departmentName}
                  <X className="size-3" />
                </Button>
              )}
            </div>
          )}

          {/* Bulk action bar */}
          {canEdit && selectedCount > 0 && (
            <BulkActionBar
              count={selectedCount}
              locations={locations}
              categoryOptions={categoryOptions}
              busy={bulkBusy}
              error={bulkError}
              onAction={executeBulkAction}
              onClear={() => setRowSelection({})}
            />
          )}

          {/* Table */}
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: 6 }, (_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r}>
                    {Array.from({ length: 6 }, (_, c) => (
                      <TableCell key={c}>
                        <Skeleton className="h-4" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              onRowAction={handleRowAction}
              canEdit={canEdit}
            />
          )}

          {/* Pagination footer */}
          {!loading && !loadError && items.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
              <div className="flex-1">
                {selectedCount} of {items.length} row(s) selected.
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
        </CardContent>
      </Card>
    </>
  );
}
