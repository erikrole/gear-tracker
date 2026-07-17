import type { CheckoutCompleteBody } from "@/lib/schemas/kiosk";
import type { BulkRequest } from "@/lib/services/availability";
import { HttpError } from "@/lib/http";
import {
  MAX_BULK_UNIT_NUMBER,
  MAX_CHECKOUT_DISTINCT_BULK_SKUS_PER_REQUEST,
} from "@/lib/request-limits";

type BulkUnitCheckoutItem = {
  bulkSkuId: string;
  unitNumber: number;
};

const legacyBulkCartIdPattern = /^bulk:([^:]+):unit:(\d+)$/;

function assertValidBulkUnitNumber(unitNumber: number) {
  if (!Number.isInteger(unitNumber) || unitNumber <= 0 || unitNumber > MAX_BULK_UNIT_NUMBER) {
    throw new HttpError(
      400,
      `Bulk unit number must be a whole number between 1 and ${MAX_BULK_UNIT_NUMBER}`,
    );
  }
}

function parseLegacyBulkCartId(assetId: string): BulkUnitCheckoutItem | null {
  const match = legacyBulkCartIdPattern.exec(assetId);
  const bulkSkuId = match?.[1];
  const unitNumber = match?.[2];
  if (!bulkSkuId || !unitNumber) return null;
  const parsedUnitNumber = Number(unitNumber);
  assertValidBulkUnitNumber(parsedUnitNumber);
  return {
    bulkSkuId,
    unitNumber: parsedUnitNumber,
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

export function assertCheckoutDistinctBulkSkuLimit(
  items: ReadonlyArray<{ bulkSkuId: string }>,
  context: "checkout" | "reservation pickup" = "checkout",
) {
  const distinctBulkSkuCount = new Set(items.map((item) => item.bulkSkuId)).size;
  if (distinctBulkSkuCount > MAX_CHECKOUT_DISTINCT_BULK_SKUS_PER_REQUEST) {
    const subject = context === "reservation pickup" ? "A reservation pickup" : "A checkout";
    throw new HttpError(
      400,
      `${subject} may include at most ${MAX_CHECKOUT_DISTINCT_BULK_SKUS_PER_REQUEST} distinct bulk item types`,
    );
  }
}

export function bulkRequestsFromCheckoutUnits(items: BulkUnitCheckoutItem[]): BulkRequest[] {
  assertCheckoutDistinctBulkSkuLimit(items);
  const counts = new Map<string, number>();
  const unitNumbersBySku = new Map<string, Set<number>>();
  for (const item of items) {
    assertValidBulkUnitNumber(item.unitNumber);
    const seenUnitNumbers = unitNumbersBySku.get(item.bulkSkuId) ?? new Set<number>();
    if (seenUnitNumbers.has(item.unitNumber)) {
      throw new HttpError(400, "A checkout cannot include the same bulk unit more than once");
    }
    seenUnitNumbers.add(item.unitNumber);
    unitNumbersBySku.set(item.bulkSkuId, seenUnitNumbers);
    counts.set(item.bulkSkuId, (counts.get(item.bulkSkuId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([bulkSkuId, quantity]) => ({ bulkSkuId, quantity }));
}
