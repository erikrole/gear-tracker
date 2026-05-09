import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { pickupConfirmBody } from "@/lib/schemas/kiosk";
import { badges } from "@/lib/badges";

/**
 * Confirm kiosk pickup: transition PENDING_PICKUP → OPEN.
 * Called after student scans their items at the kiosk.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const { actorId } = pickupConfirmBody.parse(await req.json());

  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      kind: true,
      title: true,
      serializedItems: {
        select: {
          assetId: true,
          asset: { select: { assetTag: true, name: true } },
        },
      },
      scanEvents: {
        where: {
          success: true,
          assetId: { not: null },
        },
        select: { assetId: true, phase: true },
      },
      bulkItems: {
        select: {
          plannedQuantity: true,
          checkedOutQuantity: true,
          bulkSku: { select: { name: true } },
        },
      },
    },
  });

  if (!booking || booking.kind !== "CHECKOUT") {
    throw new HttpError(404, "Checkout not found");
  }

  if (booking.status !== "PENDING_PICKUP") {
    throw new HttpError(409, `Cannot confirm pickup — booking is in ${booking.status} state`);
  }

  const scannedSerializedAssetIds = new Set(
    booking.scanEvents
      .filter((event) => event.phase === "CHECKOUT")
      .map((event) => event.assetId),
  );
  const missingSerialized = booking.serializedItems.find(
    (item) => !scannedSerializedAssetIds.has(item.assetId),
  );
  if (missingSerialized) {
    const label = missingSerialized.asset.name || missingSerialized.asset.assetTag;
    throw new HttpError(409, `Scan ${label} before confirming pickup`);
  }

  const incompleteBulk = booking.bulkItems.find(
    (item) => (item.checkedOutQuantity ?? 0) < item.plannedQuantity,
  );
  if (incompleteBulk) {
    throw new HttpError(
      409,
      `Scan all ${incompleteBulk.bulkSku.name} units before confirming pickup`,
    );
  }

  await db.booking.update({
    where: { id: params.id },
    data: { status: "OPEN" },
  });

  await createAuditEntry({
    actorId,
    actorRole: user.role,
    entityType: "booking",
    entityId: params.id,
    action: "kiosk_pickup",
    after: {
      status: "OPEN",
      source: "KIOSK",
      kioskDeviceId: kiosk.kioskId,
      locationName: kiosk.locationName,
    },
  });

  await badges.onCheckoutOpened({
    userId: actorId,
    bookingId: params.id,
    source: "kiosk_pickup",
    sourceKey: params.id,
  });

  return ok({ success: true, bookingId: params.id });
});
