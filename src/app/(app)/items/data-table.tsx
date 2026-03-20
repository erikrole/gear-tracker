"use client";

import {
  ColumnDef,
  VisibilityState,
  flexRender,
  getCoreRowModel,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DataTableProps {
  columns: ColumnDef<import("./columns").Asset>[];
  data: import("./columns").Asset[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
}

const COLUMN_LABELS: Record<string, string> = {
  thumbnail: "Thumbnail",
  assetTag: "Name",
  category: "Category",
  location: "Location",
  brand: "Brand",
  model: "Model",
};

export function DataTable({
  columns,
  data,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps) {
  const router = useRouter();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange,
    onColumnVisibilityChange,
    state: { rowSelection, columnVisibility },
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  return (
    <>
      <div className="flex items-center justify-end px-3 py-2 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                >
                  {COLUMN_LABELS[col.id] || col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Table>
        <TableHeader>
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
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="cursor-pointer"
                onClick={() => router.push(`/items/${row.original.id}`)}
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
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
