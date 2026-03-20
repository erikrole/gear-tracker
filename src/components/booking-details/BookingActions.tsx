"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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
        <Button onClick={onEdit}>Edit</Button>
      )}
      {canCheckin && (
        <Button
          className="btn-checkin"
          disabled={checkinLoading}
          onClick={onCheckinAll}
        >
          {checkinLoading ? "Checking in..." : "Check in all"}
        </Button>
      )}
      {canConvert && (
        <Button onClick={onConvert} disabled={converting}>
          {converting ? "Converting..." : "Start checkout"}
        </Button>
      )}
      {canCancel && (
        <Button variant="destructive" onClick={onCancel} disabled={cancelling}>
          {cancelling ? "Cancelling..." : booking.kind === "RESERVATION" ? "Cancel reservation" : "Cancel checkout"}
        </Button>
      )}
      <Button variant="outline" className="btn-full-page" asChild>
        <Link href={booking.kind === "CHECKOUT" ? `/checkouts/${booking.id}` : `/reservations/${booking.id}`}>
          Full page
        </Link>
      </Button>
    </div>
  );
}
