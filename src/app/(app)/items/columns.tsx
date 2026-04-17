"use client";

import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  ExternalLink,
  Copy,
  Wrench,
  Archive,
  Star,
} from "lucide-react";
import { AssetImage } from "@/components/AssetImage";
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
import { STATUS_STYLES, statusColor, type StatusColor } from "@/lib/status-styles";

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

function StatusDot({ color }: { color: StatusColor }) {
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
        <Badge className={`${STATUS_STYLES[color].badge} max-w-[160px]`} title={fullStatus}>
          <StatusDot color={color} />
          <span className="truncate">{label}</span>
        </Badge>
      );
    }
    case "RESERVED": {
      const name = activeBooking?.requesterName;
      const label = name || "Reserved";
      const fullStatus = name ? `Reserved by ${name}` : "Reserved";
      return (
        <Badge className={`${STATUS_STYLES.purple.badge} max-w-[160px]`} title={fullStatus}>
          <StatusDot color="purple" />
          <span className="truncate">{label}</span>
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
      // Bulk items: "N Available"
      if (/^\d+ Available$/.test(computedStatus)) {
        const qty = parseInt(computedStatus, 10);
        const color = qty === 0 ? "red" : "green";
        return (
          <Badge className={STATUS_STYLES[color].badge}>
            <StatusDot color={color} />
            {qty === 0 ? "None available" : computedStatus}
          </Badge>
        );
      }
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

  // Checkbox column — available to all users (for favorites and admin bulk actions)
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

  // Favorite star column
  columns.push({
    id: "favorite",
    header: () => <><Star className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Favorite</span></>,
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
          aria-label={asset.isFavorited ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={!!asset.isFavorited}
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
      enableSorting: true,
      cell: ({ row }) => {
        const item = row.original;
        const subtitle = item.name || [item.brand, item.model].filter(Boolean).join(" ");
        return (
          <div className="flex items-center gap-3 min-w-0">
            <AssetImage src={item.imageUrl} alt={item.assetTag} size={36} className="shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold truncate" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{item.assetTag}</span>
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
      cell: ({ row }) => statusBadge(row.original),
      enableSorting: false,
    },
    {
      header: "Category",
      id: "category",
      accessorFn: (row) => row.category?.name || row.type,
      cell: ({ row }) => (
        <span className="truncate block">{row.original.category?.name || row.original.type}</span>
      ),
      enableSorting: true,
    },
    {
      header: "Department",
      id: "department",
      accessorFn: (row) => row.department?.name ?? "",
      cell: ({ row }) => (
        <span className="truncate block">{row.original.department?.name ?? "—"}</span>
      ),
      enableSorting: true,
    },
    {
      header: "Location",
      id: "location",
      accessorFn: (row) => row.location.name,
      cell: ({ row }) => (
        <span className="truncate block">{row.original.location.name}</span>
      ),
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
