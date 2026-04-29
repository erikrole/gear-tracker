"use client";

import { formatDuration, getStatusVisual, type BookingItem } from "./types";
import { cn } from "@/lib/utils";
import { BookingContextMenuWrapper, BookingOverflowMenu, type BookingMenuProps } from "./BookingContextMenu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { MoreHorizontalIcon } from "lucide-react";

/* ───── Helpers ───── */

function formatCardDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      {shown.map((si) => (
        <Avatar key={si.asset.assetTag} size="sm" className="border-2 border-card bg-muted">
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
  const sv = getStatusVisual(item.status, isOverdue, item.kind);
  const duration = formatDuration(item.startsAt, item.endsAt);

  return (
    <BookingContextMenuWrapper item={item} {...menuProps}>
      <div
        className={cn(
          "group relative rounded-lg border bg-card overflow-hidden cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
          isOverdue && "border-[var(--wi-red)]/25 bg-[var(--wi-red)]/[0.02]",
        )}
        role="button"
        tabIndex={0}
        aria-label={`View booking: ${item.title}`}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      >
        {/* Status left-border accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: sv.dot }}
          aria-hidden="true"
        />

        <div className="p-4 pl-5">
          {/* Top row: status indicator + duration */}
          <div className="flex items-center justify-between mb-2.5 pr-10">
            <div className="flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ background: sv.dot }}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.16em] font-semibold",
                  isOverdue ? "text-destructive" : "text-muted-foreground/70",
                )}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {sv.label}
              </span>
            </div>
            <span
              className="text-[10.5px] text-muted-foreground/50 tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {duration}
            </span>
          </div>

          {/* Ref number */}
          {item.refNumber && (
            <div className="mb-1">
              <span
                className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/40"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                #{item.refNumber}
              </span>
            </div>
          )}

          {/* Title */}
          <h3
            className={cn(
              "text-[14.5px] leading-snug mb-2 line-clamp-2 pr-6",
              sv.titleClass,
            )}
            style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
          >
            {item.title}
          </h3>

          {/* Date + location */}
          <div
            className="flex items-center gap-2 text-[11px] text-muted-foreground/60 mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="whitespace-nowrap">
              {formatCardDate(item.startsAt)} · {formatCardTime(item.startsAt)}
            </span>
            {item.location?.name && (
              <>
                <span className="text-muted-foreground/30" aria-hidden="true">/</span>
                <span className="truncate">{item.location.name}</span>
              </>
            )}
          </div>

          {/* Bottom row: user + gear */}
          <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar size="sm" className="border border-border shrink-0">
                {item.requester?.avatarUrl ? (
                  <AvatarImage src={item.requester.avatarUrl} alt={item.requester.name} />
                ) : null}
                <AvatarFallback className="text-[10px] font-semibold">
                  {getInitials(item.requester?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <span
                className="text-[12px] truncate"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
              >
                {item.requester?.name ?? "Unknown"}
              </span>
            </div>

            <GearAvatarStack
              items={item.serializedItems}
              bulkItems={item.bulkItems}
            />
          </div>
        </div>

        {/* Overflow menu — top-right, always visible on touch, reveal on hover for pointer devices */}
        <div
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
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
