"use client";

import { type ReactNode } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type OnChangeFn,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Asset } from "./columns";
import { ItemCard } from "./components/item-card";

interface DataTableProps {
  columns: ColumnDef<Asset>[];
  data: Asset[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  filterBar?: ReactNode;
  bulkActionBar?: ReactNode;
  refreshing?: boolean;
  viewMode?: "table" | "cards";
  canEdit?: boolean;
  onRowAction?: (action: string, asset: Asset) => void;
}

export function DataTable({
  columns,
  data,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  sorting,
  onSortingChange,
  filterBar,
  bulkActionBar,
  refreshing = false,
  viewMode = "table",
  canEdit = false,
  onRowAction,
}: DataTableProps) {
  const router = useRouter();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onRowSelectionChange,
    onColumnVisibilityChange,
    state: { sorting, rowSelection, columnVisibility },
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  return (
    <div className="relative rounded-md border">
      {refreshing && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-md">
          <div className="h-full w-1/3 animate-pulse bg-primary/40" style={{ animation: "shimmer 1.5s ease-in-out infinite", translate: "0%" }} />
          <style>{`@keyframes shimmer { 0% { translate: -100%; } 100% { translate: 400%; } }`}</style>
        </div>
      )}
      {(filterBar || bulkActionBar) && (
        <div className="sticky top-0 z-10 bg-background rounded-t-md">
          <div className="relative">
            <div className={`flex flex-wrap items-end gap-3 px-4 py-3 ${bulkActionBar ? "invisible" : ""}`}>
              {filterBar}
            </div>
            {bulkActionBar && (
              <div className="absolute inset-0 flex items-center px-4">
                {bulkActionBar}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "cards" ? (
        <div>
          {data.length ? (
            data.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                selected={!!rowSelection[item.id]}
                onSelectChange={(checked) => {
                  const next = { ...rowSelection, [item.id]: checked };
                  if (!checked) delete next[item.id];
                  onRowSelectionChange(next);
                }}
                canEdit={canEdit}
                onRowAction={onRowAction}
              />
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No items match your filters. Try adjusting your search or filters.
            </div>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={`relative h-10 border-t select-none ${canSort ? "cursor-pointer hover:bg-muted/80" : ""}`}
                      style={header.column.getSize() !== 150 ? { width: header.column.getSize() } : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === "asc" ? <ArrowUp className="size-3.5 text-foreground" /> :
                            sorted === "desc" ? <ArrowDown className="size-3.5 text-foreground" /> :
                            <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                  tabIndex={0}
                  role="row"
                  aria-label={`View ${row.original.assetTag}`}
                  onClick={() => router.push(`/items/${row.original.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); router.push(`/items/${row.original.id}`); } }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No items match your filters. Try adjusting your search or filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
