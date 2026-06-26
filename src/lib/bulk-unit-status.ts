import { BulkUnitStatus } from "@prisma/client";

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
