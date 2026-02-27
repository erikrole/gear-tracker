import { BookingStatus, PrismaClient, type Prisma } from "@prisma/client";

export type BulkRequest = {
  bulkSkuId: string;
  quantity: number;
};

export type AvailabilityResult = {
  conflicts: Array<{
    assetId: string;
    conflictingBookingId: string;
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
      endsAt: true
    }
  });

  return conflicts.map((item) => ({
    assetId: item.assetId,
    conflictingBookingId: item.bookingId,
    startsAt: item.startsAt,
    endsAt: item.endsAt
  }));
}

export async function checkAssetStatuses(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    serializedAssetIds: string[];
  }
): Promise<AvailabilityResult["unavailableAssets"]> {
  if (args.serializedAssetIds.length === 0) {
    return [];
  }

  const assets = await tx.asset.findMany({
    where: { id: { in: args.serializedAssetIds } },
    select: { id: true, status: true }
  });

  const foundIds = new Set(assets.map((a) => a.id));
  const missingIds = args.serializedAssetIds.filter((id) => !foundIds.has(id));

  const unavailableFromStatus = assets
    .filter((a) => a.status !== "AVAILABLE")
    .map((a) => ({ assetId: a.id, status: a.status as string }));

  const unavailableFromMissing = missingIds.map((id) => ({
    assetId: id,
    status: "NOT_FOUND"
  }));

  return [...unavailableFromStatus, ...unavailableFromMissing];
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

export async function checkAvailability(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    locationId: string;
    startsAt: Date;
    endsAt: Date;
    serializedAssetIds: string[];
    bulkItems: BulkRequest[];
    excludeBookingId?: string;
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
      serializedAssetIds: args.serializedAssetIds
    })
  ]);

  return { conflicts, shortages, unavailableAssets };
}
