"use client";

import { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import {
  ImageIcon,
  Barcode,
  Hash,
  CalendarDays,
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

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  RESERVED: "Reserved",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  CHECKED_OUT: "bg-red-500",
  RESERVED: "bg-purple-500",
  MAINTENANCE: "bg-orange-500",
  RETIRED: "bg-gray-400",
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
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
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
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
        const statusLabel = STATUS_LABELS[item.computedStatus] || item.computedStatus;
        const statusColor = STATUS_COLORS[item.computedStatus] || "bg-gray-400";
        const shortSerial = item.serialNumber.length > 8
          ? item.serialNumber.slice(0, 8)
          : item.serialNumber;

        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {item.assetTag}
              </span>
              {(item._count?.accessories ?? 0) > 0 && (
                <Badge
                  variant="gray"
                  size="sm"
                  title={`${item._count!.accessories} accessories`}
                >
                  +{item._count!.accessories}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className={`inline-block size-2 rounded-full ${statusColor}`} />
                {statusLabel}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Barcode className="size-3" />
                {item.assetTag}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Hash className="size-3" />
                {shortSerial}
              </span>
              {item.createdAt && (
                <span className="inline-flex items-center gap-0.5">
                  <CalendarDays className="size-3" />
                  {formatDate(item.createdAt)}
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
