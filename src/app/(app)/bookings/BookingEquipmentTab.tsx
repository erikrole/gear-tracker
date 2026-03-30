"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ImageIcon, MoreHorizontal, Search } from "lucide-react";
import type { BookingDetail, SerializedItem, BulkItem } from "@/components/booking-details/types";

type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

export default function BookingEquipmentTab({
  booking,
}: {
  booking: BookingDetail;
}) {
  const [search, setSearch] = useState("");
  const isCheckout = booking.kind === "CHECKOUT";

  const itemCount = booking.serializedItems.length + booking.bulkItems.length;

  // Checkin progress for checkouts
  const returnedSerialized = booking.serializedItems.filter(
    (i) => i.allocationStatus === "returned",
  ).length;
  const totalBulkOut = booking.bulkItems.reduce(
    (sum, i) => sum + (i.checkedOutQuantity ?? i.plannedQuantity),
    0,
  );
  const totalBulkIn = booking.bulkItems.reduce(
    (sum, i) => sum + (i.checkedInQuantity ?? 0),
    0,
  );
  const totalOut = booking.serializedItems.length + totalBulkOut;
  const totalReturned = returnedSerialized + totalBulkIn;
  const showProgress = isCheckout && totalReturned > 0 && totalOut > 0;

  // ── Conflict checking for active bookings ──
  const isActive = booking.status === "BOOKED" || booking.status === "DRAFT";
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const fetchConflicts = useCallback(async () => {
    if (!isActive || booking.serializedItems.length === 0) {
      setConflicts(new Map());
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/availability/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          locationId: booking.location.id,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          serializedAssetIds: booking.serializedItems.map((i) => i.asset.id),
          bulkItems: [],
          excludeBookingId: booking.id,
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data as {
        conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
      };
      const map = new Map<string, ConflictInfo>();
      if (data.conflicts) {
        for (const c of data.conflicts) {
          map.set(c.assetId, {
            assetId: c.assetId,
            conflictingBookingTitle: c.conflictingBookingTitle,
            startsAt: c.startsAt,
            endsAt: c.endsAt,
          });
        }
      }
      setConflicts(map);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, [isActive, booking.id, booking.location.id, booking.startsAt, booking.endsAt, booking.serializedItems]);

  useEffect(() => {
    fetchConflicts();
    return () => { abortRef.current?.abort(); };
  }, [fetchConflicts]);

  const filteredSerialized = useMemo(() => {
    if (!search) return booking.serializedItems;
    const q = search.toLowerCase();
    return booking.serializedItems.filter(
      (item) =>
        item.asset.assetTag.toLowerCase().includes(q) ||
        item.asset.brand?.toLowerCase().includes(q) ||
        item.asset.model?.toLowerCase().includes(q) ||
        item.asset.serialNumber?.toLowerCase().includes(q),
    );
  }, [booking.serializedItems, search]);

  const filteredBulk = useMemo(() => {
    if (!search) return booking.bulkItems;
    const q = search.toLowerCase();
    return booking.bulkItems.filter((item) =>
      item.bulkSku.name.toLowerCase().includes(q),
    );
  }, [booking.bulkItems, search]);

  return (
    <Card className="border-border/40 shadow-none">
      {/* Header */}
      <CardHeader className="pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Equipment
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            </CardTitle>
            {showProgress && (
              <div className="flex items-center gap-2 mt-1">
                <Progress
                  value={Math.round((totalReturned / totalOut) * 100)}
                  className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-green-500"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  {totalReturned}/{totalOut} returned
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Search */}
      {itemCount > 3 && (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              aria-label="Search equipment"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8"
            />
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="p-2 pt-3">
        {filteredSerialized.length === 0 && filteredBulk.length === 0 ? (
          <Empty className="py-8 border-0">
            <EmptyDescription>
              {search ? "No items match your search." : "No items in this booking."}
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredSerialized.map((item) => (
              <SerializedRow
                key={item.id}
                item={item}
                isCheckout={isCheckout}
                conflict={conflicts.get(item.asset.id)}
              />
            ))}
            {filteredBulk.map((item) => (
              <BulkRow
                key={item.id}
                item={item}
                isCheckout={isCheckout}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Thumbnail helper ── */

function ItemThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  if (src) {
    return (
      <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0">
        <Image
          src={src}
          alt={alt}
          width={40}
          height={40}
          className="size-full object-cover"
          unoptimized={!src.includes(".public.blob.vercel-storage.com")}
        />
      </div>
    );
  }
  return (
    <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
      <ImageIcon className="size-4 text-muted-foreground/50" />
    </div>
  );
}

/* ── Serialized item row ── */

function SerializedRow({
  item,
  isCheckout,
  conflict,
}: {
  item: SerializedItem;
  isCheckout: boolean;
  conflict?: ConflictInfo;
}) {
  const returned = item.allocationStatus === "returned";

  return (
    <div className={`group/row flex items-center gap-3 px-3 py-2.5 rounded-md ${returned ? "opacity-60" : "hover:bg-muted/50"}`}>
      {/* Returned indicator */}
      {isCheckout && returned && (
        <div className="shrink-0">
          <div className="size-5 rounded-full bg-green-600 text-white flex items-center justify-center">
            <Check className="size-3" />
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <ItemThumbnail src={item.asset.imageUrl} alt={item.asset.assetTag} />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/items/${item.asset.id}`}
          className="font-medium text-sm hover:underline truncate block"
        >
          {item.asset.assetTag}
        </Link>
        <div className="text-xs text-muted-foreground truncate">
          {item.asset.brand} {item.asset.model}
          {item.asset.serialNumber && (
            <span className="ml-1.5 font-mono">{item.asset.serialNumber}</span>
          )}
        </div>
      </div>

      {/* Status + row actions */}
      <div className="shrink-0 flex items-center gap-1.5">
        {conflict && !returned && (
          <Badge variant="orange" size="sm" title={
            conflict.conflictingBookingTitle
              ? `Conflicts with ${conflict.conflictingBookingTitle}`
              : "Scheduling conflict"
          }>
            Conflict
          </Badge>
        )}
        {returned && (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Returned
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="size-7 flex items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground sm:opacity-0 sm:group-hover/row:opacity-100 focus:opacity-100 transition-opacity">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Item actions</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/items/${item.asset.id}`}>View item</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ── Bulk item row ── */

function BulkRow({
  item,
  isCheckout,
}: {
  item: BulkItem;
  isCheckout: boolean;
}) {
  const outQty = item.checkedOutQuantity ?? item.plannedQuantity;
  const inQty = item.checkedInQuantity ?? 0;
  const allReturned = isCheckout && inQty >= outQty;

  return (
    <div className={`group/row flex items-center gap-3 px-3 py-2.5 rounded-md ${allReturned ? "opacity-60" : "hover:bg-muted/50"}`}>
      {/* Returned indicator */}
      {isCheckout && allReturned && (
        <div className="shrink-0">
          <div className="size-5 rounded-full bg-green-600 text-white flex items-center justify-center">
            <Check className="size-3" />
          </div>
        </div>
      )}

      {/* Placeholder thumbnail */}
      <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
        <ImageIcon className="size-4 text-muted-foreground/50" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-sm truncate block">
          {item.bulkSku?.name ?? "Unknown"}
        </span>
        <div className="text-xs text-muted-foreground">
          {isCheckout && inQty > 0
            ? `${inQty} / ${outQty} returned`
            : `Qty: ${isCheckout ? outQty : item.plannedQuantity}`}{" "}
          <span className="text-muted-foreground/60">{item.bulkSku.unit}</span>
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0 text-right">
        {allReturned ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Returned
          </span>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">
            {isCheckout ? outQty : item.plannedQuantity}
          </span>
        )}
      </div>
    </div>
  );
}
