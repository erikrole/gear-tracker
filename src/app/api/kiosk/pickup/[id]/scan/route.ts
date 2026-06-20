import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { findAssetByScanValue } from "@/lib/services/kiosk-scan";
import { pickupScanBody } from "@/lib/schemas/kiosk";
import { scanKioskPickupBulkUnit, stageKioskReservationPickupBulkUnit } from "@/lib/services/bulk-unit-scans";
import { assetLocationEvidence, locationEvidencePayload, reconcileAssetLocationToKiosk } from "@/lib/services/kiosk-location";
import { badges } from "@/lib/badges";
import { badgeScanSourceKey } from "@/lib/badges/scan";
import type { BadgeScanErrorCode } from "@/lib/badges/types";

/**
 * Scan an item for kiosk pickup flow.
 * Validates that the scanned item belongs to the PENDING_PICKUP checkout or
 * due BOOKED reservation.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const { scanValue } = pickupScanBody.parse(await req.json());

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true, requesterUserId: true, locationId: true },
  });

  if (
    !booking ||
    !(
      (booking.kind === "CHECKOUT" && booking.status === "PENDING_PICKUP") ||
      (booking.kind === "RESERVATION" && booking.status === "BOOKED")
    )
  ) {
    throw new HttpError(404, "Pending pickup not found");
  }
  const activeBooking = booking;

  async function emitScanResult(args: { ok: boolean; errorCode?: BadgeScanErrorCode; sourceKey?: string }) {
    await badges.onScanResult({
      userId: activeBooking.requesterUserId,
      bookingId: activeBooking.id,
      phase: "pickup",
      ok: args.ok,
      errorCode: args.errorCode,
      sourceKey: args.sourceKey ?? badgeScanSourceKey({
        phase: "pickup",
        bookingId: activeBooking.id,
        scanValue,
        ok: args.ok,
        errorCode: args.errorCode,
      }),
    });
  }

  const bulkResult = await db.$transaction(
    (tx) => activeBooking.kind === "RESERVATION"
      ? stageKioskReservationPickupBulkUnit(tx, {
          bookingId: params.id,
          scanValue,
          deviceContext: req.headers.get("user-agent") ?? "kiosk",
        })
      : scanKioskPickupBulkUnit(tx, { bookingId: params.id, scanValue }),
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

  const bookingItem = await db.bookingSerializedItem.findUnique({
    where: { bookingId_assetId: { bookingId: params.id, assetId: asset.id } },
  });

  if (!bookingItem) {
    const error = `${asset.assetTag} is not in this checkout`;
    await emitScanResult({ ok: false, errorCode: "not_in_booking" });
    return ok({ success: false, error });
  }

  const existingScan = await db.scanEvent.findFirst({
    where: {
      bookingId: activeBooking.id,
      phase: "CHECKOUT",
      success: true,
      assetId: asset.id,
    },
    select: { id: true },
  });
  if (existingScan) {
    const label = asset.name || asset.assetTag;
    await emitScanResult({ ok: false, errorCode: "duplicate" });
    return ok({ success: false, error: `${label} already scanned`, errorCode: "duplicate" });
  }

  const scanOutcome = await db.$transaction(async (tx) => {
    const evidence = await assetLocationEvidence(tx, {
      assetId: asset.id,
      expectedLocationId: activeBooking.locationId,
    });
    const event = await tx.scanEvent.create({
      data: {
        bookingId: activeBooking.id,
        actorUserId: activeBooking.requesterUserId,
        scanType: "SERIALIZED",
        scanValue,
        success: true,
        phase: "CHECKOUT",
        assetId: asset.id,
        locationMismatch: evidence.locationMismatch || activeBooking.locationId !== kiosk.locationId,
        expectedLocationId: activeBooking.locationId,
        actualLocationId: evidence.actualLocationId,
        deviceContext: req.headers.get("user-agent") ?? "kiosk",
      },
    });
    await reconcileAssetLocationToKiosk(tx, {
      assetId: asset.id,
      kioskLocationId: kiosk.locationId,
    });
    return { event, evidence };
  });

  await emitScanResult({ ok: true, sourceKey: scanOutcome.event.id });

  const responseEvidence = {
    ...scanOutcome.evidence,
    locationMismatch: scanOutcome.evidence.locationMismatch || activeBooking.locationId !== kiosk.locationId,
  };
  if (activeBooking.locationId !== kiosk.locationId && !responseEvidence.message) {
    responseEvidence.message = "Location mismatch: this pickup was expected at another location. Updated to this kiosk.";
  }

  return ok({
    success: true,
    ...locationEvidencePayload(responseEvidence),
    item: {
      id: asset.id,
      name: asset.name || asset.assetTag,
      tagName: asset.assetTag,
    },
  });
});
