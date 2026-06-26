import { BookingKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry, createAuditEntryTx } from "@/lib/audit";
import { pickupConfirmBody } from "@/lib/schemas/kiosk";
import { badges } from "@/lib/badges";
import { createBooking } from "@/lib/services/bookings";
import { parseDerivedBulkUnitQr } from "@/lib/bulk-unit-qr";

/**
 * Confirm kiosk pickup: transition PENDING_PICKUP → OPEN.
 * Called after student scans their items at the kiosk.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const { actorId } = pickupConfirmBody.parse(await req.json());
  let openedBookingId = params.id;
  let openedSourceKey = params.id;
  let openedUserId = actorId;
  let actorRole: "ADMIN" | "STAFF" | "STUDENT" = "STUDENT";

  await db.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: actorId },
        select: { id: true, name: true, role: true },
      });
      if (!user) throw new HttpError(404, "User not found");
      actorRole = user.role;

      const booking = await tx.booking.findUnique({
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

      if (!booking || (booking.kind !== "CHECKOUT" && booking.kind !== "RESERVATION")) {
        throw new HttpError(404, "Checkout not found");
      }

      if (booking.kind === "RESERVATION") return;

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

      const updated = await tx.booking.updateMany({
        where: { id: params.id, status: "PENDING_PICKUP" },
        data: { status: "OPEN", pickupKioskDeviceId: kiosk.kioskId },
      });
      if (updated.count !== 1) {
        throw new HttpError(409, "Pickup was already confirmed. Refresh this checkout.");
      }

      await createAuditEntryTx(tx, {
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  const sourceReservation = await db.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      kind: true,
      status: true,
      title: true,
      requesterUserId: true,
      locationId: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      eventId: true,
      sportCode: true,
      shiftAssignmentId: true,
      kitId: true,
      serializedItems: {
        select: {
          assetId: true,
          asset: { select: { assetTag: true, name: true } },
        },
      },
      bulkItems: {
        select: {
          bulkSkuId: true,
          plannedQuantity: true,
          bulkSku: {
            select: {
              id: true,
              name: true,
              binQrCodeValue: true,
              trackByNumber: true,
            },
          },
        },
      },
      scanEvents: {
        where: {
          success: true,
          phase: "CHECKOUT",
        },
        select: {
          assetId: true,
          bulkSkuId: true,
          scanType: true,
          scanValue: true,
        },
      },
      events: {
        orderBy: { ordinal: "asc" },
        select: { eventId: true },
      },
    },
  });

  if (sourceReservation?.kind === "RESERVATION") {
    if (sourceReservation.status !== "BOOKED") {
      throw new HttpError(409, `Cannot confirm pickup — booking is in ${sourceReservation.status} state`);
    }
    if (sourceReservation.locationId !== kiosk.locationId) {
      throw new HttpError(404, "Pending pickup not found");
    }
    if (sourceReservation.requesterUserId !== actorId) {
      throw new HttpError(403, "Only the reservation requester can confirm pickup at the kiosk");
    }

    const scannedSerializedAssetIds = new Set(
      sourceReservation.scanEvents
        .filter((event) => event.scanType === "SERIALIZED")
        .map((event) => event.assetId)
        .filter(Boolean),
    );
    const missingSerialized = sourceReservation.serializedItems.find(
      (item) => !scannedSerializedAssetIds.has(item.assetId),
    );
    if (missingSerialized) {
      const label = missingSerialized.asset.name || missingSerialized.asset.assetTag;
      throw new HttpError(409, `Scan ${label} before confirming pickup`);
    }

    const bulkUnitItems: Array<{ bulkSkuId: string; unitNumber: number }> = [];
    for (const item of sourceReservation.bulkItems) {
      const stagedUnits = sourceReservation.scanEvents
        .filter((event) => event.scanType === "BULK_BIN" && event.bulkSkuId === item.bulkSkuId)
        .map((event) => parseDerivedBulkUnitQr(event.scanValue, [item.bulkSku]))
        .filter((match): match is NonNullable<typeof match> => !!match);
      if (stagedUnits.length < item.plannedQuantity) {
        throw new HttpError(409, `Scan all ${item.bulkSku.name} units before confirming pickup`);
      }
      bulkUnitItems.push(...stagedUnits.map((unit) => ({
        bulkSkuId: unit.bulkSkuId,
        unitNumber: unit.unitNumber,
      })));
    }

    const eventIds = sourceReservation.events.map((event) => event.eventId);
    const checkout = await createBooking({
      kind: BookingKind.CHECKOUT,
      custodySource: "KIOSK",
      title: sourceReservation.title,
      requesterUserId: sourceReservation.requesterUserId,
      locationId: sourceReservation.locationId,
      startsAt: new Date(),
      endsAt: sourceReservation.endsAt,
      serializedAssetIds: [],
      bulkItems: [],
      notes: sourceReservation.notes ?? undefined,
      createdBy: actorId,
      sourceReservationId: sourceReservation.id,
      eventIds: eventIds.length > 0 ? eventIds : undefined,
      eventId: eventIds.length === 0 ? sourceReservation.eventId ?? undefined : undefined,
      sportCode: sourceReservation.sportCode ?? undefined,
      shiftAssignmentId: sourceReservation.shiftAssignmentId ?? undefined,
      kitId: sourceReservation.kitId ?? undefined,
      pickupKioskDeviceId: kiosk.kioskId,
    });

    if (bulkUnitItems.length > 0) {
      await db.$transaction(
        async (tx) => {
          const checkoutBulkItems = await tx.bookingBulkItem.findMany({
            where: { bookingId: checkout.id },
            select: { id: true, bulkSkuId: true },
          });
          const bulkItemBySku = new Map(checkoutBulkItems.map((item) => [item.bulkSkuId, item]));
          const units = await tx.bulkSkuUnit.findMany({
            where: {
              OR: bulkUnitItems.map((item) => ({
                bulkSkuId: item.bulkSkuId,
                unitNumber: item.unitNumber,
              })),
            },
            select: { id: true, bulkSkuId: true, unitNumber: true, status: true },
          });
          if (units.length !== bulkUnitItems.length) {
            throw new HttpError(404, "One or more battery units were not found");
          }
          const unavailable = units.find((unit) => unit.status !== "AVAILABLE");
          if (unavailable) {
            throw new HttpError(409, `Battery unit #${unavailable.unitNumber} is no longer available`);
          }

          const updatedUnits = await tx.bulkSkuUnit.updateMany({
            where: { id: { in: units.map((unit) => unit.id) }, status: "AVAILABLE" },
            data: { status: "CHECKED_OUT" },
          });
          if (updatedUnits.count !== units.length) {
            throw new HttpError(409, "One or more battery units are no longer available");
          }

          for (const unit of units) {
            const bulkItem = bulkItemBySku.get(unit.bulkSkuId);
            if (!bulkItem) {
              throw new HttpError(409, "Battery unit no longer matches this checkout");
            }
            await tx.bookingBulkUnitAllocation.create({
              data: {
                bookingBulkItemId: bulkItem.id,
                bulkSkuUnitId: unit.id,
                checkedOutAt: new Date(),
              },
            });
          }

          for (const bulkItem of checkoutBulkItems) {
            const quantity = units.filter((unit) => unit.bulkSkuId === bulkItem.bulkSkuId).length;
            await tx.bookingBulkItem.update({
              where: { id: bulkItem.id },
              data: { checkedOutQuantity: quantity },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }

    await createAuditEntry({
      actorId,
      actorRole,
      entityType: "booking",
      entityId: checkout.id,
      action: "kiosk_pickup",
      after: {
        status: "OPEN",
        source: "KIOSK",
        kioskDeviceId: kiosk.kioskId,
        locationName: kiosk.locationName,
        sourceReservationId: sourceReservation.id,
      },
    });

    openedBookingId = checkout.id;
    openedSourceKey = sourceReservation.id;
    openedUserId = sourceReservation.requesterUserId;
  }

  await badges.onCheckoutOpened({
    userId: openedUserId,
    bookingId: openedBookingId,
    source: "kiosk_pickup",
    sourceKey: openedSourceKey,
  });

  return ok({ success: true, bookingId: openedBookingId });
});
