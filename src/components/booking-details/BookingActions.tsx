"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLinkIcon } from "lucide-react";
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
  const detailHref = booking.kind === "CHECKOUT" ? `/checkouts/${booking.id}` : `/reservations/${booking.id}`;

  return (
    <div className="flex items-center gap-2">
      {/* Secondary actions (left) */}
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
      )}
      {canCancel && (
        <Button variant="destructive" size="sm" onClick={onCancel} disabled={cancelling}>
          {cancelling ? "Cancelling..." : "Cancel"}
        </Button>
      )}

      <div className="flex-1" />

      {/* Primary actions (right) */}
      {canCheckin && (
        <Button
          size="sm"
          variant="brand"
          disabled={checkinLoading}
          onClick={onCheckinAll}
        >
          {checkinLoading ? "Checking in..." : "Check in all"}
        </Button>
      )}
      {canConvert && (
        <Button size="sm" variant="brand" onClick={onConvert} disabled={converting}>
          {converting ? "Converting..." : "Start checkout"}
        </Button>
      )}
      <Button variant="ghost" size="sm" asChild>
        <Link href={detailHref}>
          Full page <ExternalLinkIcon className="size-3.5 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
