"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AssetImage } from "@/components/AssetImage";
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
import { Button } from "@/components/ui/button";
import { Check, ImageIcon, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import type { BookingDetail, SerializedItem, BulkItem } from "@/components/booking-details/types";
import { handleAuthRedirect, isAbortError, parseJsonSafely } from "@/lib/errors";

type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

type UpcomingCommitmentInfo = {
  assetId: string;
  bookingId: string;
  bookingTitle?: string;
  startsAt: string;
  endsAt: string;
  status: string;
  nextLocationId?: string | null;
  nextLocationName?: string | null;
};

type TurnaroundRiskInfo = {
  assetId: string;
  code: "SHORT_TURNAROUND" | "LOCATION_TRANSFER" | "RECENT_CHECKIN_REPORT";
  severity: "warning" | "critical";
  message: string;
  bookingId?: string;
  bookingTitle?: string;
  startsAt?: string;
  gapMinutes?: number;
  nextLocationName?: string | null;
  reportType?: "DAMAGED" | "LOST";
  reportCreatedAt?: string;
};

type BulkTurnaroundRiskInfo = {
  bulkSkuId: string;
  code: "BULK_SHORT_TURNAROUND";
  severity: "warning";
  message: string;
  bookingId: string;
  bookingTitle?: string;
  startsAt: string;
  gapMinutes: number;
  plannedQuantity: number;
};

function formatUpcomingStart(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function upcomingCommitmentLabel(commitment: UpcomingCommitmentInfo) {
  return `Back before ${formatUpcomingStart(commitment.startsAt)}`;
}

function primaryRisk<T extends { severity: "warning" | "critical" }>(risks: T[] | undefined) {
  if (!risks || risks.length === 0) return undefined;
  return risks.find((risk) => risk.severity === "critical") ?? risks[0];
}

function riskLabel(risks: Array<{ message: string; severity: "warning" | "critical" }> | undefined) {
  const risk = primaryRisk(risks);
  if (!risk) return null;
  return risks && risks.length > 1 ? `${risk.message} +${risks.length - 1}` : risk.message;
}

function riskTitle(risks: Array<{ message: string }> | undefined) {
  return risks?.map((risk) => risk.message).join(" · ") || "Turnaround risk";
}

export default function BookingEquipmentTab({
  booking,
  onCheckinBulk,
  actionLoading,
}: {
  booking: BookingDetail;
  onCheckinBulk?: (bulkItemId: string, quantity: number) => Promise<boolean>;
  actionLoading?: string | null;
}) {
  const [search, setSearch] = useState("");
  const isCheckout = booking.kind === "CHECKOUT";

  const itemCount = booking.serializedItems.length + booking.bulkItems.length;

  // Checkin progress for checkouts
  const returnedSerialized = booking.serializedItems.filter(
    (i) => i.allocationStatus === "returned",
  ).length;
  // checkedOutQuantity is a non-nullable Int defaulting to 0 — it stays 0 until
  // pickup, so fall back to plannedQuantity until something is actually checked out.
  const totalBulkOut = booking.bulkItems.reduce(
    (sum, i) => sum + (i.checkedOutQuantity > 0 ? i.checkedOutQuantity : i.plannedQuantity),
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
  const isActive = ["BOOKED", "DRAFT", "PENDING_PICKUP", "OPEN"].includes(booking.status);
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [upcomingCommitments, setUpcomingCommitments] = useState<Map<string, UpcomingCommitmentInfo>>(new Map());
  const [turnaroundRisks, setTurnaroundRisks] = useState<Map<string, TurnaroundRiskInfo[]>>(new Map());
  const [bulkTurnaroundRisks, setBulkTurnaroundRisks] = useState<Map<string, BulkTurnaroundRiskInfo[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const fetchConflicts = useCallback(async () => {
    if (!isActive || booking.serializedItems.length === 0) {
      setConflicts(new Map());
      setUpcomingCommitments(new Map());
      setTurnaroundRisks(new Map());
      setBulkTurnaroundRisks(new Map());
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
          bulkItems: booking.bulkItems.map((item) => ({
            bulkSkuId: item.bulkSku.id,
            quantity: item.plannedQuantity,
          })),
          excludeBookingId: booking.id,
        }),
      });
      if (controller.signal.aborted) return;
      if (handleAuthRedirect(res)) return;
      if (!res.ok) return;
      const json = await parseJsonSafely<{
        data?: {
        conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
        upcomingCommitments?: UpcomingCommitmentInfo[];
        turnaroundRisks?: TurnaroundRiskInfo[];
        bulkTurnaroundRisks?: BulkTurnaroundRiskInfo[];
        };
      }>(res);
      const data = json?.data;
      if (!data) return;
      const conflictMap = new Map<string, ConflictInfo>();
      if (data.conflicts) {
        for (const c of data.conflicts) {
          conflictMap.set(c.assetId, {
            assetId: c.assetId,
            conflictingBookingTitle: c.conflictingBookingTitle,
            startsAt: c.startsAt,
            endsAt: c.endsAt,
          });
        }
      }
      const upcomingMap = new Map<string, UpcomingCommitmentInfo>();
      for (const c of data.upcomingCommitments ?? []) {
        upcomingMap.set(c.assetId, c);
      }
      const riskMap = new Map<string, TurnaroundRiskInfo[]>();
      for (const risk of data.turnaroundRisks ?? []) {
        riskMap.set(risk.assetId, [...(riskMap.get(risk.assetId) ?? []), risk]);
      }
      const bulkRiskMap = new Map<string, BulkTurnaroundRiskInfo[]>();
      for (const risk of data.bulkTurnaroundRisks ?? []) {
        bulkRiskMap.set(risk.bulkSkuId, [...(bulkRiskMap.get(risk.bulkSkuId) ?? []), risk]);
      }
      setConflicts(conflictMap);
      setUpcomingCommitments(upcomingMap);
      setTurnaroundRisks(riskMap);
      setBulkTurnaroundRisks(bulkRiskMap);
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Failed to check equipment conflicts — try refreshing.");
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
    <Card className="border-border/40">
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
                  className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-[var(--green)]"
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
	              id="booking-detail-equipment-search"
	              name="bookingDetailEquipmentSearch"
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
                upcoming={upcomingCommitments.get(item.asset.id)}
                risks={turnaroundRisks.get(item.asset.id)}
              />
            ))}
            {filteredBulk.map((item) => (
              <BulkRow
                key={item.id}
                item={item}
                isCheckout={isCheckout}
                onCheckinBulk={onCheckinBulk}
                actionLoading={actionLoading}
                risks={bulkTurnaroundRisks.get(item.bulkSku.id)}
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
  return <AssetImage src={src} alt={alt} size={40} />;
}

/* ── Serialized item row ── */

function SerializedRow({
  item,
  isCheckout,
  conflict,
  upcoming,
  risks,
}: {
  item: SerializedItem;
  isCheckout: boolean;
  conflict?: ConflictInfo;
  upcoming?: UpcomingCommitmentInfo;
  risks?: TurnaroundRiskInfo[];
}) {
  const returned = item.allocationStatus === "returned";
  const risk = primaryRisk(risks);
  const riskText = riskLabel(risks);

  return (
    <div className={`group/row flex items-center gap-3 px-3 py-2.5 rounded-md ${returned ? "opacity-60" : "hover:bg-muted/50"}`}>
      {/* Returned indicator */}
      {isCheckout && returned && (
        <div className="shrink-0">
          <div className="size-5 rounded-full bg-[var(--green-text)] text-white flex items-center justify-center">
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
        {upcoming && !conflict && !returned && (
          <div className="truncate text-[10px] text-blue-600 dark:text-blue-400">
            {upcomingCommitmentLabel(upcoming)}
            {upcoming.bookingTitle ? ` · ${upcoming.bookingTitle}` : ""}
          </div>
        )}
        {riskText && !conflict && !returned && (
          <div className={`truncate text-[10px] ${risk?.severity === "critical" ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>
            {riskText}
          </div>
        )}
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
        {upcoming && !conflict && !returned && (
          <Badge
            variant="blue"
            size="sm"
            title={
              upcoming.bookingTitle
                ? `Needed next for ${upcoming.bookingTitle}`
                : "Needed next by another booking"
            }
          >
            Next use
          </Badge>
        )}
        {risk && !conflict && !returned && (
          <Badge
            variant={risk.severity === "critical" ? "red" : "orange"}
            size="sm"
            title={riskTitle(risks)}
          >
            Turnaround
          </Badge>
        )}
        {returned && (
          <span className="text-xs font-medium text-[var(--green-text)]">
            Returned
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="size-7 flex items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground sm:opacity-0 sm:group-hover/row:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity">
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
  onCheckinBulk,
  actionLoading,
  risks,
}: {
  item: BulkItem;
  isCheckout: boolean;
  onCheckinBulk?: (bulkItemId: string, quantity: number) => Promise<boolean>;
  actionLoading?: string | null;
  risks?: BulkTurnaroundRiskInfo[];
}) {
  // checkedOutQuantity is 0 (not null) until pickup — show planned quantity until
  // then, and only mark "Returned" once something was actually checked out.
  const outQty = item.checkedOutQuantity > 0 ? item.checkedOutQuantity : item.plannedQuantity;
  const inQty = item.checkedInQuantity ?? 0;
  const allReturned = isCheckout && item.checkedOutQuantity > 0 && inQty >= outQty;
  const remaining = outQty - inQty;
  const canReturn = isCheckout && !allReturned && remaining > 0 && !!onCheckinBulk;
  const isLoading = actionLoading === `bulk-${item.id}`;
  const riskText = riskLabel(risks);

  return (
    <div className={`group/row flex items-center gap-3 px-3 py-2.5 rounded-md ${allReturned ? "opacity-60" : "hover:bg-muted/50"}`}>
      {/* Returned indicator */}
      {isCheckout && allReturned && (
        <div className="shrink-0">
          <div className="size-5 rounded-full bg-[var(--green-text)] text-white flex items-center justify-center">
            <Check className="size-3" />
          </div>
        </div>
      )}

      {/* Thumbnail */}
      {item.bulkSku.imageUrl ? (
        <ItemThumbnail src={item.bulkSku.imageUrl} alt={item.bulkSku.name} />
      ) : (
        <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <ImageIcon className="size-4 text-muted-foreground/50" />
        </div>
      )}

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
        {riskText && !allReturned && (
          <div className="truncate text-[10px] text-orange-600 dark:text-orange-400">
            {riskText}
          </div>
        )}
      </div>

      {/* Status + Return All button */}
      <div className="shrink-0 flex items-center gap-2">
        {risks && risks.length > 0 && !allReturned && (
          <Badge variant="orange" size="sm" title={riskTitle(risks)}>
            Turnaround
          </Badge>
        )}
        {allReturned ? (
          <span className="text-xs font-medium text-[var(--green-text)]">
            Returned
          </span>
        ) : canReturn ? (
          <Button
            variant="outline"
            size="xs"
            disabled={isLoading}
            onClick={() => onCheckinBulk(item.id, remaining)}
          >
            {isLoading ? "Returning..." : "Return All"}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">
            {isCheckout ? outQty : item.plannedQuantity}
          </span>
        )}
      </div>
    </div>
  );
}
