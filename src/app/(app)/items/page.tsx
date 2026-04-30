"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Asset, getColumns } from "./columns";
import { DataTable } from "./data-table";
import { NewItemSheet } from "./new-item-sheet";
import { GapWizardDialog } from "./gap-wizard-dialog";
import { useUrlFilters } from "./hooks/use-url-filters";
import { useItemsQuery, type BulkItem } from "./hooks/use-items-query";
import { useFilterOptions } from "./hooks/use-filter-options";
import { useBulkActions } from "./hooks/use-bulk-actions";
import { BulkActionBar } from "./components/bulk-action-bar";
import { ItemsToolbar } from "./components/items-toolbar";
import { ItemsPagination } from "./components/items-pagination";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { STATUS_STYLES } from "@/lib/status-styles";
import { Download } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { buildBulkRowId, getItemHref } from "./lib/item-href";

export default function ItemsPage() {
  const router = useRouter();
  const filters = useUrlFilters();
  const options = useFilterOptions();

  const query = useItemsQuery({
    debouncedSearch: filters.debouncedSearch,
    statusKey: filters.statusKey,
    locationKey: filters.locationKey,
    categoryKey: filters.categoryKey,
    brandKey: filters.brandKey,
    departmentKey: filters.departmentKey,
    showAccessories: filters.showAccessories,
    favoritesOnly: filters.favoritesOnly,
    sorting: filters.sorting,
    sortKey: filters.sortKey,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGapWizard, setShowGapWizard] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem("items-column-visibility");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Persist column visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("items-column-visibility", JSON.stringify(columnVisibility));
    } catch { /* ignore */ }
  }, [columnVisibility]);
  const [retireTarget, setRetireTarget] = useState<Asset | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const busyRef = useRef(false);

  // Clear selection when page/filters change
  useEffect(() => {
    setRowSelection({});
  }, [query.page, filters.debouncedSearch, filters.statusKey, filters.locationKey, filters.categoryKey, filters.brandKey, filters.departmentKey]);

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;

  useKeyboardShortcuts({
    searchInputRef,
    onClearSearch: () => filters.setSearch(""),
    onClearSelection: () => setRowSelection({}),
    onPreviousPage: () => query.setPage(Math.max(0, query.page - 1)),
    onNextPage: () => query.setPage(Math.min(query.totalPages - 1, query.page + 1)),
    hasSelection: selectedCount > 0,
    canGoBack: query.page > 0,
    canGoForward: query.page < query.totalPages - 1,
  });

  const bulk = useBulkActions(
    () => selectedIds,
    () => { setRowSelection({}); query.reload(); }
  );

  // Merge bulk items into the main table as Asset-shaped rows
  const mergedData = useMemo(() => {
    const bulkAssets: Asset[] = filters.itemType !== "serialized"
      ? query.bulkItems.map((b: BulkItem) => ({
          id: buildBulkRowId(b.id),
          assetTag: b.name,
          name: null,
          type: b.category,
          brand: "",
          model: "",
          serialNumber: "",
          status: "AVAILABLE",
          computedStatus: `${b.availableQuantity} Available`,
          createdAt: "",
          location: { id: b.locationId, name: b.locationName },
          category: b.categoryId ? { id: b.categoryId, name: b.category } : null,
          department: null,
          imageUrl: b.imageUrl,
          activeBooking: null,
          isFavorited: false,
        }))
      : [];

    const serializedItems = filters.itemType !== "bulk" ? query.items : [];

    return [...serializedItems, ...bulkAssets].sort((a, b) =>
      a.assetTag.localeCompare(b.assetTag)
    );
  }, [query.items, query.bulkItems, filters.itemType]);

  // Optimistic favorite toggle
  const handleToggleFavorite = useCallback(async (asset: Asset) => {
    const prev = asset.isFavorited;
    query.setItems((items) =>
      items.map((a) => a.id === asset.id ? { ...a, isFavorited: !prev } : a)
    );
    try {
      const res = await fetch(`/api/assets/${asset.id}/favorite`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error();
    } catch {
      query.setItems((items) =>
        items.map((a) => a.id === asset.id ? { ...a, isFavorited: prev } : a)
      );
      toast.error("Failed to update favorite");
    }
  }, [query]);

  // CSV export
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "csv");
      if (filters.debouncedSearch) params.set("q", filters.debouncedSearch);
      filters.statusKey.split(",").filter(Boolean).forEach((v) => params.append("status", v));
      filters.locationKey.split(",").filter(Boolean).forEach((v) => params.append("location_id", v));
      filters.categoryKey.split(",").filter(Boolean).forEach((v) => params.append("category_id", v));
      filters.brandKey.split(",").filter(Boolean).forEach((v) => params.append("brand", v));
      filters.departmentKey.split(",").filter(Boolean).forEach((v) => params.append("department_id", v));
      if (filters.showAccessories) params.set("show_accessories", "true");

      const res = await fetch(`/api/assets/export?${params}`);
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error();
      const truncated = res.headers.get("X-Truncated") === "true";
      const totalCount = res.headers.get("X-Total-Count");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `items-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (truncated) {
        toast.warning(`Export limited to 5,000 items (${totalCount} total). Narrow your filters for a complete export.`);
      } else {
        toast.success("Export downloaded");
      }
    } catch {
      toast.error("Export failed");
    }
    setExporting(false);
  }, [filters]);

  const handleRowAction = useCallback(async (action: string, asset: Asset) => {
    if (busyRef.current) return;
    switch (action) {
      case "open":
        router.push(getItemHref(asset.id));
        break;
      case "duplicate":
        busyRef.current = true;
        setActionBusy(true);
        try {
          const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
          if (handleAuthRedirect(res)) return;
          if (res.ok) {
            toast.success(`Duplicated ${asset.assetTag}`);
            query.reload();
          } else {
            toast.error(await parseErrorMessage(res, "Failed to duplicate item"));
          }
        } catch {
          toast.error("Network error — could not duplicate item");
        }
        busyRef.current = false;
        setActionBusy(false);
        break;
      case "maintenance":
        busyRef.current = true;
        setActionBusy(true);
        try {
          const res = await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
          if (handleAuthRedirect(res)) return;
          if (res.ok) {
            toast.success(`Updated ${asset.assetTag} maintenance status`);
            query.reload();
          } else {
            toast.error(await parseErrorMessage(res, "Failed to update maintenance status"));
          }
        } catch {
          toast.error("Network error — could not update item");
        }
        busyRef.current = false;
        setActionBusy(false);
        break;
      case "retire":
        setRetireTarget(asset);
        break;
    }
  }, [query.reload, router]);

  async function confirmRetireTarget() {
    if (!retireTarget || busyRef.current) return;
    busyRef.current = true;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/assets/${retireTarget.id}/retire`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(`Retired ${retireTarget.assetTag}`);
        query.reload();
      } else {
        toast.error(await parseErrorMessage(res, "Failed to retire item"));
      }
    } catch {
      toast.error("Network error — could not retire item");
    }
    setRetireTarget(null);
    busyRef.current = false;
    setActionBusy(false);
  }

  const columns = useMemo(
    () => getColumns({ canEdit: options.canEdit, onRowAction: handleRowAction, onToggleFavorite: handleToggleFavorite }),
    [options.canEdit, handleRowAction, handleToggleFavorite]
  );

  // Helper to set filter and reset page
  const withPageReset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    query.setPage(0);
  };

  return (
    <FadeUp>
      {/* Single-item retire confirmation */}
      <AlertDialog open={!!retireTarget} onOpenChange={(open) => { if (!open) setRetireTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire {retireTarget?.assetTag}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently mark &ldquo;{retireTarget?.assetTag}&rdquo; as retired. Retired items are hidden from active inventory and cannot be checked out or reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmRetireTarget}
              disabled={actionBusy}
            >
              {actionBusy ? "Retiring…" : "Retire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PageHeader title="Items">
        <div className="flex items-center gap-2">
          {options.canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="hidden sm:flex" aria-label={exporting ? "Exporting items" : "Export items to CSV"}>
                <Download className="size-4 mr-1.5" aria-hidden="true" />
                {exporting ? "Exporting…" : "Export"}
              </Button>
              <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => setShowGapWizard(true)}>
                Fill gaps
              </Button>
              <Button variant="outline" asChild><Link href="/import">Import</Link></Button>
              <Button onClick={() => setShowCreate(true)}>New item</Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Inventory summary bar */}
      {query.statusBreakdown && !query.loading && (
        <div className="flex items-center gap-5 mb-5 pb-4 border-b border-border/40 flex-wrap">
          {/* Primary count */}
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[28px] font-black leading-none tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {query.total}
            </span>
            <span
              className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/45"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              items
            </span>
          </div>

          {/* Status breakdown — dot + count + label */}
          {(query.statusBreakdown.checkedOut > 0 ||
            query.statusBreakdown.reserved > 0 ||
            query.statusBreakdown.maintenance > 0 ||
            query.statusBreakdown.retired > 0) && (
            <>
              <div className="hidden sm:block h-5 w-px bg-border/50 shrink-0" aria-hidden="true" />
              <div className="flex items-center gap-4 flex-wrap">
                {query.statusBreakdown.checkedOut > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${STATUS_STYLES.blue.dot}`} aria-hidden="true" />
                    <span className="text-[13px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                      {query.statusBreakdown.checkedOut}
                    </span>
                    <span className="text-[10px] text-muted-foreground/55" style={{ fontFamily: "var(--font-mono)" }}>
                      out
                    </span>
                  </div>
                )}
                {query.statusBreakdown.reserved > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${STATUS_STYLES.purple.dot}`} aria-hidden="true" />
                    <span className="text-[13px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                      {query.statusBreakdown.reserved}
                    </span>
                    <span className="text-[10px] text-muted-foreground/55" style={{ fontFamily: "var(--font-mono)" }}>
                      reserved
                    </span>
                  </div>
                )}
                {query.statusBreakdown.maintenance > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${STATUS_STYLES.orange.dot}`} aria-hidden="true" />
                    <span className="text-[13px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                      {query.statusBreakdown.maintenance}
                    </span>
                    <span className="text-[10px] text-muted-foreground/55" style={{ fontFamily: "var(--font-mono)" }}>
                      maintenance
                    </span>
                  </div>
                )}
                {query.statusBreakdown.retired > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full shrink-0 ${STATUS_STYLES.gray.dot}`} aria-hidden="true" />
                    <span className="text-[13px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                      {query.statusBreakdown.retired}
                    </span>
                    <span className="text-[10px] text-muted-foreground/55" style={{ fontFamily: "var(--font-mono)" }}>
                      retired
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <NewItemSheet
        open={showCreate}
        onOpenChange={setShowCreate}
        locations={options.locations}
        departments={options.departments}
        categories={options.categories}
        onCreated={query.reload}
      />

      <GapWizardDialog
        open={showGapWizard}
        onOpenChange={setShowGapWizard}
        categories={options.categories}
        departments={options.departments}
        onAssigned={query.reload}
      />

      <div className="flex flex-col gap-4">
        {query.loading ? (
          <>
          {/* Desktop skeleton table */}
          <div className="rounded-md border hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="border-t w-[40px]"><Skeleton className="size-4" /></TableHead>
                  <TableHead className="border-t w-[40px]"><Skeleton className="size-4" /></TableHead>
                  <TableHead className="border-t w-[280px]"><Skeleton className="h-4 w-12" /></TableHead>
                  <TableHead className="border-t w-[160px]"><Skeleton className="h-4 w-14" /></TableHead>
                  <TableHead className="border-t w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead className="border-t w-[120px]"><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="border-t w-[130px]"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead className="border-t w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r}>
                    <TableCell><Skeleton className="size-4" /></TableCell>
                    <TableCell><Skeleton className="size-4" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-md shrink-0" />
                        <div className="flex flex-col gap-1.5 flex-1">
                          <Skeleton className="h-4" style={{ width: `${55 + (r % 3) * 15}%` }} />
                          <Skeleton className="h-3" style={{ width: `${35 + (r % 4) * 10}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4" style={{ width: `${50 + (r % 3) * 18}%` }} /></TableCell>
                    <TableCell><Skeleton className="h-4" style={{ width: `${40 + (r % 4) * 15}%` }} /></TableCell>
                    <TableCell><Skeleton className="h-4" style={{ width: `${45 + (r % 3) * 20}%` }} /></TableCell>
                    <TableCell><Skeleton className="size-4" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Mobile skeleton cards */}
          <div className="rounded-md border sm:hidden">
            {Array.from({ length: 5 }, (_, r) => (
              <div key={r} className="flex items-start gap-3 px-3 py-3 border-b last:border-b-0">
                <Skeleton className="size-10 rounded-md shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4" style={{ width: `${50 + (r % 3) * 15}%` }} />
                  <Skeleton className="h-3" style={{ width: `${35 + (r % 4) * 10}%` }} />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        ) : query.loadError ? (
          <EmptyState icon="box" title="Failed to load items" description="Something went wrong loading your inventory." actionLabel="Retry" onAction={query.reload} />
        ) : query.items.length === 0 && !filters.hasActiveFilters && !filters.debouncedSearch ? (
          <EmptyState
            icon="box"
            title="No items in inventory yet"
            description={options.canEdit ? "Create your first item to get started." : "No items have been added yet."}
            actionLabel={options.canEdit ? "New item" : undefined}
            onAction={options.canEdit ? () => setShowCreate(true) : undefined}
          />
        ) : query.items.length === 0 ? (
          <EmptyState
            icon="search"
            title="No items match your filters"
            description="Try adjusting your search or filters."
            actionLabel="Clear filters"
            onAction={() => filters.clearAllFilters()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={mergedData}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            sorting={filters.sorting}
            onSortingChange={(next) => { filters.setSorting(next); query.setPage(0); }}
            refreshing={query.refreshing}
            toolbar={
              <ItemsToolbar
                searchInputRef={searchInputRef}
                search={filters.search}
                onSearchChange={withPageReset(filters.setSearch)}
                statusFilter={filters.statusFilter}
                onStatusFilterChange={withPageReset(filters.setStatusFilter)}
                locationFilter={filters.locationFilter}
                onLocationFilterChange={withPageReset(filters.setLocationFilter)}
                categoryFilter={filters.categoryFilter}
                onCategoryFilterChange={withPageReset(filters.setCategoryFilter)}
                brandFilter={filters.brandFilter}
                onBrandFilterChange={withPageReset(filters.setBrandFilter)}
                departmentFilter={filters.departmentFilter}
                onDepartmentFilterChange={withPageReset(filters.setDepartmentFilter)}
                showAccessories={filters.showAccessories}
                onShowAccessoriesChange={(v) => { filters.setShowAccessories(v); query.setPage(0); }}
                favoritesOnly={filters.favoritesOnly}
                onFavoritesOnlyChange={(v) => { filters.setFavoritesOnly(v); query.setPage(0); }}
                itemType={filters.itemType}
                onItemTypeChange={(v) => { filters.setItemType(v); query.setPage(0); }}
                hasActiveFilters={filters.hasActiveFilters}
                onClearAllFilters={() => { filters.clearAllFilters(); query.setPage(0); }}
                locations={options.locations}
                departments={options.departments}
                categoryOptions={options.categoryOptions}
                brands={options.brands}
              />
            }
            bulkBar={
              selectedCount > 0 ? (
                <BulkActionBar
                  count={selectedCount}
                  locations={options.locations}
                  categoryOptions={options.categoryOptions}
                  busy={bulk.busy}
                  error={bulk.error}
                  userRole={options.userRole}
                  onAction={bulk.execute}
                  onClear={() => setRowSelection({})}
                />
              ) : undefined
            }
          />
        )}

        {/* Pagination footer */}
        {!query.loading && !query.loadError && query.items.length > 0 && (
          <ItemsPagination
            total={query.total}
            page={query.page}
            totalPages={query.totalPages}
            limit={query.limit}
            offset={query.page * query.limit}
            selectedCount={selectedCount}
            onPageChange={query.setPage}
            onLimitChange={(v) => { query.setLimit(v); query.setPage(0); }}
          />
        )}
      </div>
    </FadeUp>
  );
}
