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
import { useUrlFilters } from "./hooks/use-url-filters";
import { useItemsQuery } from "./hooks/use-items-query";
import { useFilterOptions } from "./hooks/use-filter-options";
import { useBulkActions } from "./hooks/use-bulk-actions";
import { BulkActionBar } from "./components/bulk-action-bar";
import { ItemsToolbar } from "./components/items-toolbar";
import { ItemsPagination } from "./components/items-pagination";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useIsMobile } from "./hooks/use-media-query";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

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

  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
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

  // Optimistic favorite toggle
  const handleToggleFavorite = useCallback(async (asset: Asset) => {
    const prev = asset.isFavorited;
    // Optimistic update
    query.setItems((items) =>
      items.map((a) => a.id === asset.id ? { ...a, isFavorited: !prev } : a)
    );
    try {
      const res = await fetch(`/api/assets/${asset.id}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      // Rollback
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
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `items-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
    setExporting(false);
  }, [filters]);

  const handleRowAction = useCallback(async (action: string, asset: Asset) => {
    if (actionBusy) return;
    switch (action) {
      case "open":
        router.push(`/items/${asset.id}`);
        break;
      case "duplicate":
        setActionBusy(true);
        try {
          const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
          if (res.ok) {
            toast.success(`Duplicated ${asset.assetTag}`);
            query.reload();
          } else {
            const body = await res.json().catch(() => null);
            toast.error(body?.error || "Failed to duplicate item");
          }
        } catch {
          toast.error("Network error — could not duplicate item");
        }
        setActionBusy(false);
        break;
      case "maintenance":
        setActionBusy(true);
        try {
          const res = await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
          if (res.ok) {
            toast.success(`Updated ${asset.assetTag} maintenance status`);
            query.reload();
          } else {
            const body = await res.json().catch(() => null);
            toast.error(body?.error || "Failed to update maintenance status");
          }
        } catch {
          toast.error("Network error — could not update item");
        }
        setActionBusy(false);
        break;
      case "retire":
        setRetireTarget(asset);
        break;
    }
  }, [actionBusy, query.reload, router]);

  async function confirmRetireTarget() {
    if (!retireTarget || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/assets/${retireTarget.id}/retire`, { method: "POST" });
      if (res.ok) {
        toast.success(`Retired ${retireTarget.assetTag}`);
        query.reload();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to retire item");
      }
    } catch {
      toast.error("Network error — could not retire item");
    }
    setRetireTarget(null);
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
    <>
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
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRetireTarget}
              disabled={actionBusy}
            >
              {actionBusy ? "Retiring…" : "Retire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1>Items</h1>
        <div className="flex items-center gap-2">
          {options.canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="hidden sm:flex">
                <Download className="size-4 mr-1.5" />
                {exporting ? "Exporting…" : "Export"}
              </Button>
              <Button variant="outline" asChild><Link href="/import">Import</Link></Button>
              <Button onClick={() => setShowCreate(true)}>New item</Button>
            </>
          )}
        </div>
      </div>

      {/* Inventory summary bar */}
      {query.statusBreakdown && !query.loading && (
        <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">{query.total} items</span>
          {query.statusBreakdown.checkedOut > 0 && (
            <Badge variant="secondary" className="font-normal">{query.statusBreakdown.checkedOut} checked out</Badge>
          )}
          {query.statusBreakdown.reserved > 0 && (
            <Badge variant="secondary" className="font-normal">{query.statusBreakdown.reserved} reserved</Badge>
          )}
          {query.statusBreakdown.maintenance > 0 && (
            <Badge variant="secondary" className="font-normal">{query.statusBreakdown.maintenance} maintenance</Badge>
          )}
          {query.statusBreakdown.retired > 0 && (
            <Badge variant="secondary" className="font-normal">{query.statusBreakdown.retired} retired</Badge>
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

      <div className="space-y-4">
        {query.loading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="border-t w-[280px]"><Skeleton className="h-4 w-12" /></TableHead>
                  <TableHead className="border-t w-[200px]"><Skeleton className="h-4 w-14" /></TableHead>
                  <TableHead className="border-t w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead className="border-t w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="border-t w-[160px]"><Skeleton className="h-4 w-16" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, r) => (
                  <TableRow key={r}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-md shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4" style={{ width: `${55 + (r % 3) * 15}%` }} />
                          <Skeleton className="h-3" style={{ width: `${35 + (r % 4) * 10}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4" style={{ width: `${50 + (r % 3) * 18}%` }} /></TableCell>
                    <TableCell><Skeleton className="h-4" style={{ width: `${40 + (r % 4) * 15}%` }} /></TableCell>
                    <TableCell><Skeleton className="h-4" style={{ width: `${45 + (r % 3) * 20}%` }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
            onAction={() => { filters.clearAllFilters(); filters.setSearch(""); }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={query.items}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            sorting={filters.sorting}
            onSortingChange={(next) => { filters.setSorting(next); query.setPage(0); }}
            refreshing={query.refreshing}
            viewMode={isMobile ? "cards" : "table"}
            canEdit={options.canEdit}
            onRowAction={handleRowAction}
            filterBar={
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
                hasActiveFilters={filters.hasActiveFilters}
                onClearAllFilters={() => { filters.clearAllFilters(); query.setPage(0); }}
                locations={options.locations}
                departments={options.departments}
                categoryOptions={options.categoryOptions}
                brands={options.brands}
              />
            }
            bulkActionBar={
              options.canEdit && selectedCount > 0 ? (
                <BulkActionBar
                  count={selectedCount}
                  locations={options.locations}
                  categoryOptions={options.categoryOptions}
                  busy={bulk.busy}
                  error={bulk.error}
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
    </>
  );
}
