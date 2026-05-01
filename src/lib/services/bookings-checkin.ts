import {
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  BulkUnitStatus,
  Prisma,
  ScanPhase,
  ScanSessionStatus
} from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { createAuditEntryTx, lookupActorRole } from "@/lib/audit";
import { upsertBulkBalancesAndMovements } from "./bookings-helpers";

/**
 * Shared auto-complete check for checkinItems and checkinBulkItem.
 * Completes the booking if all serialized items are returned and all bulk items
 * are fully checked in. Returns true if booking was completed.
 */
async function maybeAutoComplete(
  tx: Prisma.TransactionClient,
  bookingId: string,
  locationId: string,
  actorUserId: string,
  opts: {
    bulkStockReturn?: Array<{ bulkSkuId: string; quantity: number }>;
    auditAction: string;
  }
): Promise<boolean> {
  const remainingActive = await tx.bookingSerializedItem.count({
    where: { bookingId, allocationStatus: "active" }
  });

  const currentBulkItems = await tx.bookingBulkItem.findMany({
    where: { bookingId }
  });
  const bulkRemaining = currentBulkItems.some(
    (item) => (item.checkedInQuantity ?? 0) < (item.checkedOutQuantity ?? item.plannedQuantity)
  );

  if (remainingActive > 0 || bulkRemaining) return false;

  // Deactivate remaining allocations
  await tx.assetAllocation.updateMany({
    where: { bookingId, active: true },
    data: { active: false }
  });

  // Return bulk stock if provided (used by checkinItems path where bulk hasn't been incrementally returned)
  if (opts.bulkStockReturn && opts.bulkStockReturn.length > 0) {
    await upsertBulkBalancesAndMovements(tx, {
      bookingId,
      locationId,
      actorUserId,
      kind: BulkMovementKind.CHECKIN,
      items: opts.bulkStockReturn
    });
  }

  // Complete booking
  await tx.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.COMPLETED }
  });

  // Close scan session
  await tx.scanSession.updateMany({
    where: { bookingId, phase: ScanPhase.CHECKIN, status: ScanSessionStatus.OPEN },
    data: { status: ScanSessionStatus.COMPLETED, completedAt: new Date() }
  });

  // Audit
  const actorRole = await lookupActorRole(tx, actorUserId);
  await createAuditEntryTx(tx, {
    actorId: actorUserId,
    actorRole,
    entityType: "booking",
    entityId: bookingId,
    action: opts.auditAction,
  });

  return true;
}

