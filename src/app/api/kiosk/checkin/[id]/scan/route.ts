import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { kioskCheckinAsset } from "@/lib/services/bookings-checkin";
import { checkinScanBody } from "@/lib/schemas/kiosk";

/**
 * Scan an item for kiosk check-in (return).
 * Marks the item as returned in the booking via `kioskCheckinAsset`,
 * inside one SERIALIZABLE transaction so the update + allocation
 * deactivation cannot drift apart under concurrent scans.
 */
export const POST = withKiosk<{ id: string }>(async (req, { params }) => {
  const { scanValue } = checkinScanBody.parse(await req.json());

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") {
    throw new HttpError(404, "Active checkout not found");
  }

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
  });

  if (!asset) {
    return ok({ success: false, error: "Item not found" });
  }

  const result = await db.$transaction(
    (tx) => kioskCheckinAsset(tx, { bookingId: params.id, assetId: asset.id }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.ok) {
    if (result.reason === "not_in_booking") {
      return ok({
        success: false,
        error: `${asset.assetTag} is not in this checkout`,
      });
    }
    return ok({
      success: false,
      error: `${asset.assetTag} already returned`,
    });
  }

  return ok({
    success: true,
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
    },
  });
});
