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
    },
  });

  if (!booking || booking.kind !== "CHECKOUT") {
    throw new HttpError(404, "Checkout not found");
  }

  return ok({
    id: booking.id,
    title: booking.title,
    refNumber: booking.refNumber,
    status: booking.status,
    endsAt: booking.endsAt,
    items: booking.serializedItems.map((si) => ({
      id: si.asset.id,
      tagName: si.asset.assetTag,
      name: si.asset.name || si.asset.assetTag,
      returned: si.allocationStatus === "returned",
    })),
  });
});
