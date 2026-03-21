"use client";

import { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import {
  ImageIcon,
  ArrowUpDown,
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
      const label = name ? `Checked out by ${name}` : "Checked out";
      return <Badge variant={isOverdue ? "red" : "blue"}>{label}</Badge>;
    }
    case "RESERVED": {
      const name = activeBooking?.requesterName;
      const label = name ? `Reserved by ${name}` : "Reserved";
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

function SortableHeader({ column, label }: { column: { toggleSorting: (desc?: boolean) => void }; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting()}
    >
      {label}
      <ArrowUpDown className="ml-1 size-3.5" />
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
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
    });
  }

  columns.push(
    {
      id: "thumbnail",
      header: () => null,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="item-thumb">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt=""
                width={72}
                height={72}
                sizes="36px"
                loading="lazy"
                unoptimized={
                  !item.imageUrl.includes(".public.blob.vercel-storage.com")
                }
              />
            ) : (
              <ImageIcon className="size-5 text-[var(--text-tertiary)]" />
            )}
          </div>
        );
      },
      enableSorting: false,
      size: 44,
    },
    {
      accessorKey: "assetTag",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-sm">{item.assetTag}</span>
            {statusBadge(item)}
          </div>
        );
      },
      enableHiding: false,
    },
    {
      id: "category",
      header: ({ column }) => <SortableHeader column={column} label="Category" />,
      accessorFn: (row) => row.category?.name || row.type,
      cell: ({ row }) =>
        row.original.category?.name || row.original.type,
    },
    {
      id: "location",
      header: ({ column }) => <SortableHeader column={column} label="Location" />,
      accessorFn: (row) => row.location.name,
      cell: ({ row }) => row.original.location.name,
    },
    {
      id: "brand",
      header: ({ column }) => <SortableHeader column={column} label="Brand" />,
      accessorFn: (row) => row.brand,
      cell: ({ row }) => row.original.brand,
      meta: { className: "hidden md:table-cell" },
    },
    {
      id: "model",
      header: ({ column }) => <SortableHeader column={column} label="Model" />,
      accessorFn: (row) => row.model,
      cell: ({ row }) => row.original.model,
      meta: { className: "hidden md:table-cell" },
    }
  );

  // Row actions (kebab menu)
  if (meta.canEdit) {
    columns.push({
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      size: 44,
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
