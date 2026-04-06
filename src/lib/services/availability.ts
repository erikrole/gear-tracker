import { BookingKind, BookingStatus, PrismaClient, type Prisma } from "@prisma/client";

export type BulkRequest = {
  bulkSkuId: string;
  quantity: number;
};

export type AvailabilityResult = {
  conflicts: Array<{
    assetId: string;
    conflictingBookingId: string;
    conflictingBookingTitle?: string;
    startsAt: Date;
    endsAt: Date;
  }>;
  shortages: Array<{
    bulkSkuId: string;
    requested: number;
    available: number;
  }>;
  unavailableAssets: Array<{
    assetId: string;
    status: string;
  }>;
};

const activeBookingStatuses = [BookingStatus.BOOKED, BookingStatus.OPEN];

export async function checkSerializedConflicts(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    serializedAssetIds: string[];
    startsAt: Date;
    endsAt: Date;
    excludeBookingId?: string;
  }
): Promise<AvailabilityResult["conflicts"]> {
  if (args.serializedAssetIds.length === 0) {
    return [];
  }

  const conflicts = await tx.assetAllocation.findMany({
    where: {
      assetId: { in: args.serializedAssetIds },
      active: true,
      booking: {
        status: { in: activeBookingStatuses }
      },
      startsAt: { lt: args.endsAt },
      endsAt: { gt: args.startsAt },
      ...(args.excludeBookingId ? { bookingId: { not: args.excludeBookingId } } : {})
    },
    select: {
      assetId: true,
      bookingId: true,
      startsAt: true,
      endsAt: true,
      booking: { select: { title: true } }
    }
  });

  return conflicts.map((item) => ({
    assetId: item.assetId,
    conflictingBookingId: item.bookingId,
    conflictingBookingTitle: item.booking.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt
  }));
}

export async function checkAssetStatuses(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    serializedAssetIds: string[];
    bookingKind?: BookingKind;
  }
): Promise<AvailabilityResult["unavailableAssets"]> {
  if (args.serializedAssetIds.length === 0) {
    return [];
  }

  const assets = await tx.asset.findMany({
    where: { id: { in: args.serializedAssetIds } },
    select: {
      id: true,
      status: true,
      availableForCheckout: true,
      availableForReservation: true,
    }
  });

  const foundIds = new Set(assets.map((a) => a.id));
  const missingIds = args.serializedAssetIds.filter((id) => !foundIds.has(id));

  const unavailable: AvailabilityResult["unavailableAssets"] = [];

  for (const a of assets) {
    if (a.status !== "AVAILABLE") {
      unavailable.push({ assetId: a.id, status: a.status as string });
    } else if (args.bookingKind === BookingKind.CHECKOUT && !a.availableForCheckout) {
      unavailable.push({ assetId: a.id, status: "NOT_AVAILABLE_FOR_CHECKOUT" });
    } else if (args.bookingKind === BookingKind.RESERVATION && !a.availableForReservation) {
      unavailable.push({ assetId: a.id, status: "NOT_AVAILABLE_FOR_RESERVATION" });
    }
  }

  const unavailableFromMissing = missingIds.map((id) => ({
    assetId: id,
    status: "NOT_FOUND"
  }));

  return [...unavailable, ...unavailableFromMissing];
}

export async function checkBulkShortages(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    locationId: string;
    bulkItems: BulkRequest[];
  }
): Promise<AvailabilityResult["shortages"]> {
  if (args.bulkItems.length === 0) {
    return [];
  }

  const balanceRows = await tx.bulkStockBalance.findMany({
    where: {
      locationId: args.locationId,
      bulkSkuId: { in: args.bulkItems.map((item) => item.bulkSkuId) }
    },
    select: {
      bulkSkuId: true,
      onHandQuantity: true
    }
  });

  const balanceMap = new Map(balanceRows.map((row) => [row.bulkSkuId, row.onHandQuantity]));

  return args.bulkItems
    .map((item) => {
      const available = balanceMap.get(item.bulkSkuId) ?? 0;
      return {
        bulkSkuId: item.bulkSkuId,
        requested: item.quantity,
        available
      };
    })
    .filter((item) => item.available < item.requested);
}

export type BulkAvailabilityEntry = {
  onHand: number;
  committed: number;
  available: number;
};

/**
 * For each bulk SKU at a location, compute how many units are committed
 * to overlapping BOOKED/OPEN bookings in the given date window.
 */
export async function getBulkAvailability(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    locationId: string;
    startsAt: Date;
    endsAt: Date;
    excludeBookingId?: string;
  }
): Promise<Record<string, BulkAvailabilityEntry>> {
  // Get on-hand balances for all SKUs at this location
  const balances = await tx.bulkStockBalance.findMany({
    where: { locationId: args.locationId },
    select: { bulkSkuId: true, onHandQuantity: true },
  });

  if (balances.length === 0) return {};

  const skuIds = balances.map((b) => b.bulkSkuId);

  // Sum planned quantities from overlapping active bookings
  const committedRows = await tx.bookingBulkItem.groupBy({
    by: ["bulkSkuId"],
    where: {
      bulkSkuId: { in: skuIds },
      booking: {
        status: { in: activeBookingStatuses },
        locationId: args.locationId,
        startsAt: { lt: args.endsAt },
        endsAt: { gt: args.startsAt },
        ...(args.excludeBookingId ? { id: { not: args.excludeBookingId } } : {}),
      },
    },
    _sum: { plannedQuantity: true },
  });

  const committedMap = new Map(
    committedRows.map((r) => [r.bulkSkuId, r._sum.plannedQuantity ?? 0])
  );

  const result: Record<string, BulkAvailabilityEntry> = {};
  for (const b of balances) {
    const committed = committedMap.get(b.bulkSkuId) ?? 0;
    result[b.bulkSkuId] = {
      onHand: b.onHandQuantity,
      committed,
      available: Math.max(0, b.onHandQuantity - committed),
    };
  }

  return result;
}

export async function checkAvailability(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    locationId: string;
    startsAt: Date;
    endsAt: Date;
    serializedAssetIds: string[];
    bulkItems: BulkRequest[];
    excludeBookingId?: string;
    bookingKind?: BookingKind;
  }
): Promise<AvailabilityResult> {
  const [conflicts, shortages, unavailableAssets] = await Promise.all([
    checkSerializedConflicts(tx, {
      serializedAssetIds: args.serializedAssetIds,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      excludeBookingId: args.excludeBookingId
    }),
    checkBulkShortages(tx, {
      locationId: args.locationId,
      bulkItems: args.bulkItems
    }),
    checkAssetStatuses(tx, {
      serializedAssetIds: args.serializedAssetIds,
      bookingKind: args.bookingKind,
    })
  ]);

  return { conflicts, shortages, unavailableAssets };
}
