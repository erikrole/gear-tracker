"use client";

import { useState } from "react";
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ExternalLink,
  Copy,
  Wrench,
  Archive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Asset } from "./columns";

interface DataTableProps {
  columns: ColumnDef<Asset>[];
  data: Asset[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
  onRowAction?: (action: string, asset: Asset) => void;
  canEdit: boolean;
}

export function DataTable({
  columns,
  data,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  onRowAction,
  canEdit,
}: DataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange,
    onColumnVisibilityChange,
    state: { sorting, rowSelection, columnVisibility },
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const meta = header.column.columnDef.meta as
                | { className?: string }
                | undefined;
              return (
                <TableHead
                  key={header.id}
                  className={meta?.className}
                  style={
                    header.column.columnDef.size
                      ? { width: header.column.columnDef.size }
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const asset = row.original;
            const rowContent = (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="cursor-pointer"
                onClick={() => router.push(`/items/${asset.id}`)}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { className?: string }
                    | undefined;
                  return (
                    <TableCell key={cell.id} className={meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            );

            if (!canEdit || !onRowAction) return rowContent;

            return (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>
                  {rowContent}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => router.push(`/items/${asset.id}`)}>
                    <ExternalLink className="mr-2 size-4" />
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onRowAction("duplicate", asset)}>
                    <Copy className="mr-2 size-4" />
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onRowAction("maintenance", asset)}>
                    <Wrench className="mr-2 size-4" />
                    Maintenance
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="text-destructive"
                    onClick={() => onRowAction("retire", asset)}
                  >
                    <Archive className="mr-2 size-4" />
                    Retire
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