export async function markCheckoutCompleted(bookingId: string, actorUserId: string) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        bulkItems: {
          include: {
            bulkSku: { select: { trackByNumber: true } },
            unitAllocations: {
              where: { checkedOutAt: { not: null }, checkedInAt: null },
              include: { bulkSkuUnit: { select: { id: true, unitNumber: true } } },
            },
          },
        },
      },
    });

    if (!booking || booking.kind !== BookingKind.CHECKOUT) {
      throw new HttpError(404, "Checkout not found");
    }

    if (booking.status !== BookingStatus.OPEN) {
      throw new HttpError(400, `Checkout is not open (current status: ${booking.status})`);
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED
      }
    });

    await tx.assetAllocation.updateMany({
      where: { bookingId },
      data: { active: false }
    });

    const checkinItems = booking.bulkItems.map((item) => ({
      bulkSkuId: item.bulkSkuId,
      quantity: (item.checkedOutQuantity ?? item.plannedQuantity) - (item.checkedInQuantity ?? 0)
    })).filter((item) => item.quantity > 0);

    if (checkinItems.length > 0) {
      await upsertBulkBalancesAndMovements(tx, {
        bookingId,
        locationId: booking.locationId,
        actorUserId,
        kind: BulkMovementKind.CHECKIN,
        items: checkinItems
      });
    }

    // Auto-mark unreturned numbered bulk units as LOST
    const lostUnitIds: string[] = [];
    const lostUnitNumbers: Array<{ bulkSkuId: string; unitNumbers: number[] }> = [];

    for (const bulkItem of booking.bulkItems) {
      if (!bulkItem.bulkSku.trackByNumber) continue;
      const unreturned = bulkItem.unitAllocations;
      if (unreturned.length === 0) continue;

      const unitIds = unreturned.map((a) => a.bulkSkuUnit.id);
      const unitNums = unreturned.map((a) => a.bulkSkuUnit.unitNumber);
      lostUnitIds.push(...unitIds);
      lostUnitNumbers.push({ bulkSkuId: bulkItem.bulkSkuId, unitNumbers: unitNums });
    }

    const actorRole = await lookupActorRole(tx, actorUserId);

    if (lostUnitIds.length > 0) {
      await tx.bulkSkuUnit.updateMany({
        where: { id: { in: lostUnitIds } },
        data: {
          status: BulkUnitStatus.LOST,
          notes: `Auto-marked LOST on booking completion (${booking.refNumber || bookingId})`,
        },
      });

      await createAuditEntryTx(tx, {
        actorId: actorUserId,
        actorRole,
        entityType: "booking",
        entityId: bookingId,
        action: "bulk_units_auto_lost",
        after: { lostUnits: lostUnitNumbers },
      });
    }

    await tx.scanSession.updateMany({
      where: {
        bookingId,
        phase: ScanPhase.CHECKIN,
        status: ScanSessionStatus.OPEN
      },
      data: {
        status: ScanSessionStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    await createAuditEntryTx(tx, {
      actorId: actorUserId,
      actorRole,
      entityType: "booking",
      entityId: bookingId,
      action: "checkin_completed",
    });

    return { success: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Partial check-in: return individual serialized items from a checkout.
 * Marks each item's allocationStatus as "returned" and deactivates its allocation.
 * If all serialized items are returned (and bulk items fully checked in),
 * auto-completes the checkout.
 *
 * Source: BRIEF_CHECKOUT_UX_V2.md — "Partial check-in: multi-item
 * allocations can be returned incrementally without triggering completion"
 */
export async function checkinItems(
  bookingId: string,
  actorUserId: string,
  assetIds: string[]
) {
  return db.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { serializedItems: true, bulkItems: true }
      });

      if (!booking || booking.kind !== BookingKind.CHECKOUT) {
        throw new HttpError(404, "Checkout not found");
      }

      if (booking.status !== BookingStatus.OPEN) {
        throw new HttpError(400, "Can only check in items from an open checkout");
      }

      // Validate all requested assets belong to this checkout
      const bookingAssetIds = new Set(booking.serializedItems.map((i) => i.assetId));
      const invalid = assetIds.filter((id) => !bookingAssetIds.has(id));
      if (invalid.length > 0) {
        throw new HttpError(400, `Assets not in this checkout: ${invalid.join(", ")}`);
      }

      // Validate none are already returned
      const alreadyReturned = booking.serializedItems
        .filter((i) => assetIds.includes(i.assetId) && i.allocationStatus === "returned")
        .map((i) => i.assetId);
      if (alreadyReturned.length > 0) {
        throw new HttpError(400, `Assets already returned: ${alreadyReturned.join(", ")}`);
      }

      // Mark items as returned (batched — avoids N+1 sequential queries)
      await tx.bookingSerializedItem.updateMany({
        where: { bookingId, assetId: { in: assetIds } },
        data: { allocationStatus: "returned" }
      });

      await tx.assetAllocation.updateMany({
        where: { bookingId, assetId: { in: assetIds }, active: true },
        data: { active: false }
      });

      const actorRole = await lookupActorRole(tx, actorUserId);
      await createAuditEntryTx(tx, {
        actorId: actorUserId,
        actorRole,
        entityType: "booking",
        entityId: bookingId,
        action: "partial_checkin",
        after: { returnedAssetIds: assetIds },
      });

      // Return bulk stock if all items are now returned (auto-complete path)
      const checkinBulkItems = booking.bulkItems.map((item) => ({
        bulkSkuId: item.bulkSkuId,
        quantity: item.checkedOutQuantity ?? item.plannedQuantity
      }));

      const autoCompleted = await maybeAutoComplete(tx, bookingId, booking.locationId, actorUserId, {
        bulkStockReturn: checkinBulkItems.length > 0 ? checkinBulkItems : undefined,
        auditAction: "auto_completed_by_partial_checkin"
      });

      const remainingActive = autoCompleted
        ? 0
        : await tx.bookingSerializedItem.count({ where: { bookingId, allocationStatus: "active" } });

      return {
        success: true,
        returnedAssetIds: assetIds,
        remainingActiveItems: remainingActive,
        autoCompleted
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/**
 * Kiosk-flavored per-asset return.
 *
 * Mirrors the core of `checkinItems` (validate booking → mark serialized
 * item returned → deactivate allocation) but is scoped to a single asset
 * and emits no per-scan audit (kiosk audits at complete, not per-scan).
 *
 * Caller is responsible for the SERIALIZABLE transaction boundary so
 * `update` + `updateMany` are atomic against concurrent scans.
 */
export async function kioskCheckinAsset(
  tx: Prisma.TransactionClient,
  args: { bookingId: string; assetId: string },
): Promise<
  | { ok: true; alreadyReturned: false }
  | { ok: false; reason: "not_in_booking" | "already_returned" }
> {
  const item = await tx.bookingSerializedItem.findUnique({
    where: {
      bookingId_assetId: {
        bookingId: args.bookingId,
        assetId: args.assetId,
      },
    },
  });
  if (!item) return { ok: false, reason: "not_in_booking" };
  if (item.allocationStatus === "returned") {
    return { ok: false, reason: "already_returned" };
  }

  await tx.bookingSerializedItem.update({
    where: { id: item.id },
    data: { allocationStatus: "returned" },
  });
  await tx.assetAllocation.updateMany({
    where: {
      bookingId: args.bookingId,
      assetId: args.assetId,
      active: true,
    },
    data: { active: false },
  });

  return { ok: true, alreadyReturned: false };
}

/**
 * Kiosk-flavored check-in completion.
 *
 * Re-reads the booking inside a SERIALIZABLE transaction (closing the
 * race where a concurrent scan finishes after the route's pre-read),
 * then delegates the "all returned? → COMPLETED + close scan sessions
 * + LOST bulk units + bulk balance restore" logic to `maybeAutoComplete`.
 *
 * Returns `before/after` counts so the route can stamp the kiosk audit
 * entry with the same shape it always has.
 */
export async function kioskCompleteCheckin(args: {
  bookingId: string;
  actorUserId: string;
}): Promise<{
  refNumber: string | null;
  totalItems: number;
  returnedItems: number;
  completed: boolean;
}> {
  return db.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: args.bookingId },
        include: { serializedItems: true, bulkItems: true },
      });
      if (
        !booking ||
        booking.kind !== BookingKind.CHECKOUT ||
        booking.status !== BookingStatus.OPEN
      ) {
        throw new HttpError(404, "Active checkout not found");
      }

      const totalItems = booking.serializedItems.length;
      const returnedItems = booking.serializedItems.filter(
        (i) => i.allocationStatus === "returned",
      ).length;

      // Bulk stock to return if everything else is now in. `maybeAutoComplete`
      // uses this only when both serialized + bulk are fully returned.
      const checkinBulkItems = booking.bulkItems.map((item) => ({
        bulkSkuId: item.bulkSkuId,
        quantity: item.checkedOutQuantity ?? item.plannedQuantity,
      }));

      const completed = await maybeAutoComplete(
        tx,
        booking.id,
        booking.locationId,
        args.actorUserId,
        {
          bulkStockReturn:
            checkinBulkItems.length > 0 ? checkinBulkItems : undefined,
          auditAction: "auto_completed_by_kiosk_checkin",
        },
      );

      return {
        refNumber: booking.refNumber,
        totalItems,
        returnedItems,
        completed,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Check in a partial quantity of a bulk item on an open checkout.
 * Updates checkedInQuantity and returns bulk stock to the location balance.
 * Auto-completes the checkout if all items (serialized + bulk) are now returned.
 */
export async function checkinBulkItem(
  bookingId: string,
  actorUserId: string,
  bulkItemId: string,
  quantity: number
) {
  return db.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { serializedItems: true, bulkItems: true }
      });

      if (!booking || booking.kind !== BookingKind.CHECKOUT) {
        throw new HttpError(404, "Checkout not found");
      }

      if (booking.status !== BookingStatus.OPEN) {
        throw new HttpError(400, "Can only check in items from an open checkout");
      }

      const bulkItem = booking.bulkItems.find((i) => i.id === bulkItemId);
      if (!bulkItem) {
        throw new HttpError(400, "Bulk item not in this checkout");
      }

      const outQty = bulkItem.checkedOutQuantity ?? bulkItem.plannedQuantity;
      const alreadyIn = bulkItem.checkedInQuantity ?? 0;
      const remaining = outQty - alreadyIn;

      if (quantity <= 0 || quantity > remaining) {
        throw new HttpError(400, `Invalid quantity: ${remaining} remaining to return`);
      }

      const newCheckedIn = alreadyIn + quantity;

      await tx.bookingBulkItem.update({
        where: { id: bulkItemId },
        data: { checkedInQuantity: newCheckedIn }
      });

      // Return stock to location balance
      await upsertBulkBalancesAndMovements(tx, {
        bookingId,
        locationId: booking.locationId,
        actorUserId,
        kind: BulkMovementKind.CHECKIN,
        items: [{ bulkSkuId: bulkItem.bulkSkuId, quantity }]
      });

      const actorRole = await lookupActorRole(tx, actorUserId);
      await createAuditEntryTx(tx, {
        actorId: actorUserId,
        actorRole,
        entityType: "booking",
        entityId: bookingId,
        action: "partial_bulk_checkin",
        after: { bulkItemId, quantity, newCheckedIn, outQty },
      });

      const autoCompleted = await maybeAutoComplete(tx, bookingId, booking.locationId, actorUserId, {
        auditAction: "auto_completed_by_bulk_checkin"
      });

      return {
        success: true,
        bulkItemId,
        checkedInQuantity: newCheckedIn,
        totalQuantity: outQty,
        autoCompleted
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
