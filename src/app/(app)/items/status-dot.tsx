"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Asset = {
  computedStatus: string;
  activeBooking: {
    id: string;
    kind: string;
    title: string;
    requesterName: string;
  } | null;
};

const statusDotClass: Record<string, string> = {
  AVAILABLE: "status-available",
  CHECKED_OUT: "status-checked-out",
  RESERVED: "status-reserved",
  MAINTENANCE: "status-maintenance",
  RETIRED: "status-retired",
};

export function StatusDot({ item }: { item: Asset }) {
  const [open, setOpen] = useState(false);
  const hasBooking = item.activeBooking !== null;
  const label = item.computedStatus.replace("_", " ").toLowerCase();
  const bookingPath = item.activeBooking
    ? item.activeBooking.kind === "CHECKOUT"
      ? `/checkouts/${item.activeBooking.id}`
      : `/reservations/${item.activeBooking.id}`
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="relative inline-flex shrink-0"
          onMouseEnter={() => hasBooking && setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <span
            onClick={(e) => {
              if (hasBooking) {
                e.stopPropagation();
                setOpen((v) => !v);
              }
            }}
            className={`status-dot ${statusDotClass[item.computedStatus] || "status-retired"} ${hasBooking ? "cursor-pointer" : "cursor-default"}`}
          />
        </span>
      </PopoverTrigger>
      {hasBooking && item.activeBooking && (
        <PopoverContent
          side="right"
          sideOffset={8}
          className="w-auto max-w-[240px]"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold mb-1 capitalize">{label}</div>
          <div className="text-muted-foreground text-sm mb-2">
            {item.activeBooking.title} &middot;{" "}
            {item.activeBooking.requesterName}
          </div>
          {bookingPath && (
            <Link
              href={bookingPath}
              className="text-sm font-medium text-primary no-underline hover:underline"
            >
              View{" "}
              {item.activeBooking.kind === "CHECKOUT"
                ? "checkout"
                : "reservation"}{" "}
              &rarr;
            </Link>
          )}
        </PopoverContent>
      )}
    </Popover>
  );
}
