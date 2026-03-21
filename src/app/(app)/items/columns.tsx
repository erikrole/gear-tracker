"use client";

import Image from "next/image";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  ExternalLink,
  Copy,
  Wrench,
  Archive,
  Package,
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
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    });
  }

  columns.push(
    {
      header: "Name",
      accessorKey: "assetTag",
      cell: ({ row }) => {
        const item = row.original;
        const subtitle = [item.brand, item.model].filter(Boolean).join(" ");
        return (
          <div className="flex items-center gap-3 min-w-0">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.assetTag}
                width={36}
                height={36}
                className="size-9 rounded-md object-cover shrink-0"
                unoptimized={!item.imageUrl.includes(".public.blob.vercel-storage.com")}
              />
            ) : (
              <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Package className="size-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <div className="font-medium">{item.assetTag}</div>
              {subtitle && (
                <div className="text-xs text-muted-foreground">{subtitle}</div>
              )}
            </div>
          </div>
        );
      },
      enableHiding: false,
    },
    {
      header: "Status",
      id: "status",
      cell: ({ row }) => statusBadge(row.original),
      enableSorting: false,
    },
    {
      header: "Category",
      id: "category",
      accessorFn: (row) => row.category?.name || row.type,
      cell: ({ row }) => row.original.category?.name || row.original.type,
    },
    {
      header: "Location",
      id: "location",
      accessorFn: (row) => row.location.name,
      cell: ({ row }) => row.original.location.name,
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
