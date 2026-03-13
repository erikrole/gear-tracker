"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

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
  activeBooking: ActiveBooking | null;
};

type Location = { id: string; name: string };

type Response = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
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

  // B&H enrichment state
  const [bhUrl, setBhUrl] = useState("");
  const [bhLoading, setBhLoading] = useState(false);
  const [bhError, setBhError] = useState("");
  const brandRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function enrichFromBH() {
    const url = bhUrl.trim();
    if (!url) return;
    setBhLoading(true);
    setBhError("");
    try {
      const res = await fetch("/api/enrichment/bh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBhError(json.error || "Failed to fetch product info");
        setBhLoading(false);
        return;
      }
      const d = json.data;
      if (d.brand && brandRef.current && !brandRef.current.value) {
        brandRef.current.value = d.brand;
      }
      if (d.model && modelRef.current && !modelRef.current.value) {
        modelRef.current.value = d.model;
      }
      if (d.name && nameRef.current && !nameRef.current.value) {
        nameRef.current.value = d.name;
      }
      if (!d.brand && !d.model && !d.name) {
        setBhError(d.warning || "Could not extract product info from this page");
      }
    } catch {
      setBhError("Network error");
    }
    setBhLoading(false);
  }

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
        const linkUrl = bhUrl.trim();
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
            ...(linkUrl ? { linkUrl } : {}),
            ...(Object.keys(notes).length ? { notes: JSON.stringify(notes) } : {}),
          }),
        });
      } else {
        res = await fetch("/api/bulk-skus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name") || ""),
            category: String(form.get("category") || ""),
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
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`}
              onClick={() => { setKind(k); setError(""); }}
            >
              {k === "serialized" ? "Serialized" : "Bulk"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-16">
        {kind === "serialized" ? (
          <>
            {/* B&H product URL enrichment */}
            <div className="flex gap-8 mb-8">
              <input
                placeholder="B&H product URL (optional — auto-fills brand, model, name)"
                value={bhUrl}
                onChange={(e) => setBhUrl(e.target.value)}
                className="form-input flex-1"
              />
              <button
                type="button"
                className="btn btn-sm nowrap"
                disabled={bhLoading || !bhUrl.trim()}
                onClick={enrichFromBH}
              >
                {bhLoading ? "Fetching..." : "Fetch info"}
              </button>
            </div>
            {bhError && (
              <div className="alert-warning mb-8">
                {bhError} — you can still fill in the fields manually.
              </div>
            )}

            <div className="grid-3col">
              <input name="assetTag" placeholder="Tag name *" required className="form-input" />
              <input name="itemName" ref={nameRef} placeholder="Product name" className="form-input" />
              <select name="categoryId" className="form-input">
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
              <select name="locationId" required className="form-input">
                <option value="">Location *</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input name="brand" ref={brandRef} placeholder="Brand *" required className="form-input" />
              <input name="model" ref={modelRef} placeholder="Model *" required className="form-input" />
              <input name="serialNumber" placeholder="Serial number *" required className="form-input" />
              <input name="qrCodeValue" placeholder="QR code value *" required className="form-input" />
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
                <input name="description" placeholder="Description" className="form-input" />
                <input name="owner" placeholder="Owner" className="form-input" />
              </div>
            )}
          </>
        ) : (
          <div className="grid-3col">
            <input name="name" placeholder="Product name *" required className="form-input" />
            <select name="categoryId" className="form-input">
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
            <input name="unit" placeholder="Unit (e.g. ea, box) *" required className="form-input" />
            <select name="locationId" required className="form-input">
              <option value="">Location *</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input name="binQrCodeValue" placeholder="Bin QR code *" required className="form-input" />
            <input name="initialQuantity" type="number" min="0" defaultValue="0" placeholder="Initial qty" className="form-input" />
            <input name="minThreshold" type="number" min="0" defaultValue="0" placeholder="Min threshold" className="form-input" />
          </div>
        )}

        <div className="flex-end gap-8 mt-14">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : kind === "serialized" ? "Create asset" : "Create bulk item"}
          </button>
        </div>
        {error && <div className="alert-error mt-8">{error}</div>}
      </form>
    </div>
  );
}


export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const limit = 25;

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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
  }, [page, debouncedSearch, statusFilter, locationFilter, categoryFilter]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setLocations(json.data?.locations || []); })
      .catch(() => {});
    fetch("/api/categories")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setCategories(json.data || []); })
      .catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);
  const rangeStart = total === 0 ? 0 : page * limit + 1;
  const rangeEnd = Math.min((page + 1) * limit, total);

  return (
    <>
      <div className="page-header">
        <h1>Items</h1>
        <div className="flex gap-8">
          <Link href="/import" className="btn">Import</Link>
          <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Close" : "New item"}
          </button>
        </div>
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
        <div className="card-header filter-bar">
          <input
            type="text"
            placeholder="Search by tag, brand, model, serial..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="form-input"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="form-select"
          >
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="CHECKED_OUT">Checked out</option>
            <option value="RESERVED">Reserved</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
          <select
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(0); }}
            className="form-select"
          >
            <option value="">All locations</option>
            {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="form-select"
          >
            <option value="">All categories</option>
            {categories.filter((c) => !c.parentId).map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                {categories.filter((c) => c.parentId === parent.id).length === 0
                  ? <option value={parent.id}>{parent.name}</option>
                  : categories.filter((c) => c.parentId === parent.id).map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))
                }
              </optgroup>
            ))}
          </select>
        </div>

        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : loadError ? (
          <EmptyState icon="box" title="Failed to load items" description="Something went wrong loading your inventory." actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon="search" title="No items found" description="Try adjusting your search or filters." />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
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
                  >
                    <td>
                      <div className="flex-center gap-10">
                        <StatusDot item={item} />
                        <div>
                          <span className="row-link font-semibold">
                            {item.assetTag}
                          </span>
                          <div className="text-xs text-secondary">
                            {item.name || `${item.brand} ${item.model}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{item.category?.name || item.type}</td>
                    <td>{item.location.name}</td>
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
                  <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
