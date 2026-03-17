"use client";

import { formatDateShort } from "@/lib/format";
import { formatDateCol, formatDuration, getStatusVisual, type BookingItem } from "./types";

/* ───── Desktop table row ───── */

export type BookingTableRowProps = {
  item: BookingItem;
  overdueStatus: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onOverflow: (e: React.MouseEvent) => void;
};

export function BookingTableRow({
  item,
  overdueStatus,
  onClick,
  onContextMenu,
  onOverflow,
}: BookingTableRowProps) {
  const isOverdue = item.status === overdueStatus && new Date(item.endsAt) < new Date();
  const sv = getStatusVisual(item.status, isOverdue);
  const from = formatDateCol(item.startsAt);
  const to = formatDateCol(item.endsAt);

  return (
    <tr
      className={`${sv.className} cursor-pointer`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <td>
        <div className="booking-name-cell">
          {item.refNumber && <span className="ref-number">{item.refNumber}</span>}
          <span className="row-link">{item.title}</span>
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
        <button className="overflow-btn" aria-label="More actions" onClick={onOverflow}>
          {"\u2026"}
        </button>
      </td>
    </tr>
  );
}

/* ───── Mobile card ───── */

export type BookingMobileCardProps = {
  item: BookingItem;
  overdueStatus: string;
  onClick: () => void;
  onOverflow: (e: React.MouseEvent) => void;
};

export function BookingMobileCard({
  item,
  overdueStatus,
  onClick,
  onOverflow,
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
          <span className="row-link">{item.title}</span>
          <span className="booking-status-line">
            <span className="status-dot" style={{ background: sv.dot }} />
            <span className="status-label">{sv.label}</span>
          </span>
        </div>
        <button
          className="overflow-btn" aria-label="More actions"
          onClick={(e) => { e.stopPropagation(); onOverflow(e); }}
        >
          {"\u2026"}
        </button>
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
