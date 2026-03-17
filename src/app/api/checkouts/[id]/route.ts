import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { getAllowedActions } from "@/lib/services/booking-rules";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  const checkout = await db.booking.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true, email: true } },
      serializedItems: {
        select: {
          id: true, assetId: true, allocationStatus: true,
          asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true } },
        },
      },
      bulkItems: {
        select: {
          id: true, plannedQuantity: true, checkedOutQuantity: true, checkedInQuantity: true,
          bulkSku: { select: { id: true, name: true, unit: true } },
        },
      },
    }
  });

  if (!checkout || checkout.kind !== "CHECKOUT") {
    throw new HttpError(404, "Checkout not found");
  }

  const allowedActions = getAllowedActions(user, checkout);

  return ok({ data: { ...checkout, allowedActions } });
});
