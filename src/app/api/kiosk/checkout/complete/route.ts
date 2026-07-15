import { BookingKind, BulkMovementKind, BulkUnitStatus, CalendarEventStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { checkoutCompleteBody } from "@/lib/schemas/kiosk";
import { nextBookingRef } from "@/lib/services/booking-ref";
import { upsertBulkBalancesAndMovements } from "@/lib/services/bookings-helpers";
import { bulkRequestsFromCheckoutUnits, normalizeCheckoutCompleteItems } from "@/lib/services/kiosk-checkout-complete";
import { ACTIVE_BULK_UNIT_ALLOCATION_WHERE, CLAIMABLE_BULK_UNIT_WHERE, effectiveBulkUnitStatus } from "@/lib/bulk-unit-status";
import { checkAvailability, type AvailabilityResult } from "@/lib/services/availability";
import { parseDateRange } from "@/lib/time";
import { badges } from "@/lib/badges";
import { scheduleCheckoutReturnLiveActivity } from "@/lib/live-activity-workflow";
import { normalizeBookingTitle } from "@/lib/title-normalization";

function hasBlockingAvailabilityIssue(result: AvailabilityResult) {
  return result.conflicts.length > 0 || result.shortages.length > 0 || result.unavailableAssets.length > 0;
}

function prismaErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const meta = typeof error === "object" && error && "meta" in error
    ? JSON.stringify((error as { meta?: unknown }).meta ?? {})
    : "";
  return `${message} ${meta}`;
}

function isBookingAllocationConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const text = prismaErrorText(error);

  if (code === "23P01" || text.includes("asset_allocations_no_overlap")) {
    return true;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === "P2002") {
    const target = (error.meta?.target as string[] | string | undefined) ?? "";
    const targetStr = Array.isArray(target) ? target.join(",") : String(target);
    return (
      targetStr.includes("asset_allocations_asset_id_active_unique") ||
      targetStr.includes("asset_id")
    );
  }

  return error.code === "P2004" && text.includes("asset_allocations");
}

/**
 * Complete a kiosk checkout: create booking + allocations in one step.
 * This is the scan-first flow: items were validated during scanning,
 * now we create the booking and allocations atomically.
 */
