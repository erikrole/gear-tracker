import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/** Get checkout details for kiosk return and pickup flows */
export const GET = withKiosk<{ id: string }>(async (_req, { params }) => {
  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      refNumber: true,
      status: true,
      kind: true,
      endsAt: true,
      scanEvents: {
        where: {
          success: true,
          phase: "CHECKOUT",
        },
        select: {
          assetId: true,
          bulkSkuId: true,
          scanType: true,
        },
      },
      serializedItems: {
        select: {
          id: true,
          allocationStatus: true,
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      },
      bulkItems: {
        select: {
          id: true,
          plannedQuantity: true,
          checkedOutQuantity: true,
          checkedInQuantity: true,
          bulkSku: {
            select: {
              id: true,
              name: true,
              category: true,
              trackByNumber: true,
              imageUrl: true,
            },
          },
          unitAllocations: {
            select: {
              checkedInAt: true,
              bulkSkuUnit: {
                select: {
                  id: true,
                  unitNumber: true,
                },
              },
            },
            orderBy: { checkedOutAt: "asc" },
          },
        },
      },
    },
  });

  if (
    !booking ||
    (booking.kind !== "CHECKOUT" && booking.kind !== "RESERVATION") ||
    (booking.kind === "CHECKOUT" && booking.status !== "PENDING_PICKUP" && booking.status !== "OPEN") ||
    (booking.kind === "RESERVATION" && booking.status !== "BOOKED")
  ) {
    throw new HttpError(404, "Checkout not found");
  }

  const isPickupChecklist =
    (booking.kind === "CHECKOUT" && booking.status === "PENDING_PICKUP") ||
    booking.kind === "RESERVATION";
  const scanEvents = booking.scanEvents ?? [];
  const scannedSerializedAssetIds = new Set(
    scanEvents
      .filter((event) => event.scanType === "SERIALIZED" && event.assetId)
      .map((event) => event.assetId),
  );

  const serializedItems = booking.serializedItems.map((si) => ({
    id: si.asset.id,
    tagName: si.asset.assetTag,
    name: si.asset.name || si.asset.assetTag,
    returned: isPickupChecklist
      ? scannedSerializedAssetIds.has(si.asset.id)
      : si.allocationStatus === "returned",
    type: "serialized" as const,
    imageUrl: si.asset.imageUrl,
  }));

  const bulkItems = isPickupChecklist
    ? booking.bulkItems.flatMap((bi) => {
        const pickedUnits = booking.kind === "CHECKOUT" && booking.status === "PENDING_PICKUP"
          ? bi.unitAllocations.filter((allocation) => !allocation.checkedInAt)
          : [];

        return Array.from({ length: bi.plannedQuantity }, (_, index) => {
          const allocation = pickedUnits[index];
          if (allocation) {
            return {
              id: `${bi.id}:slot:${index + 1}`,
              tagName: `#${allocation.bulkSkuUnit.unitNumber}`,
              name: `${bi.bulkSku.name} #${allocation.bulkSkuUnit.unitNumber}`,
              returned: true,
              type: "numbered_bulk" as const,
              bulkSkuId: bi.bulkSku.id,
              bulkSkuName: bi.bulkSku.name,
              unitNumber: allocation.bulkSkuUnit.unitNumber,
              imageUrl: bi.bulkSku.imageUrl,
            };
          }

          return {
            id: `${bi.id}:slot:${index + 1}`,
            tagName: `#${index + 1}`,
            name: `${bi.bulkSku.name} ${index + 1}`,
            returned: false,
            type: "numbered_bulk" as const,
            bulkSkuId: bi.bulkSku.id,
            bulkSkuName: bi.bulkSku.name,
            unitNumber: null,
            imageUrl: bi.bulkSku.imageUrl,
          };
        });
      })
    : booking.bulkItems.flatMap((bi) =>
        bi.unitAllocations.map((allocation) => ({
          id: allocation.bulkSkuUnit.id,
          tagName: `#${allocation.bulkSkuUnit.unitNumber}`,
          name: `${bi.bulkSku.name} #${allocation.bulkSkuUnit.unitNumber}`,
          returned: !!allocation.checkedInAt,
          type: "numbered_bulk" as const,
          bulkSkuId: bi.bulkSku.id,
          bulkSkuName: bi.bulkSku.name,
          unitNumber: allocation.bulkSkuUnit.unitNumber,
          imageUrl: bi.bulkSku.imageUrl,
        }))
      );
  const numberedBulkItems = booking.bulkItems.filter((bi) => bi.bulkSku.trackByNumber);
  const numberedBulkTotal = isPickupChecklist
    ? numberedBulkItems.reduce((sum, bi) => sum + bi.plannedQuantity, 0)
    : numberedBulkItems.reduce((sum, bi) => sum + bi.unitAllocations.length, 0);
  const scannedBulkCounts = scanEvents
    .filter((event) => event.scanType === "BULK_BIN" && event.bulkSkuId)
    .reduce((counts, event) => {
      counts.set(event.bulkSkuId!, (counts.get(event.bulkSkuId!) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
  const numberedBulkCompleted = isPickupChecklist
    ? numberedBulkItems.reduce(
        (sum, bi) => sum + (booking.kind === "RESERVATION"
          ? (scannedBulkCounts.get(bi.bulkSku.id) ?? 0)
          : (bi.checkedOutQuantity ?? 0)),
        0,
      )
    : numberedBulkItems.reduce(
        (sum, bi) => sum + bi.unitAllocations.filter((allocation) => !!allocation.checkedInAt).length,
        0,
      );

  return ok({
    id: booking.id,
    title: booking.title,
    refNumber: booking.refNumber,
    status: booking.status,
    endsAt: booking.endsAt,
    scanSummary: {
      serializedTotal: serializedItems.length,
      numberedBulkTotal,
      numberedBulkCompleted,
    },
    items: [...serializedItems, ...bulkItems],
  });
});
