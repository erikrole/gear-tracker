"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import {
  ImageIcon,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Wrench,
  Archive,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ActiveBooking = {
  id: string;
  kind: string;
  title: string;
  requesterName: string;
  isOverdue?: boolean;
};

export type Asset = {
  id: string;
  assetTag: string;
  name: string | null;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  computedStatus: string;
  createdAt: string;
  location: { id: string; name: string };
  category: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  imageUrl: string | null;
  activeBooking: ActiveBooking | null;
  _count?: { accessories: number };
};

function statusBadge(asset: Asset) {
  const { computedStatus, activeBooking } = asset;

  switch (computedStatus) {
    case "AVAILABLE":
      return <Badge variant="green">Available</Badge>;
    case "CHECKED_OUT": {
      const name = activeBooking?.requesterName;
      const isOverdue = activeBooking?.isOverdue;
      const label = name ? `Checked out — ${name}` : "Checked out";
      return <Badge variant={isOverdue ? "red" : "blue"}>{label}</Badge>;
    }
    case "RESERVED": {
      const name = activeBooking?.requesterName;
      const label = name ? `Reserved — ${name}` : "Reserved";
      return <Badge variant="purple">{label}</Badge>;
    }
    case "MAINTENANCE":
      return <Badge variant="orange">Maintenance</Badge>;
    case "RETIRED":
      return <Badge variant="gray">Retired</Badge>;
    default:
      return <Badge variant="gray">{computedStatus}</Badge>;
  }
}

/* Column header with sort — follows shadcn reference exactly */
function SortableHeader({
  column,
  title,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
  title: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span>{title}</span>
      {sorted === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : sorted === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 size-3.5" />
      )}
    </Button>
  );
}

type ColumnMeta = {
  canEdit: boolean;
  onRowAction?: (action: string, asset: Asset) => void;
};

export function getColumns(meta: ColumnMeta): ColumnDef<Asset>[] {
  const columns: ColumnDef<Asset>[] = [];

  if (meta.canEdit) {
    columns.push({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    });
  }

  columns.push(
    {
      accessorKey: "assetTag",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const item = row.original;
        const subtitle = [item.brand, item.model].filter(Boolean).join(" ");
        return (
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md overflow-hidden flex items-center justify-center shrink-0 bg-muted">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={72}
                  height={72}
                  sizes="36px"
                  loading="lazy"
                  className="w-full h-full object-cover"
                  unoptimized={
                    !item.imageUrl.includes(".public.blob.vercel-storage.com")
                  }
                />
              ) : (
                <ImageIcon className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate max-w-[300px]">{item.assetTag}</span>
              {subtitle && (
                <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        );
      },
      enableHiding: false,
    },
    {
      id: "category",
      header: ({ column }) => <SortableHeader column={column} title="Category" />,
      accessorFn: (row) => row.category?.name || row.type,
      cell: ({ row }) => (
        <div className="w-[120px]">
          {row.original.category?.name || row.original.type}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="w-[160px]">
          {statusBadge(row.original)}
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "location",
      header: ({ column }) => <SortableHeader column={column} title="Location" />,
      accessorFn: (row) => row.location.name,
      cell: ({ row }) => (
        <div className="w-[120px]">{row.original.location.name}</div>
      ),
    },
  );

  // Row actions
  if (meta.canEdit) {
    columns.push({
      id: "actions",
      cell: ({ row }) => {
        const asset = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => meta.onRowAction?.("open", asset)}>
                <ExternalLink className="mr-2 size-4" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => meta.onRowAction?.("duplicate", asset)}>
                <Copy className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => meta.onRowAction?.("maintenance", asset)}>
                <Wrench className="mr-2 size-4" />
                Maintenance
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => meta.onRowAction?.("retire", asset)}
              >
                <Archive className="mr-2 size-4" />
                Retire
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }

  return columns;
}
