"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check } from "lucide-react";
import type { BookingDetail, SerializedItem, BulkItem } from "@/components/booking-details/types";

export default function BookingEquipmentTab({
  booking,
  canCheckin,
  checkinIds,
  onToggleCheckin,
  onCheckinSelected,
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
  bulkReturnQty: Record<string, number>;
  onBulkReturnQtyChange: (id: string, qty: number) => void;
  onBulkReturn: (bulkItemId: string) => void;
  actionLoading: string | null;
}) {
  const [search, setSearch] = useState("");
  const isCheckout = booking.kind === "CHECKOUT";

  const itemCount = booking.serializedItems.length + booking.bulkItems.length;

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
      {/* Header with search and bulk action */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/30">
        {itemCount > 3 && (
          <Input
            placeholder="Search equipment..."
            aria-label="Search equipment"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs"
          />
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
        {canCheckin && checkinIds.size > 0 && (
          <Button size="sm" onClick={onCheckinSelected} disabled={!!actionLoading}>
            {actionLoading === "checkin"
              ? "Returning..."
              : `Return ${checkinIds.size} item${checkinIds.size > 1 ? "s" : ""}`}
          </Button>
        )}
      </div>

      {filteredSerialized.length === 0 && filteredBulk.length === 0 ? (
        <Empty className="py-8 border-0">
          <EmptyDescription>
            {search ? "No items match your search." : "No items in this booking."}
          </EmptyDescription>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isCheckout && canCheckin && <TableHead className="w-10" />}
              <TableHead>Item</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>{isCheckout ? "Status" : "Serial"}</TableHead>
              {!isCheckout && <TableHead>Location</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
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
          </TableBody>
        </Table>
      )}
    </Card>
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
    <TableRow className={returned ? "bg-muted/50" : ""}>
      {isCheckout && canCheckin && (
        <TableCell>
          {returned ? (
            <div className="size-5 rounded-full bg-green-600 text-white flex items-center justify-center">
              <Check className="size-3" />
            </div>
          ) : (
            <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${item.asset.assetTag} for return`} />
          )}
        </TableCell>
      )}
      <TableCell>
        <Link
          href={`/items/${item.asset.id}`}
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          {item.asset.assetTag}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {item.asset.brand} {item.asset.model}
      </TableCell>
      {isCheckout ? (
        <TableCell>
          {returned ? (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              Returned
            </span>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">
              {item.asset.serialNumber}
            </span>
          )}
        </TableCell>
      ) : (
        <>
          <TableCell className="font-mono text-xs text-muted-foreground">
            {item.asset.serialNumber}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {item.asset.location?.name ?? "\u2014"}
          </TableCell>
        </>
      )}
    </TableRow>
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
    <TableRow className={allReturned ? "bg-muted/50" : ""}>
      {isCheckout && canCheckin && (
        <TableCell>
          {allReturned && (
            <div className="size-5 rounded-full bg-green-600 text-white flex items-center justify-center">
              <Check className="size-3" />
            </div>
          )}
        </TableCell>
      )}
      <TableCell className="font-semibold">{item.bulkSku?.name ?? "Unknown"}</TableCell>
      <TableCell className="text-muted-foreground">
        {isCheckout && inQty > 0
          ? `${inQty} / ${outQty} returned`
          : `Qty: ${isCheckout ? outQty : item.plannedQuantity}`}{" "}
        <span className="text-muted-foreground/60">{item.bulkSku.unit}</span>
      </TableCell>
      <TableCell>
        {allReturned ? (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
            Returned
          </span>
        ) : isCheckout && canCheckin ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={outQty - inQty}
              value={returnQty || ""}
              onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)}
              placeholder={String(outQty - inQty)}
              aria-label={`Return quantity for ${item.bulkSku?.name}`}
              className="h-7 w-16 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!returnQty || actionLoading === `bulk-${item.id}`}
              onClick={onReturn}
            >
              {actionLoading === `bulk-${item.id}` ? "..." : "Return"}
            </Button>
          </div>
        ) : null}
      </TableCell>
      {!isCheckout && <TableCell />}
    </TableRow>
  );
}
