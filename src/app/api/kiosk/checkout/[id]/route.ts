import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/** Get checkout details for kiosk return flow */
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
      serializedItems: {
        select: {
          id: true,
          allocationStatus: true,
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
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

  if (!booking || booking.kind !== "CHECKOUT") {
    throw new HttpError(404, "Checkout not found");
  }

  const serializedItems = booking.serializedItems.map((si) => ({
    id: si.asset.id,
    tagName: si.asset.assetTag,
    name: si.asset.name || si.asset.assetTag,
    returned: si.allocationStatus === "returned",
    type: "serialized" as const,
  }));

  const bulkItems = booking.status === "PENDING_PICKUP"
    ? booking.bulkItems.flatMap((bi) =>
        Array.from({ length: bi.plannedQuantity }, (_, index) => ({
          id: `${bi.id}:slot:${index + 1}`,
          tagName: `#${index + 1}`,
          name: `${bi.bulkSku.name} ${index + 1}`,
          returned: false,
          type: "numbered_bulk" as const,
          bulkSkuId: bi.bulkSku.id,
          bulkSkuName: bi.bulkSku.name,
          unitNumber: null,
        }))
      )
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
        }))
      );
  const numberedBulkItems = booking.bulkItems.filter((bi) => bi.bulkSku.trackByNumber);
  const numberedBulkTotal = booking.status === "PENDING_PICKUP"
    ? numberedBulkItems.reduce((sum, bi) => sum + bi.plannedQuantity, 0)
    : numberedBulkItems.reduce((sum, bi) => sum + bi.unitAllocations.length, 0);
  const numberedBulkCompleted = booking.status === "PENDING_PICKUP"
    ? numberedBulkItems.reduce((sum, bi) => sum + (bi.checkedOutQuantity ?? 0), 0)
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
