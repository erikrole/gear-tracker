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
  toolbar,
  bulkBar,
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
        <div className="flex items-center gap-2">
          {bulkBar || toolbar}
        </div>
      )}

      <div className="relative rounded-md border">
        {refreshing && (
          <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-md">
            <div className="h-full w-1/3 bg-primary/40 animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        )}

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
                      className={cn("h-10 select-none", canSort && "cursor-pointer hover:bg-muted/80")}
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
                    <TableCell key={cell.id} className="overflow-hidden text-ellipsis">
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
