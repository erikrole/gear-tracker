"use client";

import { formatDateShort } from "@/lib/format";
import { formatDateCol, formatDuration, getStatusVisual, type BookingItem } from "./types";
import { BookingContextMenuWrapper, BookingOverflowMenu, type BookingMenuProps } from "./BookingContextMenu";
import { UserAvatar } from "@/components/UserAvatar";
import { TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ───── Desktop table row ───── */

export type BookingTableRowProps = {
  item: BookingItem;
  overdueStatus: string;
  onClick: () => void;
  menuProps: Omit<BookingMenuProps, "item">;
};

export function BookingTableRow({
  item,
  overdueStatus,
  onClick,
  menuProps,
}: BookingTableRowProps) {
  const isOverdue = item.status === overdueStatus && new Date(item.endsAt) < new Date();
  const sv = getStatusVisual(item.status, isOverdue, item.kind);
  const from = formatDateCol(item.startsAt);
  const to = formatDateCol(item.endsAt);

  return (
    <BookingContextMenuWrapper item={item} {...menuProps}>
      <TableRow
        className={cn(
          "cursor-pointer",
          sv.rowClass,
        )}
        onClick={onClick}
      >
        <TableCell>
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 rounded-sm bg-transparent text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label={`View booking: ${item.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {item.refNumber && (
              <span
                className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/40 w-fit"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                #{item.refNumber}
              </span>
            )}
            <span
              className={cn("leading-snug", sv.titleClass)}
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "13.5px" }}
            >
              {item.title}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full shrink-0" style={{ background: sv.dot }} />
              <span
                className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground/60"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {sv.label}
              </span>
            </span>
          </button>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex flex-col gap-px">
            <span
              className="text-[13px] font-semibold tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {from.date}
            </span>
            <span
              className="text-[10px] text-muted-foreground/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {from.day} {from.time}
            </span>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex flex-col gap-px">
            <span
              className="text-[13px] font-semibold tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {to.date}
            </span>
            <span
              className="text-[10px] text-muted-foreground/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {to.day} {to.time}
            </span>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <span className="text-[12px] text-muted-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
            {formatDuration(item.startsAt, item.endsAt)}
          </span>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex items-center gap-2">
            <UserAvatar name={item.requester?.name ?? "Unknown"} avatarUrl={item.requester?.avatarUrl} />
            <span
              className="text-[13px]"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
            >
              {item.requester?.name ?? "Unknown"}
            </span>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <span className="text-[12px] text-muted-foreground/60 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
            {(item.serializedItems?.length ?? 0) + (item.bulkItems?.reduce((sum, bulkItem) => sum + (bulkItem.plannedQuantity || 0), 0) ?? 0)}
          </span>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <BookingOverflowMenu item={item} {...menuProps} />
        </TableCell>
      </TableRow>
    </BookingContextMenuWrapper>
  );
}

/* ───── Mobile card ───── */

export type BookingMobileCardProps = {
  item: BookingItem;
  overdueStatus: string;
  onClick: () => void;
  menuProps: Omit<BookingMenuProps, "item">;
};

export function BookingMobileCard({
  item,
  overdueStatus,
  onClick,
  menuProps,
}: BookingMobileCardProps) {
  const isOverdue = item.status === overdueStatus && new Date(item.endsAt) < new Date();
  const sv = getStatusVisual(item.status, isOverdue, item.kind);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 overflow-hidden border-b border-border px-4 py-3 active:bg-muted last:border-b-0",
        sv.rowClass,
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-10 cursor-pointer bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
        aria-label={`View booking: ${item.title}`}
        onClick={onClick}
      />

      {/* Status left accent */}
      <div
        className="absolute left-0 top-0 bottom-0 z-0 w-[3px]"
        style={{ background: sv.dot }}
        aria-hidden="true"
      />

      <div className="pointer-events-none relative z-20 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          {item.refNumber && (
            <span
              className="text-[9px] uppercase tracking-[0.13em] text-muted-foreground/40 w-fit"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              #{item.refNumber}
            </span>
          )}
          <span
            className={cn("overflow-hidden text-ellipsis whitespace-nowrap", sv.titleClass)}
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "13.5px" }}
          >
            {item.title}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full shrink-0" style={{ background: sv.dot }} />
            <span
              className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {sv.label}
            </span>
          </span>
        </div>
        <div className="pointer-events-auto relative z-20" onClick={(e) => e.stopPropagation()}>
          <BookingOverflowMenu item={item} {...menuProps} />
        </div>
      </div>

      <div
        className="pointer-events-none relative z-0 flex flex-wrap items-center gap-1 text-muted-foreground/55"
        style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
      >
        <span className="tabular-nums">{formatDateShort(item.startsAt)} – {formatDateShort(item.endsAt)}</span>
        <span aria-hidden="true">·</span>
        <UserAvatar name={item.requester?.name ?? "Unknown"} avatarUrl={item.requester?.avatarUrl} size="sm" />
        <span>{item.requester?.name ?? "Unknown"}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{formatDuration(item.startsAt, item.endsAt)}</span>
      </div>
    </div>
  );
}
