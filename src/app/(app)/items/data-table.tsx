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
import { cn } from "@/lib/utils";
import type { Asset } from "./columns";
import { statusBadge } from "./columns";
import { getItemHref } from "./lib/item-href";
import { AssetImage } from "@/components/AssetImage";
import { Checkbox } from "@/components/ui/checkbox";

export type Density = "compact" | "comfortable";

interface DataTableProps {
  columns: ColumnDef<Asset>[];
  data: Asset[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  refreshing?: boolean;
  density?: Density;
  toolbar?: ReactNode;
  bulkBar?: ReactNode;
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
  refreshing = false,
  density = "comfortable",
  toolbar,
  bulkBar,
}: DataTableProps) {
  const densityClass =
    density === "compact"
      ? "[&_td]:py-1 [&_td]:px-3 [&_th]:h-8 [&_th]:px-3 [&_tbody_tr]:h-10"
      : "";
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
    state: {
      sorting,
      rowSelection,
      columnVisibility,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  return (
    <div className="space-y-2">
      {(toolbar || bulkBar) && (
        <div className="flex items-stretch">
          {bulkBar || toolbar}
        </div>
      )}

      <div className={cn("relative rounded-md border", densityClass)} role="region" aria-busy={refreshing}>
        {refreshing && (
          <div className="absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden rounded-t-md">
            <div className="h-full w-1/3 bg-primary/40 animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        )}

        {/* Mobile card layout */}
        <div className="divide-y sm:hidden">
          {table.getRowModel().rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No items match your filters.
            </div>
          ) : (
            table.getRowModel().rows.map((row) => {
              const item = row.original;
              const subtitle = item.name || [item.brand, item.model].filter(Boolean).join(" ");
              const product = [item.brand, item.model].filter(Boolean).join(" ");
              const showProductMeta = product && product.trim().toLowerCase() !== subtitle.trim().toLowerCase();
              const meta = [item.location?.name, item.category?.name || item.type]
                .filter(Boolean)
                .join(" · ");
              const href = getItemHref(item.id);
              return (
                <div
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="flex items-start gap-3 px-3 py-3 transition-colors active:bg-muted/50 data-[state=selected]:bg-muted/40"
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${item.assetTag}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-no-row-click]")) return;
                    if (e.metaKey || e.ctrlKey || e.button === 1) {
                      window.open(href, "_blank", "noopener");
                    } else {
                      router.push(href);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <div
                    data-no-row-click
                    className="-m-1 p-1 self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(v) => row.toggleSelected(!!v)}
                      aria-label={`Select ${item.assetTag}`}
                    />
                  </div>
                  {density !== "compact" && (
                    <AssetImage src={item.imageUrl} alt={item.assetTag} size={48} className="shrink-0 rounded-lg" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
                          {item.assetTag}
                        </div>
                        {subtitle && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
                        )}
                      </div>
                      <div className="shrink-0">{statusBadge(item)}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {showProductMeta && (
                        <span className="truncate text-[11px] font-medium text-foreground/80">{product}</span>
                      )}
                      {meta && (
                        <span className="truncate text-[11px] text-muted-foreground/80">{meta}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <Table className="hidden sm:table">
          <TableHeader className="bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} striped={false} className="bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-10 select-none text-[11px] uppercase tracking-wide text-muted-foreground group/th",
                        canSort && "cursor-pointer hover:bg-muted/80"
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === "asc" ? (
                              <ArrowUp className="size-3.5 text-foreground" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3.5 text-foreground" />
                            ) : (
                              <ArrowUpDown className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover/th:opacity-100" />
                            )
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
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="group/row cursor-pointer transition-colors hover:bg-muted/35 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                  tabIndex={0}
                  role="row"
                  aria-label={`View ${row.original.assetTag}`}
                  onClick={(e) => {
                    const href = getItemHref(row.original.id);
                    if (e.metaKey || e.ctrlKey || e.button === 1) {
                      window.open(href, "_blank", "noopener");
                    } else {
                      router.push(href);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(getItemHref(row.original.id)); } }}
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
      </div>
    </div>
  );
}
