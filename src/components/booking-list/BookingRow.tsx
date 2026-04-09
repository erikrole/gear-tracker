"use client";

import { formatDateShort } from "@/lib/format";
import { formatDateCol, formatDuration, getStatusVisual, type BookingItem } from "./types";
import { BookingContextMenuWrapper, BookingOverflowMenu, type BookingMenuProps } from "./BookingContextMenu";
import { UserAvatar } from "@/components/UserAvatar";

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
  const sv = getStatusVisual(item.status, isOverdue);
  const from = formatDateCol(item.startsAt);
  const to = formatDateCol(item.endsAt);

  return (
    <BookingContextMenuWrapper item={item} {...menuProps}>
      <tr
        className={`${sv.className} cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]`}
        tabIndex={0}
        role="link"
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      >
        <td>
          <div className="flex flex-col gap-0.5">
            {item.refNumber && <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-px rounded mr-1.5 whitespace-nowrap tracking-[0.02em]">{item.refNumber}</span>}
            <span className="row-link" style={isOverdue ? { color: "var(--red)" } : undefined}>{item.title}</span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full shrink-0" style={{ background: sv.dot }} />
              <span className="text-muted-foreground">{sv.label}</span>
            </span>
          </div>
        </td>
        <td className="hide-mobile">
          <div className="flex flex-col gap-px">
            <span className="font-semibold text-sm">{from.date}</span>
            <span className="text-[10px] text-muted-foreground">{from.day} {from.time}</span>
          </div>
        </td>
        <td className="hide-mobile">
          <div className="flex flex-col gap-px">
            <span className="font-semibold text-sm">{to.date}</span>
            <span className="text-[10px] text-muted-foreground">{to.day} {to.time}</span>
          </div>
        </td>
        <td className="hide-mobile">{formatDuration(item.startsAt, item.endsAt)}</td>
        <td className="hide-mobile">
          <div className="flex items-center gap-2">
            <UserAvatar name={item.requester?.name ?? "Unknown"} avatarUrl={item.requester?.avatarUrl} />
            <span>{item.requester?.name ?? "Unknown"}</span>
          </div>
        </td>
        <td className="hide-mobile">{(item.serializedItems?.length ?? 0) + (item.bulkItems?.length ?? 0)}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <BookingOverflowMenu item={item} {...menuProps}>
            <button className="bg-transparent border-none text-muted-foreground text-xl p-1 px-2 cursor-pointer leading-none tracking-[2px] min-w-9 min-h-11 grid place-items-center [-webkit-tap-highlight-color:transparent] hover:text-foreground hover:bg-accent hover:rounded-md" aria-label="More actions">
              {"\u2026"}
            </button>
          </BookingOverflowMenu>
        </td>
      </tr>
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
  const sv = getStatusVisual(item.status, isOverdue);

  return (
    <div
      className={`px-3 py-3 border-b border-border cursor-pointer flex flex-col gap-1 active:bg-muted last:border-b-0 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] ${sv.className}`}
      tabIndex={0}
      role="link"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          {item.refNumber && <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-px rounded mr-1.5 whitespace-nowrap tracking-[0.02em]">{item.refNumber}</span>}
          <span className="row-link overflow-hidden text-ellipsis whitespace-nowrap" style={isOverdue ? { color: "var(--red)" } : undefined}>{item.title}</span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full shrink-0" style={{ background: sv.dot }} />
            <span className="text-muted-foreground">{sv.label}</span>
          </span>
        </div>
        <BookingOverflowMenu item={item} {...menuProps}>
          <button
            className="bg-transparent border-none text-muted-foreground text-xl p-1 px-2 cursor-pointer leading-none tracking-[2px] min-w-9 min-h-11 grid place-items-center [-webkit-tap-highlight-color:transparent] hover:text-foreground hover:bg-accent hover:rounded-md" aria-label="More actions"
            onClick={(e) => e.stopPropagation()}
          >
            {"\u2026"}
          </button>
        </BookingOverflowMenu>
      </div>
      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground items-center">
        <span>{formatDateShort(item.startsAt)} {"\u2013"} {formatDateShort(item.endsAt)}</span>
        <span>{"\u00b7"}</span>
        <UserAvatar name={item.requester?.name ?? "Unknown"} avatarUrl={item.requester?.avatarUrl} size="sm" />
        <span>{item.requester?.name ?? "Unknown"}</span>
        <span>{"\u00b7"}</span>
        <span>{formatDuration(item.startsAt, item.endsAt)}</span>
      </div>
    </div>
  );
}
