import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { kioskCheckinAsset } from "@/lib/services/bookings-checkin";
import { scanKioskCheckinBulkUnit } from "@/lib/services/bulk-unit-scans";
import { checkinScanBody } from "@/lib/schemas/kiosk";
import { badges } from "@/lib/badges";
import { badgeScanErrorCode, badgeScanSourceKey } from "@/lib/badges/scan";

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
    select: { id: true, status: true, kind: true, requesterUserId: true },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") {
    throw new HttpError(404, "Active checkout not found");
  }
  const activeBooking = booking;

  async function emitScanResult(args: { ok: boolean; error?: string }) {
    const errorCode = args.error ? badgeScanErrorCode(args.error) : undefined;
    await badges.onScanResult({
      userId: activeBooking.requesterUserId,
      bookingId: activeBooking.id,
      phase: "checkin",
      ok: args.ok,
      errorCode,
      sourceKey: badgeScanSourceKey({
        phase: "checkin",
        bookingId: activeBooking.id,
        scanValue,
        ok: args.ok,
        errorCode,
      }),
    });
  }

  const bulkResult = await db.$transaction(
    (tx) => scanKioskCheckinBulkUnit(tx, { bookingId: params.id, scanValue }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (bulkResult.handled) {
    await emitScanResult({
      ok: bulkResult.success,
      error: bulkResult.success ? undefined : bulkResult.error,
    });
    return ok(bulkResult);
  }

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
  });

  if (!asset) {
    await emitScanResult({ ok: false, error: "Item not found" });
    return ok({ success: false, error: "Item not found" });
  }

  const result = await db.$transaction(
    (tx) => kioskCheckinAsset(tx, { bookingId: params.id, assetId: asset.id }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.ok) {
    if (result.reason === "not_in_booking") {
      const error = `${asset.assetTag} is not in this checkout`;
      await emitScanResult({ ok: false, error });
      return ok({
        success: false,
        error,
      });
    }
    const error = `${asset.assetTag} already returned`;
    await emitScanResult({ ok: false, error });
    return ok({
      success: false,
      error,
    });
  }

  await emitScanResult({ ok: true });

  return ok({
    success: true,
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
    },
  });
});
