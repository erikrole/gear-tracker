"use client";

import { formatDuration, getStatusVisual, type BookingItem } from "./types";
import { cn } from "@/lib/utils";
import { BookingContextMenuWrapper, BookingOverflowMenu, type BookingMenuProps } from "./BookingContextMenu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { MoreHorizontalIcon, MapPinIcon, CalendarIcon } from "lucide-react";

/* ───── Helpers ───── */

function formatCardDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatCardTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

/* ───── Gear avatar stack ───── */

function GearAvatarStack({ items, bulkItems }: {
  items: BookingItem["serializedItems"];
  bulkItems: BookingItem["bulkItems"];
}) {
  const totalBulk = bulkItems?.reduce((sum, bi) => sum + (bi.plannedQuantity || 1), 0) ?? 0;
  const totalCount = (items?.length ?? 0) + totalBulk;
  const shown = items?.slice(0, 3) ?? [];
  const overflow = totalCount - shown.length;

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((si, i) => (
        <Avatar key={i} size="sm" className="border-2 border-card bg-muted">
          {si.asset.imageUrl ? (
            <AvatarImage src={si.asset.imageUrl} alt={si.asset.assetTag} />
          ) : null}
          <AvatarFallback className="text-[9px] font-semibold bg-muted text-muted-foreground">
            {si.asset.brand?.[0] ?? si.asset.assetTag?.[0] ?? "?"}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span className="flex items-center justify-center size-6 rounded-full border-2 border-card bg-[var(--elevated)] text-[10px] font-semibold text-muted-foreground">
          +{overflow > 99 ? "99" : overflow}
        </span>
      )}
    </div>
  );
}

/* ───── BookingCard ───── */

export type BookingCardProps = {
  item: BookingItem;
  overdueStatus: string;
  onClick: () => void;
  menuProps: Omit<BookingMenuProps, "item">;
};

export function BookingCard({ item, overdueStatus, onClick, menuProps }: BookingCardProps) {
  const isOverdue = item.status === overdueStatus && new Date(item.endsAt) < new Date();
  const sv = getStatusVisual(item.status, isOverdue);
  const duration = formatDuration(item.startsAt, item.endsAt);

  return (
    <BookingContextMenuWrapper item={item} {...menuProps}>
      <div
        className="group relative rounded-lg border border-border bg-card p-4 cursor-pointer transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
        role="button"
        tabIndex={0}
        aria-label={`View booking: ${item.title}`}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      >
        {/* Top row: status + date range */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ background: sv.dot }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-muted-foreground">
              {sv.label}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {duration}
          </span>
        </div>

        {/* Title */}
        <h3 className={cn("text-[15px] font-semibold leading-snug mb-1 line-clamp-2 pr-6 text-foreground", sv.titleClass)}>
          {item.title}
        </h3>

        {/* Date + location row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <CalendarIcon className="size-3 text-muted-foreground" />
            {formatCardDate(item.startsAt)} · {formatCardTime(item.startsAt)}
          </span>
          {item.location?.name && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="size-3 text-muted-foreground" />
              {item.location.name}
            </span>
          )}
        </div>

        {/* Bottom row: user avatar + gear avatars */}
        <div className="flex items-center justify-between pt-3 border-t border-dashed border-border">
          {/* User */}
          <div className="flex items-center gap-2">
            <Avatar size="sm" className="border border-border">
              {item.requester?.avatarUrl ? (
                <AvatarImage src={item.requester.avatarUrl} alt={item.requester.name} />
              ) : null}
              <AvatarFallback className="text-[10px] font-semibold">
                {getInitials(item.requester?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground">
              {item.requester?.name ?? "Unknown"}
            </span>
          </div>

          {/* Gear */}
          <GearAvatarStack
            items={item.serializedItems}
            bulkItems={item.bulkItems}
          />
        </div>

        {/* Overflow menu — top-right */}
        <div
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <BookingOverflowMenu item={item} {...menuProps}>
            <button
              className="flex items-center justify-center size-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="More actions"
            >
              <MoreHorizontalIcon className="size-4" />
            </button>
          </BookingOverflowMenu>
        </div>
      </div>
    </BookingContextMenuWrapper>
  );
}
