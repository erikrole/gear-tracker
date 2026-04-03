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
  Star,
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
  isFavorited?: boolean;
  _count?: { accessories: number };
};

/** Status badge color map — dot + tinted background pattern (badge-18 style) */
const STATUS_STYLES = {
  green: {
    badge: "border-none bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400",
    dot: "bg-green-600 dark:bg-green-400",
  },
  blue: {
    badge: "border-none bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400",
    dot: "bg-blue-600 dark:bg-blue-400",
  },
  red: {
    badge: "border-none bg-red-600/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
    dot: "bg-red-600 dark:bg-red-400",
  },
  purple: {
    badge: "border-none bg-purple-600/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-400",
    dot: "bg-purple-600 dark:bg-purple-400",
  },
  orange: {
    badge: "border-none bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
    dot: "bg-amber-600 dark:bg-amber-400",
  },
  gray: {
    badge: "border-none bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
} as const;

function StatusDot({ color }: { color: keyof typeof STATUS_STYLES }) {
  return (
    <span
      className={`size-1.5 rounded-full ${STATUS_STYLES[color].dot}`}
      aria-hidden="true"
    />
  );
}

export function statusBadge(asset: Asset) {
  const { computedStatus, activeBooking } = asset;

  switch (computedStatus) {
    case "AVAILABLE":
      return (
        <Badge className={STATUS_STYLES.green.badge}>
          <StatusDot color="green" />
          Available
        </Badge>
      );
    case "CHECKED_OUT": {
      const name = activeBooking?.requesterName;
      const isOverdue = activeBooking?.isOverdue;
      const label = name || "Checked out";
      const color = isOverdue ? "red" : "blue";
      const fullStatus = name ? `Checked out by ${name}` : "Checked out";
      return (
        <Badge className={STATUS_STYLES[color].badge} title={fullStatus}>
          <StatusDot color={color} />
          {label}
        </Badge>
      );
    }
    case "RESERVED": {
      const name = activeBooking?.requesterName;
      const label = name || "Reserved";
      const fullStatus = name ? `Reserved by ${name}` : "Reserved";
      return (
        <Badge className={STATUS_STYLES.purple.badge} title={fullStatus}>
          <StatusDot color="purple" />
          {label}
        </Badge>
      );
    }
    case "MAINTENANCE":
      return (
        <Badge className={STATUS_STYLES.orange.badge}>
          <StatusDot color="orange" />
          Maintenance
        </Badge>
      );
    case "RETIRED":
      return (
        <Badge className={STATUS_STYLES.gray.badge}>
          <StatusDot color="gray" />
          Retired
        </Badge>
      );
    default:
      return (
        <Badge className={STATUS_STYLES.gray.badge}>
          <StatusDot color="gray" />
          {computedStatus}
        </Badge>
      );
  }
}

type ColumnMeta = {
  canEdit: boolean;
  onRowAction?: (action: string, asset: Asset) => void;
  onToggleFavorite?: (asset: Asset) => void;
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

  // Favorite star column
  columns.push({
    id: "favorite",
    header: () => <Star className="size-3.5 text-muted-foreground" />,
    size: 44,
    enableSorting: false,
    enableHiding: true,
    cell: ({ row }) => {
      const asset = row.original;
      return (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={(e) => {
            e.stopPropagation();
            meta.onToggleFavorite?.(asset);
          }}
          title={asset.isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className={`size-4 ${
              asset.isFavorited
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground"
            }`}
          />
        </Button>
      );
    },
  });

  columns.push(
    {
      header: "Name",
      accessorKey: "assetTag",
      id: "assetTag",
      size: 260,
      minSize: 180,
      maxSize: 340,
      enableSorting: true,
      cell: ({ row }) => {
        const item = row.original;
        // Show name (product name) as secondary if set, otherwise fall back to brand + model
        const subtitle = item.name || [item.brand, item.model].filter(Boolean).join(" ");
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
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium truncate">{item.assetTag}</span>
                {(item._count?.accessories ?? 0) > 0 && (
                  <Badge variant="secondary" size="sm" className="shrink-0 rounded-sm px-1 font-normal">
                    +{item._count!.accessories}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
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
      size: 160,
      minSize: 120,
      cell: ({ row }) => statusBadge(row.original),
      enableSorting: false,
    },
    {
      header: "Category",
      id: "category",
      size: 120,
      accessorFn: (row) => row.category?.name || row.type,
      cell: ({ row }) => row.original.category?.name || row.original.type,
      enableSorting: true,
    },
    {
      header: "Department",
      id: "department",
      size: 120,
      accessorFn: (row) => row.department?.name ?? "",
      cell: ({ row }) => row.original.department?.name ?? "—",
      enableSorting: true,
    },
    {
      header: "Location",
      id: "location",
      size: 130,
      accessorFn: (row) => row.location.name,
      cell: ({ row }) => row.original.location.name,
      enableSorting: true,
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
