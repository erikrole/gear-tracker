import { BulkUnitStatus, type Prisma } from "@prisma/client";

type BulkUnitStatusLike = BulkUnitStatus | `${BulkUnitStatus}`;

type BulkUnitLike = {
  id: string;
  status: BulkUnitStatusLike;
};

export function effectiveBulkUnitStatus(
  unit: BulkUnitLike,
  activeAllocation: unknown | null | undefined,
): BulkUnitStatus {
  if (unit.status === BulkUnitStatus.LOST || unit.status === BulkUnitStatus.RETIRED) {
    return unit.status;
  }
  if (activeAllocation) return BulkUnitStatus.CHECKED_OUT;
  if (unit.status === BulkUnitStatus.CHECKED_OUT) return BulkUnitStatus.AVAILABLE;
  return unit.status as BulkUnitStatus;
}

/** Prisma where fragment for an allocation that currently holds a unit. */
export const ACTIVE_BULK_UNIT_ALLOCATION_WHERE: Prisma.BookingBulkUnitAllocationWhereInput = {
  checkedOutAt: { not: null },
  checkedInAt: null,
};

/**
 * Guarded-claim where fragment: a unit may be claimed for checkout when it is
 * not LOST/RETIRED and no active allocation holds it. A raw CHECKED_OUT flag
 * with no active allocation is claimable — the same units every read path
 * (Battery Ops, kiosk scan, `effectiveBulkUnitStatus`) already reports as
 * available — so orphaned flags self-heal on the next checkout instead of
 * dead-ending it with "no longer available" until repair-stale runs.
 */
export const CLAIMABLE_BULK_UNIT_WHERE: Prisma.BulkSkuUnitWhereInput = {
  status: { in: [BulkUnitStatus.AVAILABLE, BulkUnitStatus.CHECKED_OUT] },
  allocations: { none: ACTIVE_BULK_UNIT_ALLOCATION_WHERE },
};

export function buildActiveBulkUnitAllocationMap<T extends { bulkSkuUnitId: string }>(
  allocations: T[],
) {
  const byUnitId = new Map<string, T>();
  for (const allocation of allocations) {
    if (!byUnitId.has(allocation.bulkSkuUnitId)) {
      byUnitId.set(allocation.bulkSkuUnitId, allocation);
    }
  }
  return byUnitId;
}
