"use client";

import { formatDateShort } from "@/lib/format";
import { formatDateCol, formatDuration, getStatusVisual, type BookingItem } from "./types";
import { BookingContextMenuWrapper, BookingOverflowMenu, type BookingMenuProps } from "./BookingContextMenu";

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
        className={`${sv.className} cursor-pointer`}
        onClick={onClick}
      >
        <td>
          <div className="booking-name-cell">
            {item.refNumber && <span className="ref-number">{item.refNumber}</span>}
            <span className="row-link" style={isOverdue ? { color: "var(--red)" } : undefined}>{item.title}</span>
            <span className="booking-status-line">
              <span className="status-dot" style={{ background: sv.dot }} />
              <span className="status-label">{sv.label}</span>
            </span>
          </div>
        </td>
        <td className="hide-mobile">
          <div className="date-cell">
            <span className="date-main">{from.date}</span>
            <span className="date-sub">{from.day} {from.time}</span>
          </div>
        </td>
        <td className="hide-mobile">
          <div className="date-cell">
            <span className="date-main">{to.date}</span>
            <span className="date-sub">{to.day} {to.time}</span>
          </div>
        </td>
        <td className="hide-mobile">{formatDuration(item.startsAt, item.endsAt)}</td>
        <td className="hide-mobile">{item.requester?.name ?? "Unknown"}</td>
        <td className="hide-mobile">{(item.serializedItems?.length ?? 0) + (item.bulkItems?.length ?? 0)}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <BookingOverflowMenu item={item} {...menuProps}>
            <button className="overflow-btn" aria-label="More actions">
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
      className={`booking-mobile-card ${sv.className}`}
      onClick={onClick}
    >
      <div className="booking-mobile-top">
        <div className="booking-mobile-name">
          {item.refNumber && <span className="ref-number">{item.refNumber}</span>}
          <span className="row-link" style={isOverdue ? { color: "var(--red)" } : undefined}>{item.title}</span>
          <span className="booking-status-line">
            <span className="status-dot" style={{ background: sv.dot }} />
            <span className="status-label">{sv.label}</span>
          </span>
        </div>
        <BookingOverflowMenu item={item} {...menuProps}>
          <button
            className="overflow-btn" aria-label="More actions"
            onClick={(e) => e.stopPropagation()}
          >
            {"\u2026"}
          </button>
        </BookingOverflowMenu>
      </div>
      <div className="booking-mobile-meta">
        <span>{formatDateShort(item.startsAt)} {"\u2013"} {formatDateShort(item.endsAt)}</span>
        <span>{"\u00b7"}</span>
        <span>{item.requester?.name ?? "Unknown"}</span>
        <span>{"\u00b7"}</span>
        <span>{formatDuration(item.startsAt, item.endsAt)}</span>
      </div>
    </div>
  );
}
