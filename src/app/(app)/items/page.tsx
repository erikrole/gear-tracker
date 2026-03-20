"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { FilterChip } from "@/components/FilterChip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ActiveBooking = {
  id: string;
  kind: string;
  title: string;
  requesterName: string;
};

type CategoryOption = { id: string; name: string; parentId: string | null };

type Asset = {
  id: string;
  assetTag: string;
  name: string | null;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  computedStatus: string;
  location: { id: string; name: string };
  category: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  imageUrl: string | null;
  activeBooking: ActiveBooking | null;
  _count?: { accessories: number };
};

type Location = { id: string; name: string };

type Response = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
  favoriteIds?: string[];
};

const statusDotClass: Record<string, string> = {
  AVAILABLE: "status-available",
  CHECKED_OUT: "status-checked-out",
  RESERVED: "status-reserved",
  MAINTENANCE: "status-maintenance",
  RETIRED: "status-retired",
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
      className="relative inline-flex shrink-0"
      onMouseEnter={() => hasBooking && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        onClick={(e) => {
          if (hasBooking) { e.stopPropagation(); setOpen((v) => !v); }
        }}
        className={`status-dot ${statusDotClass[item.computedStatus] || "status-retired"}`}
        style={{ width: 8, height: 8, cursor: hasBooking ? "pointer" : "default" }}
      />
      {open && item.activeBooking && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="popover"
          style={{ left: 16, top: "50%", transform: "translateY(-50%)" }}
        >
          <div className="font-semibold mb-4" style={{ textTransform: "capitalize" }}>{label}</div>
          <div className="text-secondary mb-4">
            {item.activeBooking.title} &middot; {item.activeBooking.requesterName}
          </div>
          {bookingPath && (
            <Link href={bookingPath} className="font-medium no-underline" style={{ color: "var(--primary)" }}>
              View {item.activeBooking.kind === "CHECKOUT" ? "checkout" : "reservation"} &rarr;
            </Link>
          )}
        </div>
      )}
    </span>
  );
}

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
    <div className="card mb-16">
      <div className="card-header flex-between">
        <h2>New item</h2>
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
      </div>

      <form onSubmit={handleSubmit} className="p-16">
        {kind === "serialized" ? (
          <>
            <div className="grid-3col">
              <Input name="assetTag" placeholder="Tag name *" required />
              <Input name="itemName" placeholder="Product name" />
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
              <input name="type" type="hidden" defaultValue="equipment" />
              <select name="locationId" required className="form-select">
                <option value="">Location *</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <Input name="brand" placeholder="Brand *" required />
              <Input name="model" placeholder="Model *" required />
              <Input name="serialNumber" placeholder="Serial number *" required />
              <Input name="qrCodeValue" placeholder="QR code value *" required />
            </div>

            <button
              type="button"
              onClick={() => setShowMeta((v) => !v)}
              className="btn-link mt-12"
            >
              {showMeta ? "Hide" : "Show"} optional fields
            </button>

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
            <div>
              <Input name="unit" placeholder="Unit (e.g. ea, box) *" required />
              <p className="text-muted-foreground text-xs mt-1">How you count them: ea, box, pack, pair, roll</p>
            </div>
            <select name="locationId" required className="form-select">
              <option value="">Location *</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
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
    </div>
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
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
      background: "var(--primary-bg, rgba(59,130,246,0.08))", borderBottom: "1px solid var(--border)",
      flexWrap: "wrap",
    }}>
      <span className="text-sm font-semibold">{count} selected</span>
      <Button variant="outline" size="sm" onClick={onClear} disabled={busy}>Clear</Button>
      <div style={{ flex: 1 }} />

      {/* Move location */}
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => { setShowLocPicker((v) => !v); setShowCatPicker(false); }} disabled={busy}>
          Move location
        </Button>
        {showLocPicker && (
          <div className="popover" style={{ right: 0, top: "100%", marginTop: 4, minWidth: 180, maxHeight: 240, overflow: "auto", position: "absolute", zIndex: "var(--z-dropdown)" }}>
            {locations.map((l) => (
              <button key={l.id} className="popover-item" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => { setShowLocPicker(false); onAction("move_location", { locationId: l.id }); }}>
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Change category */}
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => { setShowCatPicker((v) => !v); setShowLocPicker(false); }} disabled={busy}>
          Change category
        </Button>
        {showCatPicker && (
          <div className="popover" style={{ right: 0, top: "100%", marginTop: 4, minWidth: 200, maxHeight: 240, overflow: "auto", position: "absolute", zIndex: "var(--z-dropdown)" }}>
            <button className="popover-item" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", background: "none", border: "none", cursor: "pointer", fontStyle: "italic" }}
              onClick={() => { setShowCatPicker(false); onAction("change_category", { categoryId: null }); }}>
              None
            </button>
            {categoryOptions.map((c) => (
              <button key={c.value} className="popover-item" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => { setShowCatPicker(false); onAction("change_category", { categoryId: c.value }); }}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={() => onAction("maintenance")} disabled={busy}>
        Maintenance
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(`Retire ${count} item${count > 1 ? "s" : ""}?`)) onAction("retire"); }} disabled={busy}>
        Retire
      </Button>

      {busy && <span className="text-sm text-muted">Processing...</span>}
      {error && <span className="text-sm" style={{ color: "var(--red)" }}>{error}</span>}
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
  const router = useRouter();
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
  const [favoriteFilter, setFavoriteFilter] = useState(() => searchParams.get("favorite") === "true");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const limit = 25;
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const hasActiveFilters = statusFilter || locationFilter || categoryFilter || brandFilter || departmentFilter || favoriteFilter;

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
    if (favoriteFilter) params.set("favorite", "true");
    if (page > 0) params.set("page", String(page));
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter, favoriteFilter, page]);

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
    if (favoriteFilter) params.set("favorite", "true");

    try {
      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) { setLoadError(true); setLoading(false); return; }
      const json: Response = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
      if (json.favoriteIds) setFavoriteIds(new Set(json.favoriteIds));
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [page, debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter, favoriteFilter]);

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
    setFavoriteFilter(false);
    setPage(0);
  }

  // Clear selection when page/filters change
  useEffect(() => { setSelected(new Set()); }, [page, debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter, favoriteFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function toggleFavorite(e: React.MouseEvent, assetId: string) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/assets/${assetId}/favorite`, { method: "POST" });
      if (!res.ok) return;
      const json = await res.json();
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (json.data?.favorited) next.add(assetId);
        else next.delete(assetId);
        return next;
      });
    } catch { /* ignore */ }
  }

  async function executeBulkAction(action: string, payload?: Record<string, string | null>) {
    setBulkBusy(true);
    setBulkError("");
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json();
        setBulkError(json.error || "Bulk action failed");
        setBulkBusy(false);
        return;
      }
      setSelected(new Set());
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

  return (
    <>
      <div className="page-header">
        <h1>Items</h1>
        {canEdit && (
          <div className="flex gap-8">
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

      <div className="card">
        <div className="card-header filter-chip-bar">
          <Input
            type="text"
            placeholder="Search by tag, brand, model, serial..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="filter-chip-search"
          />
          <div className="filter-chips">
            <FilterChip
              label="Status"
              value={statusFilter}
              displayValue={STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}
              options={STATUS_OPTIONS}
              onSelect={(v) => { setStatusFilter(v); setPage(0); }}
              onClear={() => { setStatusFilter(""); setPage(0); }}
            />
            <FilterChip
              label="Location"
              value={locationFilter}
              displayValue={locationName}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onSelect={(v) => { setLocationFilter(v); setPage(0); }}
              onClear={() => { setLocationFilter(""); setPage(0); }}
            />
            <FilterChip
              label="Category"
              value={categoryFilter}
              displayValue={categoryName}
              options={categoryOptions}
              onSelect={(v) => { setCategoryFilter(v); setPage(0); }}
              onClear={() => { setCategoryFilter(""); setPage(0); }}
            />
            <FilterChip
              label="Brand"
              value={brandFilter}
              options={brands.map((b) => ({ value: b, label: b }))}
              onSelect={(v) => { setBrandFilter(v); setPage(0); }}
              onClear={() => { setBrandFilter(""); setPage(0); }}
            />
            {departments.length > 0 && (
              <FilterChip
                label="Department"
                value={departmentFilter}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                onSelect={(v) => { setDepartmentFilter(v); setPage(0); }}
                onClear={() => { setDepartmentFilter(""); setPage(0); }}
              />
            )}
            <Button
              type="button"
              variant={favoriteFilter ? "default" : "outline"}
              size="sm"
              onClick={() => { setFavoriteFilter((v) => !v); setPage(0); }}
              title="Show favorites only"
              style={{ fontSize: "var(--text-sm)", padding: "4px 10px", gap: 4, display: "inline-flex", alignItems: "center" }}
            >
              <svg viewBox="0 0 24 24" fill={favoriteFilter ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Favorites
            </Button>
            {hasActiveFilters && (
              <button type="button" className="filter-chip-clear-all" onClick={clearAllFilters}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : loadError ? (
          <EmptyState icon="box" title="Failed to load items" description="Something went wrong loading your inventory." actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon="search" title="No items found" description="Try adjusting your search or filters." />
        ) : (
          <>
            {/* Bulk action bar */}
            {canEdit && selected.size > 0 && (
              <BulkActionBar
                count={selected.size}
                locations={locations}
                categoryOptions={categoryOptions}
                busy={bulkBusy}
                error={bulkError}
                onAction={executeBulkAction}
                onClear={() => setSelected(new Set())}
              />
            )}
            <table className="data-table">
              <thead>
                <tr>
                  {canEdit && (
                    <th style={{ width: 36, padding: "8px 4px" }}>
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selected.size === items.length}
                        onChange={toggleSelectAll}
                        title="Select all on page"
                      />
                    </th>
                  )}
                  <th style={{ width: 32, padding: "8px 2px" }}></th>
                  <th style={{ width: 44, padding: "8px 4px" }}></th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th className="hide-mobile">Department</th>
                  <th className="hide-mobile">Brand</th>
                  <th className="hide-mobile">Model</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/items/${item.id}`)}
                    style={selected.has(item.id) ? { background: "var(--primary-bg, rgba(59,130,246,0.06))" } : undefined}
                  >
                    {canEdit && (
                      <td style={{ width: 36, padding: "8px 4px" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                    )}
                    <td style={{ width: 32, padding: "8px 2px" }} onClick={(e) => toggleFavorite(e, item.id)}>
                      <svg
                        viewBox="0 0 24 24"
                        fill={favoriteIds.has(item.id) ? "var(--yellow, #eab308)" : "none"}
                        stroke={favoriteIds.has(item.id) ? "var(--yellow, #eab308)" : "var(--text-muted, #9ca3af)"}
                        strokeWidth="2"
                        style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </td>
                    <td style={{ width: 44, padding: "8px 4px" }}>
                      <div className="item-thumb">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt="" width={72} height={72} sizes="36px" loading="lazy" unoptimized={!item.imageUrl.includes(".public.blob.vercel-storage.com")} />
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-tertiary)" }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex-center gap-10">
                        <StatusDot item={item} />
                        <div>
                          <span className="row-link font-semibold">
                            {item.assetTag}
                          </span>
                          {(item._count?.accessories ?? 0) > 0 && (
                            <span className="badge badge-sm badge-gray ml-4" title={`${item._count!.accessories} accessories`}>
                              +{item._count!.accessories}
                            </span>
                          )}
                          <div className="text-xs text-secondary">
                            {item.name || `${item.brand} ${item.model}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{item.category?.name || item.type}</td>
                    <td>{item.location.name}</td>
                    <td className="hide-mobile">{item.department?.name ?? "\u2014"}</td>
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
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
