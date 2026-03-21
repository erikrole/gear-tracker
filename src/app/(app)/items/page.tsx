"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { ChevronDown, X } from "lucide-react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

        const categoryId = String(form.get("categoryId") || "");
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
        const bulkCategoryId = String(form.get("categoryId") || "");
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
      <CardHeader className="flex-between">
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
            <div className="grid-3col">
              <Input name="assetTag" placeholder="Tag name *" required />
              <Input name="itemName" placeholder="Product name" />
              <Select name="categoryId" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Category</SelectItem>
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
          <div className="grid-3col">
            <div>
              <Input name="name" placeholder="Product name *" required />
              <p className="text-muted-foreground text-xs mt-1">e.g. &ldquo;AA Batteries&rdquo;, &ldquo;USB-C Cables&rdquo;</p>
            </div>
            <Select name="categoryId" defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Category</SelectItem>
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

        <div className="flex-end gap-8 mt-14">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : kind === "serialized" ? "Create asset" : "Create bulk item"}
          </Button>
        </div>
        {error && <div className="alert-error mt-8">{error}</div>}
      </form>
    </Card>
  );
}


function FilterDropdown({
  label,
  value,
  displayValue,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  value: string;
  displayValue?: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
  onClear: () => void;
}) {
  const active = value !== "";
  const selectedLabel = displayValue || options.find((o) => o.value === value)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? "secondary" : "outline"}
          size="sm"
          className="gap-1"
        >
          {label}{active ? `: ${selectedLabel}` : ""}
          {active ? (
            <X
              className="size-3 ml-0.5"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
            />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[240px] overflow-y-auto">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={opt.value === value}
            onCheckedChange={() => onSelect(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No options</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--primary-bg,rgba(59,130,246,0.08))] border-b border-border flex-wrap">
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
            <button key={l.id} className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left outline-hidden select-none cursor-default hover:bg-accent hover:text-accent-foreground"
              onClick={() => onAction("move_location", { locationId: l.id })}>
              {l.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Change category */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>Change category</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-[200px] max-h-[240px] overflow-y-auto p-1">
          <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left italic outline-hidden select-none cursor-default hover:bg-accent hover:text-accent-foreground"
            onClick={() => onAction("change_category", { categoryId: null })}>
            None
          </button>
          {categoryOptions.map((c) => (
            <button key={c.value} className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left outline-hidden select-none cursor-default hover:bg-accent hover:text-accent-foreground"
              onClick={() => onAction("change_category", { categoryId: c.value })}>
              {c.label}
            </button>
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
      {error && <span className="text-sm text-red">{error}</span>}
    </div>
  );
}

const TOGGLEABLE_COLUMNS = [
  { id: "thumbnail", label: "Thumbnail" },
  { id: "category", label: "Category" },
  { id: "location", label: "Location" },
  { id: "brand", label: "Brand" },
  { id: "model", label: "Model" },
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
  const rangeStart = total === 0 ? 0 : page * limit + 1;
  const rangeEnd = Math.min((page + 1) * limit, total);

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
      <div className="page-header">
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
        <CardHeader className="flex flex-row items-center gap-2 flex-wrap p-4">
          <Input
            type="text"
            placeholder="Search by tag, brand, model, serial..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="flex-1 min-w-[120px] max-w-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onSelect={(v) => { setStatusFilter(v); setPage(0); }}
              onClear={() => { setStatusFilter(""); setPage(0); }}
            />
            <FilterDropdown
              label="Location"
              value={locationFilter}
              displayValue={locationName}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onSelect={(v) => { setLocationFilter(v); setPage(0); }}
              onClear={() => { setLocationFilter(""); setPage(0); }}
            />
            <FilterDropdown
              label="Category"
              value={categoryFilter}
              displayValue={categoryName}
              options={categoryOptions}
              onSelect={(v) => { setCategoryFilter(v); setPage(0); }}
              onClear={() => { setCategoryFilter(""); setPage(0); }}
            />
            <FilterDropdown
              label="Brand"
              value={brandFilter}
              options={brands.map((b) => ({ value: b, label: b }))}
              onSelect={(v) => { setBrandFilter(v); setPage(0); }}
              onClear={() => { setBrandFilter(""); setPage(0); }}
            />
            {departments.length > 0 && (
              <FilterDropdown
                label="Department"
                value={departmentFilter}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                onSelect={(v) => { setDepartmentFilter(v); setPage(0); }}
                onClear={() => { setDepartmentFilter(""); setPage(0); }}
              />
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto gap-1">
                  Columns
                  <ChevronDown className="size-4" />
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

        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : loadError ? (
          <EmptyState icon="box" title="Failed to load items" description="Something went wrong loading your inventory." actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon="search" title="No items found" description="Try adjusting your search or filters." />
        ) : (
          <>
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
            <DataTable
              columns={columns}
              data={items}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              onRowAction={handleRowAction}
              canEdit={canEdit}
              selectedCount={selectedCount}
              total={total}
            />
            <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{selectedCount} of {total} row(s) selected.</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Rows per page</span>
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
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">
                  Page {page + 1} of {totalPages || 1}
                </span>
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
