import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { HttpError } from "@/lib/http";

export const GET = withAuth<{ id: string }>(async (_req, { params }) => {
  const sku = await db.bulkSku.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { id: true, name: true } },
      categoryRel: { select: { id: true, name: true } },
      balances: true,
      units: {
        orderBy: { unitNumber: "asc" },
        include: {
          allocations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              bookingBulkItem: {
                include: {
                  booking: {
                    select: {
                      refNumber: true,
                      title: true,
                      requester: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      bookingItems: {
        where: { booking: { status: "OPEN", kind: "CHECKOUT" } },
        select: { checkedOutQuantity: true },
      },
    },
  });

  if (!sku) throw new HttpError(404, "Bulk SKU not found");

  const onHand = sku.balances.reduce((s, b) => s + b.onHandQuantity, 0);
  const availableQuantity = sku.trackByNumber
    ? sku.units.filter((u) => u.status === "AVAILABLE").length
    : Math.max(0, onHand - sku.bookingItems.reduce((s, b) => s + (b.checkedOutQuantity ?? 0), 0));

  const { bookingItems: _, ...rest } = sku;
  return ok({ data: { ...rest, onHand, availableQuantity } });
});
