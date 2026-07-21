import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { kioskCheckinAsset } from "@/lib/services/bookings-checkin";
import { scanKioskCheckinBulkUnit } from "@/lib/services/bulk-unit-scans";
import { locationEvidencePayload } from "@/lib/services/kiosk-location";
import { checkinScanBody } from "@/lib/schemas/kiosk";
import { badges } from "@/lib/badges";
import { badgeScanSourceKey } from "@/lib/badges/scan";
import type { BadgeScanErrorCode } from "@/lib/badges/types";
import { endCheckoutReturnLiveActivities } from "@/lib/services/live-activities";

/**
 * Scan an item for kiosk check-in (return).
 * Marks the item as returned in the booking via `kioskCheckinAsset`,
 * inside one SERIALIZABLE transaction so the update + allocation
 * deactivation cannot drift apart under concurrent scans.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const { scanValue } = checkinScanBody.parse(await req.json());

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true, requesterUserId: true, locationId: true },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") {
    throw new HttpError(404, "Active checkout not found");
  }
  const activeBooking = booking;

  async function emitScanResult(args: { ok: boolean; errorCode?: BadgeScanErrorCode }) {
    await badges.onScanResult({
      userId: activeBooking.requesterUserId,
      bookingId: activeBooking.id,
      phase: "checkin",
      ok: args.ok,
      errorCode: args.errorCode,
      sourceKey: badgeScanSourceKey({
        phase: "checkin",
        bookingId: activeBooking.id,
        scanValue,
        ok: args.ok,
        errorCode: args.errorCode,
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
      errorCode: bulkResult.success ? undefined : bulkResult.errorCode,
    });
    return ok(bulkResult);
  }

  const asset = await findAssetByScanValue(scanValue, {
    id: true,
    assetTag: true,
    name: true,
  });

  if (!asset) {
    await emitScanResult({ ok: false, errorCode: "not_found" });
    return ok({ success: false, error: "Item not found" });
  }

  const result = await db.$transaction(async (tx) => {
    const outcome = await kioskCheckinAsset(tx, {
      bookingId: params.id,
      assetId: asset.id,
      kioskLocationId: kiosk.locationId,
      actorUserId: activeBooking.requesterUserId,
    });
    if (outcome.ok) {
      await tx.scanEvent.create({
        data: {
          bookingId: activeBooking.id,
          actorUserId: activeBooking.requesterUserId,
          scanType: "SERIALIZED",
          scanValue,
          success: true,
          phase: "CHECKIN",
          assetId: asset.id,
          locationMismatch: outcome.locationEvidence?.locationMismatch ?? false,
          expectedLocationId: outcome.locationEvidence?.expectedLocationId ?? activeBooking.locationId,
          actualLocationId: outcome.locationEvidence?.actualLocationId ?? null,
          deviceContext: req.headers.get("user-agent") ?? "kiosk",
        },
      });
    }
    return outcome;
  },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.ok) {
    if (result.reason === "not_in_booking") {
      const error = `${asset.assetTag} is not in this checkout`;
      await emitScanResult({ ok: false, errorCode: "not_in_booking" });
      return ok({ success: false, error });
    }
    const error = `${asset.assetTag} already returned`;
    await emitScanResult({ ok: false, errorCode: "already_returned" });
    return ok({ success: false, error });
  }

  await emitScanResult({ ok: true });

  if (result.completed && result.badgeEvent) {
    await badges.onCheckoutReturned(result.badgeEvent);
    await endCheckoutReturnLiveActivities(params.id);
  }

  return ok({
    success: true,
    ...(result.locationEvidence ? locationEvidencePayload(result.locationEvidence) : {}),
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
    },
  });
});
