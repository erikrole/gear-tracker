import {
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  BulkUnitStatus,
  Prisma,
  ScanSessionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditEntryTx } from "@/lib/audit";

export const PENDING_PICKUP_AUTO_EXPIRY_HOURS = 48;
const DEFAULT_EXPIRY_LIMIT = 50;

type PendingPickupExpiryResult = {
  scanned: number;
  expired: number;
  failed: number;
  cutoff: Date;
  errors: Record<string, string>;
};

type PendingPickupCandidate = {
  id: string;
};

export async function expirePendingPickupCheckouts(
  now = new Date(),
  limit = DEFAULT_EXPIRY_LIMIT,
): Promise<PendingPickupExpiryResult> {
  const cutoff = new Date(now.getTime() - PENDING_PICKUP_AUTO_EXPIRY_HOURS * 60 * 60 * 1000);
  const candidates = await db.booking.findMany({
    where: {
      kind: BookingKind.CHECKOUT,
      status: BookingStatus.PENDING_PICKUP,
      startsAt: { lt: cutoff },
    },
    select: { id: true },
    orderBy: { startsAt: "asc" },
    take: limit,
  });

  const errors: Record<string, string> = {};
  let expired = 0;

  for (const candidate of candidates) {
    try {
      const didExpire = await expirePendingPickupCheckout(candidate, cutoff, now);
      if (didExpire) expired += 1;
    } catch (error) {
      console.error(`[pending-pickup-expiry] failed to expire ${candidate.id}`, error);
      errors[candidate.id] = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return {
    scanned: candidates.length,
    expired,
    failed: Object.keys(errors).length,
    cutoff,
    errors,
  };
}

async function expirePendingPickupCheckout(
  candidate: PendingPickupCandidate,
  cutoff: Date,
  now: Date,
) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: candidate.id },
      include: {
        bulkItems: {
          select: {
            id: true,
            bulkSkuId: true,
            plannedQuantity: true,
            checkedInQuantity: true,
            unitAllocations: {
              where: { checkedOutAt: { not: null }, checkedInAt: null },
              select: { bulkSkuUnitId: true },
            },
          },
        },
      },
    });

    if (
      !booking ||
      booking.kind !== BookingKind.CHECKOUT ||
      booking.status !== BookingStatus.PENDING_PICKUP ||
      booking.startsAt >= cutoff
    ) {
      return false;
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED },
    });

    const outstandingBulk = booking.bulkItems
      .map((item) => ({
        bulkSkuId: item.bulkSkuId,
        quantity: item.plannedQuantity - (item.checkedInQuantity ?? 0),
      }))
      .filter((item) => item.quantity > 0);

    await restoreBulkStock(tx, {
      bookingId: booking.id,
      locationId: booking.locationId,
      actorUserId: booking.createdBy,
      items: outstandingBulk,
    });

    const activeUnitIds = booking.bulkItems.flatMap((item) =>
      item.unitAllocations.map((allocation) => allocation.bulkSkuUnitId),
    );
    if (activeUnitIds.length > 0) {
      await tx.bookingBulkUnitAllocation.updateMany({
        where: {
          bookingBulkItemId: { in: booking.bulkItems.map((item) => item.id) },
          bulkSkuUnitId: { in: activeUnitIds },
          checkedOutAt: { not: null },
          checkedInAt: null,
        },
        data: { checkedInAt: now },
      });
      await tx.bulkSkuUnit.updateMany({
        where: { id: { in: activeUnitIds } },
        data: { status: BulkUnitStatus.AVAILABLE },
      });
    }

    await tx.assetAllocation.updateMany({
      where: { bookingId: booking.id },
      data: { active: false },
    });

    await tx.scanSession.updateMany({
      where: { bookingId: booking.id, status: ScanSessionStatus.OPEN },
      data: { status: ScanSessionStatus.CANCELLED },
    });

    await createAuditEntryTx(tx, {
      actorId: null,
      actorRole: null,
      entityType: "booking",
      entityId: booking.id,
      action: "pending_pickup_expired",
      before: {
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
      },
      after: {
        status: BookingStatus.CANCELLED,
        expiredAt: now.toISOString(),
        policyHours: PENDING_PICKUP_AUTO_EXPIRY_HOURS,
      },
    });

    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function restoreBulkStock(
  tx: Prisma.TransactionClient,
  args: {
    bookingId: string;
    locationId: string;
    actorUserId: string;
    items: Array<{ bulkSkuId: string; quantity: number }>;
  },
) {
  if (args.items.length === 0) return;

  const balances = await tx.bulkStockBalance.findMany({
    where: {
      locationId: args.locationId,
      bulkSkuId: { in: args.items.map((item) => item.bulkSkuId) },
    },
  });
  const balanceMap = new Map(balances.map((balance) => [balance.bulkSkuId, balance.onHandQuantity]));

  for (const item of args.items) {
    const next = (balanceMap.get(item.bulkSkuId) ?? 0) + item.quantity;
    await tx.bulkStockBalance.upsert({
      where: {
        bulkSkuId_locationId: {
          bulkSkuId: item.bulkSkuId,
          locationId: args.locationId,
        },
      },
      create: {
        bulkSkuId: item.bulkSkuId,
        locationId: args.locationId,
        onHandQuantity: next,
      },
      update: { onHandQuantity: next },
    });
  }

  await tx.bulkStockMovement.createMany({
    data: args.items.map((item) => ({
      bulkSkuId: item.bulkSkuId,
      locationId: args.locationId,
      bookingId: args.bookingId,
      actorUserId: args.actorUserId,
      kind: BulkMovementKind.CHECKIN,
      quantity: item.quantity,
      reason: "pending_pickup_auto_expired",
    })),
  });
}
