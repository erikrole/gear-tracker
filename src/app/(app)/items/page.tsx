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
    sorting: filters.sorting,
    sortKey: filters.sortKey,
  });

  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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
    () => getColumns({ canEdit: options.canEdit, onRowAction: handleRowAction }),
    [options.canEdit, handleRowAction]
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

      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Items</h1>
        {options.canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/import">Import</Link></Button>
            <Button onClick={() => setShowCreate(true)}>New item</Button>
          </div>
        )}
      </div>

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
