"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Check, ImageIcon, Search } from "lucide-react";
import type { BookingDetail, SerializedItem, BulkItem } from "@/components/booking-details/types";

export default function BookingEquipmentTab({
  booking,
  canCheckin,
  checkinIds,
  onToggleCheckin,
  onCheckinSelected,
  onSelectAll,
  onClearSelection,
  bulkReturnQty,
  onBulkReturnQtyChange,
  onBulkReturn,
  actionLoading,
}: {
  booking: BookingDetail;
  canCheckin: boolean;
  checkinIds: Set<string>;
  onToggleCheckin: (assetId: string) => void;
  onCheckinSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  bulkReturnQty: Record<string, number>;
  onBulkReturnQtyChange: (id: string, qty: number) => void;
  onBulkReturn: (bulkItemId: string) => void;
  actionLoading: string | null;
}) {
  const [search, setSearch] = useState("");
  const isCheckout = booking.kind === "CHECKOUT";

  const itemCount = booking.serializedItems.length + booking.bulkItems.length;
  const returnableCount = booking.serializedItems.filter(
    (i) => i.allocationStatus !== "returned",
  ).length;

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
        <div className="flex items-center justify-between">
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
          {canCheckin && (
            <div className="flex items-center gap-2">
              {returnableCount > 0 && (
                checkinIds.size === returnableCount ? (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={onClearSelection}>
                    Clear selection
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={onSelectAll}>
                    Select all
                  </Button>
                )
              )}
              {checkinIds.size > 0 && (
                <Button size="sm" onClick={onCheckinSelected} disabled={!!actionLoading}>
                  {actionLoading === "checkin"
                    ? "Returning..."
                    : `Return ${checkinIds.size} item${checkinIds.size > 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          )}
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
                canCheckin={canCheckin}
                checked={checkinIds.has(item.asset.id)}
                onToggle={() => onToggleCheckin(item.asset.id)}
              />
            ))}
            {filteredBulk.map((item) => (
              <BulkRow
                key={item.id}
                item={item}
                isCheckout={isCheckout}
                canCheckin={canCheckin}
                returnQty={bulkReturnQty[item.id] || 0}
                onQtyChange={(qty) => onBulkReturnQtyChange(item.id, qty)}
                onReturn={() => onBulkReturn(item.id)}
                actionLoading={actionLoading}
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
  canCheckin,
  checked,
  onToggle,
}: {
  item: SerializedItem;
  isCheckout: boolean;
  canCheckin: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const returned = item.allocationStatus === "returned";

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${returned ? "opacity-60" : "hover:bg-muted/50"}`}>
      {/* Checkbox / returned indicator */}
      {isCheckout && canCheckin && (
        <div className="shrink-0">
          {returned ? (
            <div className="size-5 rounded-full bg-green-600 text-white flex items-center justify-center">
              <Check className="size-3" />
            </div>
          ) : (
            <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${item.asset.assetTag} for return`} />
          )}
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

      {/* Status / qty */}
      <div className="shrink-0 text-right">
        {returned ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Returned
          </span>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">1</span>
        )}
      </div>
    </div>
  );
}

/* ── Bulk item row ── */

function BulkRow({
  item,
  isCheckout,
  canCheckin,
  returnQty,
  onQtyChange,
  onReturn,
  actionLoading,
}: {
  item: BulkItem;
  isCheckout: boolean;
  canCheckin: boolean;
  returnQty: number;
  onQtyChange: (qty: number) => void;
  onReturn: () => void;
  actionLoading: string | null;
}) {
  const outQty = item.checkedOutQuantity ?? item.plannedQuantity;
  const inQty = item.checkedInQuantity ?? 0;
  const allReturned = isCheckout && inQty >= outQty;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${allReturned ? "opacity-60" : "hover:bg-muted/50"}`}>
      {/* Spacer for checkbox column */}
      {isCheckout && canCheckin && (
        <div className="shrink-0 w-5">
          {allReturned && (
            <div className="size-5 rounded-full bg-green-600 text-white flex items-center justify-center">
              <Check className="size-3" />
            </div>
          )}
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

      {/* Return controls / status */}
      <div className="shrink-0 text-right">
        {allReturned ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Returned
          </span>
        ) : isCheckout && canCheckin ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              max={outQty - inQty}
              value={returnQty || ""}
              onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)}
              placeholder={String(outQty - inQty)}
              aria-label={`Return quantity for ${item.bulkSku?.name}`}
              className="h-7 w-14 text-center text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={!returnQty || actionLoading === `bulk-${item.id}`}
              onClick={onReturn}
            >
              {actionLoading === `bulk-${item.id}` ? "..." : "Return"}
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">
            {isCheckout ? outQty : item.plannedQuantity}
          </span>
        )}
      </div>
    </div>
  );
}
