"use client";

import Link from "next/link";
import type { BookingDetail } from "./types";

type Props = {
  booking: BookingDetail;
  canEdit: boolean;
  canCheckin: boolean;
  canConvert: boolean;
  canCancel: boolean;
  checkinLoading: boolean;
  converting: boolean;
  cancelling: boolean;
  onEdit: () => void;
  onCheckinAll: () => void;
  onConvert: () => void;
  onCancel: () => void;
};

export default function BookingActions({
  booking,
  canEdit,
  canCheckin,
  canConvert,
  canCancel,
  checkinLoading,
  converting,
  cancelling,
  onEdit,
  onCheckinAll,
  onConvert,
  onCancel,
}: Props) {
  return (
    <div className="sheet-actions">
      {canEdit && (
        <button className="btn btn-primary" onClick={onEdit}>Edit</button>
      )}
      {canCheckin && (
        <button
          className="btn btn-checkin"
          disabled={checkinLoading}
          onClick={onCheckinAll}
        >
          {checkinLoading ? "Checking in..." : "Check in all"}
        </button>
      )}
      {canConvert && (
        <button className="btn btn-primary" onClick={onConvert} disabled={converting}>
          {converting ? "Converting..." : "Start checkout"}
        </button>
      )}
      {canCancel && (
        <button className="btn btn-danger" onClick={onCancel} disabled={cancelling}>
          {cancelling ? "Cancelling..." : booking.kind === "RESERVATION" ? "Cancel reservation" : "Cancel checkout"}
        </button>
      )}
      <Link
        href={booking.kind === "CHECKOUT" ? `/checkouts/${booking.id}` : `/reservations/${booking.id}`}
        className="btn btn-full-page"
      >
        Full page
      </Link>
    </div>
  );
}
