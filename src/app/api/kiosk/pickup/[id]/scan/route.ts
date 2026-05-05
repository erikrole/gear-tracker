import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { pickupScanBody } from "@/lib/schemas/kiosk";
import { scanKioskPickupBulkUnit } from "@/lib/services/bulk-unit-scans";

/**
 * Scan an item for kiosk pickup flow.
 * Validates that the scanned item belongs to the PENDING_PICKUP booking.
 */
export const POST = withKiosk<{ id: string }>(async (req, { params }) => {
  const { scanValue } = pickupScanBody.parse(await req.json());

  const bulkResult = await db.$transaction(
    (tx) => scanKioskPickupBulkUnit(tx, { bookingId: params.id, scanValue }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (bulkResult.handled) {
    return ok(bulkResult);
  }

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "PENDING_PICKUP") {
    throw new HttpError(404, "Pending pickup not found");
  }

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
  });

  if (!asset) {
    return ok({ success: false, error: "Item not found" });
  }

  const bookingItem = await db.bookingSerializedItem.findUnique({
    where: { bookingId_assetId: { bookingId: params.id, assetId: asset.id } },
  });

  if (!bookingItem) {
    return ok({ success: false, error: `${asset.assetTag} is not in this checkout` });
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
