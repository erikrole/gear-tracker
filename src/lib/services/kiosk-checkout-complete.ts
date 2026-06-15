import type { CheckoutCompleteBody } from "@/lib/schemas/kiosk";
import type { BulkRequest } from "@/lib/services/availability";

type BulkUnitCheckoutItem = {
  bulkSkuId: string;
  unitNumber: number;
};

const legacyBulkCartIdPattern = /^bulk:([^:]+):unit:(\d+)$/;

function parseLegacyBulkCartId(assetId: string): BulkUnitCheckoutItem | null {
  const match = legacyBulkCartIdPattern.exec(assetId);
  const bulkSkuId = match?.[1];
  const unitNumber = match?.[2];
  if (!bulkSkuId || !unitNumber) return null;
  return {
    bulkSkuId,
    unitNumber: Number(unitNumber),
  };
}

export function normalizeCheckoutCompleteItems(items: CheckoutCompleteBody["items"]) {
  const assetIds: string[] = [];
  const bulkUnitItems: BulkUnitCheckoutItem[] = [];

  for (const item of items) {
    if ("bulkSkuId" in item) {
      bulkUnitItems.push({ bulkSkuId: item.bulkSkuId, unitNumber: item.unitNumber });
      continue;
    }

    const legacyBulkUnit = parseLegacyBulkCartId(item.assetId);
    if (legacyBulkUnit) {
      bulkUnitItems.push(legacyBulkUnit);
      continue;
    }

    assetIds.push(item.assetId);
  }

  return { assetIds, bulkUnitItems };
}

export function bulkRequestsFromCheckoutUnits(items: BulkUnitCheckoutItem[]): BulkRequest[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.bulkSkuId, (counts.get(item.bulkSkuId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([bulkSkuId, quantity]) => ({ bulkSkuId, quantity }));
}
