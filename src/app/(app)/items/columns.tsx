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
import { UserAvatar } from "@/components/UserAvatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ActiveBooking = {
  id: string;
  kind: string;
  title: string;
  requesterName: string;
  requesterAvatarUrl?: string | null;
  isOverdue?: boolean;
  endsAt?: string;
};

function formatDueLabel(endsAt: string | undefined, isOverdue: boolean | undefined): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(diffMs / dayMs);
  if (isOverdue) {
    const overdueDays = Math.max(1, Math.abs(days));
    return overdueDays === 1 ? "1d overdue" : `${overdueDays}d overdue`;
  }
  if (days <= 0) return "due today";
  if (days === 1) return "due 1d";
  if (days < 14) return `due ${days}d`;
  return null;
}

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

function formatDueAt(endsAt: string | undefined): string | null {
  if (!endsAt) return null;
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AssigneeStatus({
  color,
  label,
  name,
  avatarUrl,
  subText,
  endsAt,
}: {
  color: StatusColor;
  label: string;
  name?: string;
  avatarUrl?: string | null;
  subText?: string | null;
  endsAt?: string;
}) {
  const dueAt = formatDueAt(endsAt);
  const labelTooltip = dueAt ? `Due ${dueAt}` : label;

  if (!name) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={STATUS_STYLES[color].badge}>
            <StatusDot color={color} />
            {label}
            {subText && (
              <span className="ml-1 text-[10px] font-normal opacity-80 tabular-nums">· {subText}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{labelTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 rounded-full pl-[3px] pr-2 py-[3px] ${STATUS_STYLES[color].badge}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">
            <UserAvatar name={name} avatarUrl={avatarUrl} size="sm" className="size-[18px] text-[9px]" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-[11px] font-semibold uppercase tracking-wide cursor-default">
            {label}
            {subText && (
              <span className="ml-1 font-normal opacity-80 tabular-nums normal-case">· {subText}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>{labelTooltip}</TooltipContent>
      </Tooltip>
    </div>
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
      const isOverdue = activeBooking?.isOverdue;
      const color = isOverdue ? "red" : "blue";
      const due = formatDueLabel(activeBooking?.endsAt, isOverdue);
      return (
        <AssigneeStatus
          color={color}
          label={isOverdue ? "Overdue" : "Checked out"}
          name={activeBooking?.requesterName}
          avatarUrl={activeBooking?.requesterAvatarUrl}
          subText={due}
          endsAt={activeBooking?.endsAt}
        />
      );
    }
    case "RESERVED": {
      return (
        <AssigneeStatus
          color="purple"
          label="Reserved"
          name={activeBooking?.requesterName}
          avatarUrl={activeBooking?.requesterAvatarUrl}
          endsAt={activeBooking?.endsAt}
        />
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
      <div
        className="-m-2 p-2 inline-flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
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
        const rawSubtitle = item.name || [item.brand, item.model].filter(Boolean).join(" ");
        // Hide subtitle when it duplicates the assetTag (case-insensitive, trimmed) — pure noise.
        const subtitle =
          rawSubtitle && rawSubtitle.trim().toLowerCase() !== item.assetTag.trim().toLowerCase()
            ? rawSubtitle
            : null;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <AssetImage src={item.imageUrl} alt={item.assetTag} size={36} />
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
      cell: ({ row }) => (
        <div className="flex items-center">
          {statusBadge(row.original)}
        </div>
      ),
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
                className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
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