export const POST = withKiosk(async (req, { kiosk }) => {
  const body = checkoutCompleteBody.parse(await req.json());
  const actorId = body.actorId;
  const locationId = kiosk.locationId;
  const { assetIds, bulkUnitItems } = normalizeCheckoutCompleteItems(body.items);
  const customPurpose = body.customPurpose?.trim();

  // Verify user exists and is active
  const user = await db.user.findFirst({
    where: { id: actorId, active: true },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const now = new Date();
  const eventWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const { booking, refNumber } = await db.$transaction(
      async (tx) => {
        // Generate ref-number inside the transaction so the advisory lock
        // (held by `nextBookingRef`) serializes concurrent kiosk completions.
        const refNumber = await nextBookingRef(tx, "CO");

        const event = body.eventId
          ? await tx.calendarEvent.findFirst({
              where: {
                id: body.eventId,
                startsAt: { lte: eventWindowEnd },
                endsAt: { gte: now },
                status: { not: CalendarEventStatus.CANCELLED },
                isHidden: false,
                archivedAt: null,
              },
              select: { id: true, summary: true, sportCode: true, endsAt: true },
            })
          : null;
        if (body.eventId && !event) {
          throw new HttpError(400, "Selected event is no longer available");
        }

        const defaultEndsAt = event?.endsAt && event.endsAt > now
          ? event.endsAt
          : new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const { start: startsAt, end: endsAt } = parseDateRange(
          now.toISOString(),
          body.endsAt ?? defaultEndsAt.toISOString(),
        );

        const rawTitle = event?.summary ?? customPurpose;
        if (!rawTitle) {
          throw new HttpError(400, "Select an event or enter what this checkout is for");
        }
        const title = normalizeBookingTitle(rawTitle);
        // The pickup kiosk is captured on `pickupKioskDeviceId`, so we no longer
        // duplicate it as a note. Keep only a real user-entered purpose.
        const notes = event && customPurpose ? `Purpose: ${customPurpose}` : null;

        const availability = await checkAvailability(tx, {
          locationId,
          startsAt,
          endsAt,
          serializedAssetIds: assetIds,
          bulkItems: bulkRequestsFromCheckoutUnits(bulkUnitItems),
          bookingKind: BookingKind.CHECKOUT,
        });
        if (hasBlockingAvailabilityIssue(availability)) {
          throw new HttpError(
            409,
            "One or more items are not available for the selected return time",
            availability,
          );
        }

        // Create the booking
        const b = await tx.booking.create({
          data: {
            kind: "CHECKOUT",
            status: "OPEN",
            title,
            eventId: event?.id,
            sportCode: event?.sportCode,
            requesterUserId: actorId,
            createdBy: actorId,
            locationId,
            startsAt,
            endsAt,
            refNumber,
            notes,
            pickupKioskDeviceId: kiosk.kioskId,
          },
        });

        if (event) {
          await tx.bookingEvent.create({
            data: {
              bookingId: b.id,
              eventId: event.id,
              ordinal: 0,
            },
          });
        }

        // Create serialized items + allocations
        const ids = assetIds;

        if (ids.length > 0) {
          await tx.bookingSerializedItem.createMany({
            data: ids.map((assetId) => ({
              bookingId: b.id,
              assetId,
              allocationStatus: "active",
            })),
          });

          await tx.assetAllocation.createMany({
            data: ids.map((assetId) => ({
              assetId,
              bookingId: b.id,
              startsAt,
              endsAt,
              active: true,
              kind: "CHECKOUT" as const,
            })),
          });

          await tx.asset.updateMany({
            where: { id: { in: ids } },
            data: { locationId },
          });
        }

        if (bulkUnitItems.length > 0) {
          const seenBulkUnits = new Set<string>();
          for (const item of bulkUnitItems) {
            const key = `${item.bulkSkuId}:${item.unitNumber}`;
            if (seenBulkUnits.has(key)) {
              throw new HttpError(409, "Duplicate battery unit in checkout");
            }
            seenBulkUnits.add(key);
          }

          const units = await tx.bulkSkuUnit.findMany({
            where: {
              OR: bulkUnitItems.map((item) => ({
                bulkSkuId: item.bulkSkuId,
                unitNumber: item.unitNumber,
              })),
            },
            include: {
              bulkSku: {
                select: {
                  id: true,
                  name: true,
                  active: true,
                },
              },
              allocations: {
                where: ACTIVE_BULK_UNIT_ALLOCATION_WHERE,
                take: 1,
                select: { id: true },
              },
            },
          });
          if (units.length !== bulkUnitItems.length) {
            throw new HttpError(404, "One or more battery units were not found");
          }

          // Effective status, not raw: an orphaned CHECKED_OUT flag with no
          // active allocation is claimable (every read path already reports
          // it available) — claiming self-heals the flag.
          const unavailable = units.find(
            (unit) => !unit.bulkSku.active || effectiveBulkUnitStatus(unit, unit.allocations[0]) !== BulkUnitStatus.AVAILABLE,
          );
          if (unavailable) {
            throw new HttpError(409, `${unavailable.bulkSku.name} #${unavailable.unitNumber} is no longer available`);
          }

          const updatedUnits = await tx.bulkSkuUnit.updateMany({
            where: {
              id: { in: units.map((unit) => unit.id) },
              ...CLAIMABLE_BULK_UNIT_WHERE,
            },
            data: { status: BulkUnitStatus.CHECKED_OUT },
          });
          if (updatedUnits.count !== units.length) {
            throw new HttpError(409, "One or more battery units are no longer available");
          }

          const unitsBySku = new Map<string, typeof units>();
          for (const unit of units) {
            unitsBySku.set(unit.bulkSkuId, [...(unitsBySku.get(unit.bulkSkuId) ?? []), unit]);
          }

          for (const [bulkSkuId, skuUnits] of unitsBySku) {
            const bulkItem = await tx.bookingBulkItem.create({
              data: {
                bookingId: b.id,
                bulkSkuId,
                plannedQuantity: skuUnits.length,
                checkedOutQuantity: skuUnits.length,
              },
            });
            await tx.bookingBulkUnitAllocation.createMany({
              data: skuUnits.map((unit) => ({
                bookingBulkItemId: bulkItem.id,
                bulkSkuUnitId: unit.id,
                checkedOutAt: now,
              })),
            });
          }

          await upsertBulkBalancesAndMovements(tx, {
            locationId,
            bookingId: b.id,
            actorUserId: actorId,
            kind: BulkMovementKind.CHECKOUT,
            items: [...unitsBySku.entries()].map(([bulkSkuId, skuUnits]) => ({
              bulkSkuId,
              quantity: skuUnits.length,
            })),
          });
        }

        return { booking: b, refNumber };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await createAuditEntry({
      actorId,
      actorRole: user.role,
      entityType: "booking",
      entityId: booking.id,
      action: "kiosk_checkout",
      after: {
        refNumber,
        itemCount: assetIds.length + bulkUnitItems.length,
        source: "KIOSK",
        kioskDeviceId: kiosk.kioskId,
        locationName: kiosk.locationName,
        eventId: body.eventId ?? null,
        customPurpose: customPurpose ?? null,
        title: booking.title,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
      },
    });

    await badges.onCheckoutOpened({
      userId: actorId,
      bookingId: booking.id,
      source: "kiosk_checkout",
      sourceKey: booking.id,
    });

    await scheduleCheckoutReturnLiveActivity({
      bookingId: booking.id,
      endsAt: booking.endsAt,
    });

    return ok({
      bookingId: booking.id,
      refNumber,
      itemCount: assetIds.length + bulkUnitItems.length,
      endsAt: booking.endsAt,
    });
  } catch (error) {
    if (isBookingAllocationConstraintError(error)) {
      throw new HttpError(409, "One or more items are no longer available");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | string | undefined) ?? "";
      const targetStr = Array.isArray(target) ? target.join(",") : String(target);
      // Booking.refNumber collision → race with another concurrent kiosk; retryable.
      if (targetStr.includes("ref_number") || targetStr.includes("refNumber")) {
        throw new HttpError(
          409,
          "Could not allocate a checkout reference — please retry",
        );
      }
      // BookingSerializedItem(bookingId, assetId) → item-level conflict.
      throw new HttpError(409, "One or more items are no longer available");
    }
    throw error;
  }
});
