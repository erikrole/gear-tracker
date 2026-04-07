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
  await tx.auditLog.create({
    data: { actorUserId, entityType: "booking", entityId: bookingId, action: opts.auditAction }
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

    if (lostUnitIds.length > 0) {
      await tx.bulkSkuUnit.updateMany({
        where: { id: { in: lostUnitIds } },
        data: {
          status: BulkUnitStatus.LOST,
          notes: `Auto-marked LOST on booking completion (${booking.refNumber || bookingId})`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: "booking",
          entityId: bookingId,
          action: "bulk_units_auto_lost",
          afterJson: { lostUnits: lostUnitNumbers },
        },
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

    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: "booking",
        entityId: bookingId,
        action: "checkin_completed"
      }
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

      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: "booking",
          entityId: bookingId,
          action: "partial_checkin",
          afterJson: { returnedAssetIds: assetIds }
        }
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

      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: "booking",
          entityId: bookingId,
          action: "partial_bulk_checkin",
          afterJson: { bulkItemId, quantity, newCheckedIn, outQty }
        }
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
