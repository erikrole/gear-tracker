import {
  AllocationKind,
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  Prisma,
  ScanSessionStatus
} from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import {
  createAuditEntriesTx,
  createAuditEntryTx,
  lookupActorRole,
} from "@/lib/audit";
import { checkAvailability, type BulkRequest } from "@/lib/services/availability";
import { nextBookingRef } from "@/lib/services/booking-ref";
import {
  bookingInclude,
  dedupeIds,
  diffEquipment,
  upsertBulkBalancesAndMovements,
  type AuditJson,
} from "./bookings-helpers";

type CreateBookingInput = {
  kind: BookingKind;
  title: string;
  requesterUserId: string;
  locationId: string;
  startsAt: Date;
  endsAt: Date;
  serializedAssetIds: string[];
  bulkItems: BulkRequest[];
  notes?: string;
  createdBy: string;
  sourceReservationId?: string;
  eventId?: string;
  /** Optional multi-event linking. If provided, events are sorted chronologically
   * and the first one becomes the primary (`Booking.eventId`). Mutually exclusive
   * with `eventId` — callers pick one. Cap 3 events. */
  eventIds?: string[];
  sportCode?: string;
  shiftAssignmentId?: string;
  kitId?: string;
};

type UpdateBookingInput = {
  title?: string;
  requesterUserId?: string;
  locationId?: string;
  startsAt?: Date;
  endsAt?: Date;
  serializedAssetIds?: string[];
  bulkItems?: BulkRequest[];
  notes?: string;
  status?: BookingStatus;
};

export async function createBooking(input: CreateBookingInput) {
  try {
    return await db.$transaction(
    async (tx) => {
      // Resolve items from source reservation if provided
      let resolvedSerializedAssetIds = dedupeIds(input.serializedAssetIds);
      let resolvedBulkItems = input.bulkItems;

      if (input.sourceReservationId) {
        const sourceReservation = await tx.booking.findUnique({
          where: { id: input.sourceReservationId },
          include: { serializedItems: true, bulkItems: true }
        });

        if (!sourceReservation) {
          throw new HttpError(404, "Source reservation not found");
        }
        if (sourceReservation.kind !== BookingKind.RESERVATION) {
          throw new HttpError(400, "sourceReservationId does not refer to a reservation");
        }
        if (sourceReservation.status !== BookingStatus.BOOKED) {
          throw new HttpError(400, `Source reservation is not in BOOKED status (current: ${sourceReservation.status})`);
        }
        if (sourceReservation.locationId !== input.locationId) {
          throw new HttpError(400, "Source reservation belongs to a different location");
        }

        if (resolvedSerializedAssetIds.length === 0) {
          resolvedSerializedAssetIds = sourceReservation.serializedItems.map((item) => item.assetId);
        }
        if (resolvedBulkItems.length === 0) {
          resolvedBulkItems = sourceReservation.bulkItems.map((item) => ({
            bulkSkuId: item.bulkSkuId,
            quantity: item.plannedQuantity
          }));
        }
      }

      const availability = await checkAvailability(tx, {
        locationId: input.locationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        serializedAssetIds: resolvedSerializedAssetIds,
        bulkItems: resolvedBulkItems,
        bookingKind: input.kind,
      });

      if (availability.conflicts.length > 0 || availability.shortages.length > 0 || availability.unavailableAssets.length > 0) {
        throw new HttpError(409, "Availability conflict", availability);
      }

      const status = input.kind === BookingKind.RESERVATION ? BookingStatus.BOOKED : BookingStatus.PENDING_PICKUP;

      // Resolve event linking: multi-event (eventIds) or legacy single (eventId).
      // Reject if both are provided. Sort chronologically so primary = first.
      if (input.eventId && input.eventIds && input.eventIds.length > 0) {
        throw new HttpError(400, "Provide either eventId or eventIds, not both");
      }
      const requestedEventIds = input.eventIds && input.eventIds.length > 0
        ? dedupeIds(input.eventIds)
        : input.eventId ? [input.eventId] : [];
      if (requestedEventIds.length > 3) {
        throw new HttpError(400, "A booking may link at most 3 events");
      }
      let sortedEventIds: string[] = [];
      if (requestedEventIds.length > 0) {
        const events = await tx.calendarEvent.findMany({
          where: { id: { in: requestedEventIds } },
          select: { id: true, startsAt: true },
        });
        if (events.length !== requestedEventIds.length) {
          throw new HttpError(400, "One or more eventIds do not exist");
        }
        sortedEventIds = [...events]
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
          .map((e) => e.id);
      }
      const primaryEventId = sortedEventIds[0] ?? null;

      const prefix = input.kind === BookingKind.CHECKOUT ? "CO" : "RV";
      const refNumber = await nextBookingRef(tx, prefix);

      const booking = await tx.booking.create({
        data: {
          kind: input.kind,
          title: input.title,
          refNumber,
          requesterUserId: input.requesterUserId,
          locationId: input.locationId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status,
          createdBy: input.createdBy,
          notes: input.notes,
          sourceReservationId: input.sourceReservationId ?? null,
          eventId: primaryEventId,
          sportCode: input.sportCode ?? null,
          shiftAssignmentId: input.shiftAssignmentId ?? null,
          kitId: input.kitId ?? null
        }
      });

      if (sortedEventIds.length > 0) {
        await tx.bookingEvent.createMany({
          data: sortedEventIds.map((eventId, ordinal) => ({
            bookingId: booking.id,
            eventId,
            ordinal,
          })),
        });
      }

      if (resolvedSerializedAssetIds.length > 0) {
        await tx.bookingSerializedItem.createMany({
          data: resolvedSerializedAssetIds.map((assetId) => ({
            bookingId: booking.id,
            assetId,
            allocationStatus: "active"
          }))
        });

        await tx.assetAllocation.createMany({
          data: resolvedSerializedAssetIds.map((assetId) => ({
            bookingId: booking.id,
            assetId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            active: true,
            kind: input.kind === BookingKind.RESERVATION ? AllocationKind.RESERVATION : AllocationKind.CHECKOUT
          }))
        });
      }

      if (resolvedBulkItems.length > 0) {
        await tx.bookingBulkItem.createMany({
          data: resolvedBulkItems.map((item) => ({
            bookingId: booking.id,
            bulkSkuId: item.bulkSkuId,
            plannedQuantity: item.quantity,
          }))
        });

        if (input.kind === BookingKind.CHECKOUT) {
          await upsertBulkBalancesAndMovements(tx, {
            locationId: input.locationId,
            bookingId: booking.id,
            actorUserId: input.createdBy,
            kind: BulkMovementKind.CHECKOUT,
            items: resolvedBulkItems
          });
        }
      }

      const actorRole = await lookupActorRole(tx, input.createdBy);

      await createAuditEntryTx(tx, {
        actorId: input.createdBy,
        actorRole,
        entityType: "booking",
        entityId: booking.id,
        action: "created",
        after: {
          kind: input.kind,
          title: input.title,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          serializedAssetIds: resolvedSerializedAssetIds,
          bulkItems: resolvedBulkItems,
          sourceReservationId: input.sourceReservationId,
          eventIds: sortedEventIds,
        },
      });

      // Cancel the source reservation atomically within the same transaction
      if (input.sourceReservationId) {
        await tx.booking.update({
          where: { id: input.sourceReservationId },
          data: { status: BookingStatus.CANCELLED }
        });

        await tx.assetAllocation.updateMany({
          where: { bookingId: input.sourceReservationId },
          data: { active: false }
        });

        await tx.scanSession.updateMany({
          where: { bookingId: input.sourceReservationId, status: ScanSessionStatus.OPEN },
          data: { status: ScanSessionStatus.CANCELLED }
        });

        await createAuditEntryTx(tx, {
          actorId: input.createdBy,
          actorRole,
          entityType: "booking",
          entityId: input.sourceReservationId,
          action: "cancelled_by_checkout_conversion",
          after: { convertedToCheckoutId: booking.id },
        });
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | string | undefined) ?? "";
      const targetStr = Array.isArray(target) ? target.join(",") : String(target);
      // Partial-unique index on asset_allocations(asset_id) WHERE active = TRUE.
      // Fires when another flow allocated the same asset between availability
      // check and insert. Maps to a 409 the booking-create UI already handles.
      if (
        targetStr.includes("asset_allocations_asset_id_active_unique") ||
        targetStr.includes("asset_id")
      ) {
        throw new HttpError(409, "One or more items are no longer available");
      }
    }
    throw error;
  }
}

export async function updateReservation(
  bookingId: string,
  actorUserId: string,
  updates: UpdateBookingInput
) {
  return db.$transaction(
    async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          serializedItems: true,
          bulkItems: true
        }
      });

      if (!existing) {
        throw new HttpError(404, "Reservation not found");
      }

      if (existing.kind !== BookingKind.RESERVATION) {
        throw new HttpError(400, "Only reservations can be updated with this endpoint");
      }

      if (existing.status === BookingStatus.CANCELLED || existing.status === BookingStatus.COMPLETED) {
        throw new HttpError(400, "Cannot edit a cancelled or completed reservation");
      }

      const nextStartsAt = updates.startsAt ?? existing.startsAt;
      const nextEndsAt = updates.endsAt ?? existing.endsAt;
      const nextLocationId = updates.locationId ?? existing.locationId;
      const serializedAssetIds = dedupeIds(
        updates.serializedAssetIds ?? existing.serializedItems.map((item) => item.assetId)
      );
      const bulkItems = updates.bulkItems ??
        existing.bulkItems.map((item) => ({
          bulkSkuId: item.bulkSkuId,
          quantity: item.plannedQuantity
        }));

      const availability = await checkAvailability(tx, {
        locationId: nextLocationId,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        serializedAssetIds,
        bulkItems,
        excludeBookingId: bookingId,
        bookingKind: "RESERVATION",
      });

      if (availability.conflicts.length > 0 || availability.shortages.length > 0 || availability.unavailableAssets.length > 0) {
        throw new HttpError(409, "Availability conflict", availability);
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          title: updates.title,
          requesterUserId: updates.requesterUserId,
          locationId: nextLocationId,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          notes: updates.notes,
          status: updates.status
        }
      });

      await tx.bookingSerializedItem.deleteMany({ where: { bookingId } });
      await tx.assetAllocation.deleteMany({ where: { bookingId } });
      await tx.bookingBulkItem.deleteMany({ where: { bookingId } });

      if (serializedAssetIds.length > 0) {
        await tx.bookingSerializedItem.createMany({
          data: serializedAssetIds.map((assetId) => ({
            bookingId,
            assetId,
            allocationStatus: "active"
          }))
        });

        await tx.assetAllocation.createMany({
          data: serializedAssetIds.map((assetId) => ({
            bookingId,
            assetId,
            startsAt: nextStartsAt,
            endsAt: nextEndsAt,
            active: true,
            kind: "RESERVATION"
          }))
        });
      }

      if (bulkItems.length > 0) {
        await tx.bookingBulkItem.createMany({
          data: bulkItems.map((item) => ({
            bookingId,
            bulkSkuId: item.bulkSkuId,
            plannedQuantity: item.quantity
          }))
        });
      }

      // Granular equipment audit entries
      const equipEntries = diffEquipment(
        existing.serializedItems.map((i) => i.assetId),
        serializedAssetIds,
        existing.bulkItems.map((i) => ({ bulkSkuId: i.bulkSkuId, quantity: i.plannedQuantity })),
        bulkItems
      );

      // General "updated" entry for non-equipment fields
      const fieldChanges: AuditJson = {};
      if (updates.title && updates.title !== existing.title) fieldChanges.title = updates.title;
      if (updates.notes !== undefined && updates.notes !== existing.notes) fieldChanges.notes = updates.notes ?? null;
      if (updates.startsAt && updates.startsAt.toISOString() !== existing.startsAt.toISOString()) fieldChanges.startsAt = updates.startsAt.toISOString();
      if (updates.endsAt && updates.endsAt.toISOString() !== existing.endsAt.toISOString()) fieldChanges.endsAt = updates.endsAt.toISOString();

      const actorRole = await lookupActorRole(tx, actorUserId);

      if (Object.keys(fieldChanges).length > 0 || equipEntries.length === 0) {
        await createAuditEntryTx(tx, {
          actorId: actorUserId,
          actorRole,
          entityType: "booking",
          entityId: bookingId,
          action: "updated",
          before: {
            title: existing.title,
            startsAt: existing.startsAt.toISOString(),
            endsAt: existing.endsAt.toISOString(),
            notes: existing.notes,
          } as AuditJson as Record<string, unknown>,
          after: fieldChanges as Record<string, unknown>,
        });
      }

      if (equipEntries.length > 0) {
        await createAuditEntriesTx(
          tx,
          equipEntries.map((entry) => ({
            actorId: actorUserId,
            actorRole,
            entityType: "booking",
            entityId: bookingId,
            action: entry.action,
            before: entry.beforeJson as Record<string, unknown>,
            after: entry.afterJson as Record<string, unknown>,
          })),
        );
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: bookingInclude
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cancelReservation(bookingId: string, actorUserId: string) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      throw new HttpError(404, "Reservation not found");
    }

    if (booking.kind !== BookingKind.RESERVATION) {
      throw new HttpError(400, "Only reservations can be cancelled");
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED }
    });

    await tx.assetAllocation.updateMany({
      where: { bookingId },
      data: { active: false }
    });

    await tx.scanSession.updateMany({
      where: { bookingId, status: ScanSessionStatus.OPEN },
      data: { status: ScanSessionStatus.CANCELLED }
    });

    const actorRole = await lookupActorRole(tx, actorUserId);
    await createAuditEntryTx(tx, {
      actorId: actorUserId,
      actorRole,
      entityType: "booking",
      entityId: bookingId,
      action: "cancelled",
    });

    return { success: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateCheckout(
  bookingId: string,
  actorUserId: string,
  updates: UpdateBookingInput
) {
  return db.$transaction(
    async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          serializedItems: true,
          bulkItems: true
        }
      });

      if (!existing) {
        throw new HttpError(404, "Checkout not found");
      }

      if (existing.kind !== BookingKind.CHECKOUT) {
        throw new HttpError(400, "Only checkouts can be updated with this endpoint");
      }

      if (existing.status === BookingStatus.CANCELLED || existing.status === BookingStatus.COMPLETED) {
        throw new HttpError(400, "Cannot edit a cancelled or completed checkout");
      }

      const nextEndsAt = updates.endsAt ?? existing.endsAt;
      const nextLocationId = updates.locationId ?? existing.locationId;
      const nextStartsAt = existing.startsAt; // start is fixed for OPEN checkouts

      const serializedAssetIds = dedupeIds(
        updates.serializedAssetIds ?? existing.serializedItems.map((item) => item.assetId)
      );
      const bulkItems = updates.bulkItems ??
        existing.bulkItems.map((item) => ({
          bulkSkuId: item.bulkSkuId,
          quantity: item.plannedQuantity
        }));

      const availability = await checkAvailability(tx, {
        locationId: nextLocationId,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        serializedAssetIds,
        bulkItems,
        excludeBookingId: bookingId,
        bookingKind: "CHECKOUT",
      });

      if (availability.conflicts.length > 0 || availability.shortages.length > 0 || availability.unavailableAssets.length > 0) {
        throw new HttpError(409, "Conflicts with another booking", availability);
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          title: updates.title,
          endsAt: nextEndsAt,
          notes: updates.notes
        }
      });

      // Rebuild allocations with possibly changed items/dates
      await tx.bookingSerializedItem.deleteMany({ where: { bookingId } });
      await tx.assetAllocation.deleteMany({ where: { bookingId } });
      await tx.bookingBulkItem.deleteMany({ where: { bookingId } });

      if (serializedAssetIds.length > 0) {
        await tx.bookingSerializedItem.createMany({
          data: serializedAssetIds.map((assetId) => ({
            bookingId,
            assetId,
            allocationStatus: "active"
          }))
        });

        await tx.assetAllocation.createMany({
          data: serializedAssetIds.map((assetId) => ({
            bookingId,
            assetId,
            startsAt: nextStartsAt,
            endsAt: nextEndsAt,
            active: true,
            kind: "CHECKOUT"
          }))
        });
      }

      if (bulkItems.length > 0) {
        await tx.bookingBulkItem.createMany({
          data: bulkItems.map((item) => ({
            bookingId,
            bulkSkuId: item.bulkSkuId,
            plannedQuantity: item.quantity,
          }))
        });
      }

      // Granular equipment audit entries
      const equipEntries = diffEquipment(
        existing.serializedItems.map((i) => i.assetId),
        serializedAssetIds,
        existing.bulkItems.map((i) => ({ bulkSkuId: i.bulkSkuId, quantity: i.plannedQuantity })),
        bulkItems
      );

      const fieldChanges: AuditJson = {};
      if (updates.title && updates.title !== existing.title) fieldChanges.title = updates.title;
      if (updates.notes !== undefined && updates.notes !== existing.notes) fieldChanges.notes = updates.notes ?? null;
      if (updates.endsAt && updates.endsAt.toISOString() !== existing.endsAt.toISOString()) fieldChanges.endsAt = updates.endsAt.toISOString();

      const actorRole = await lookupActorRole(tx, actorUserId);

      if (Object.keys(fieldChanges).length > 0 || equipEntries.length === 0) {
        await createAuditEntryTx(tx, {
          actorId: actorUserId,
          actorRole,
          entityType: "booking",
          entityId: bookingId,
          action: "updated",
          before: {
            title: existing.title,
            endsAt: existing.endsAt.toISOString(),
            notes: existing.notes,
          } as AuditJson as Record<string, unknown>,
          after: fieldChanges as Record<string, unknown>,
        });
      }

      if (equipEntries.length > 0) {
        await createAuditEntriesTx(
          tx,
          equipEntries.map((entry) => ({
            actorId: actorUserId,
            actorRole,
            entityType: "booking",
            entityId: bookingId,
            action: entry.action,
            before: entry.beforeJson as Record<string, unknown>,
            after: entry.afterJson as Record<string, unknown>,
          })),
        );
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: bookingInclude
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function extendBooking(
  bookingId: string,
  actorUserId: string,
  newEndsAt: Date
) {
  return db.$transaction(
    async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { serializedItems: true, bulkItems: true }
      });

      if (!existing) {
        throw new HttpError(404, "Booking not found");
      }

      if (existing.status !== BookingStatus.OPEN && existing.status !== BookingStatus.BOOKED) {
        throw new HttpError(400, "Can only extend active bookings");
      }

      if (newEndsAt <= existing.endsAt) {
        throw new HttpError(400, "New end date must be later than current end date");
      }

      if (newEndsAt.getTime() < Date.now()) {
        throw new HttpError(400, "New end date must be in the future");
      }

      const serializedAssetIds = existing.serializedItems.map((i) => i.assetId);
      const bulkItems = existing.bulkItems.map((i) => ({
        bulkSkuId: i.bulkSkuId,
        quantity: i.plannedQuantity
      }));

      const availability = await checkAvailability(tx, {
        locationId: existing.locationId,
        startsAt: existing.startsAt,
        endsAt: newEndsAt,
        serializedAssetIds,
        bulkItems,
        excludeBookingId: bookingId,
        bookingKind: existing.kind,
      });

      if (availability.conflicts.length > 0) {
        throw new HttpError(409, "Conflicts with another booking", availability);
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: { endsAt: newEndsAt }
      });

      await tx.assetAllocation.updateMany({
        where: { bookingId, active: true },
        data: { endsAt: newEndsAt }
      });

      const actorRole = await lookupActorRole(tx, actorUserId);
      await createAuditEntryTx(tx, {
        actorId: actorUserId,
        actorRole,
        entityType: "booking",
        entityId: bookingId,
        action: "extended",
        before: { endsAt: existing.endsAt },
        after: { endsAt: newEndsAt },
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: bookingInclude
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cancelBooking(bookingId: string, actorUserId: string) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new HttpError(400, "Booking is already cancelled");
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new HttpError(400, "Cannot cancel a completed booking");
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED }
    });

    await tx.assetAllocation.updateMany({
      where: { bookingId },
      data: { active: false }
    });

    await tx.scanSession.updateMany({
      where: { bookingId, status: ScanSessionStatus.OPEN },
      data: { status: ScanSessionStatus.CANCELLED }
    });

    const actorRole = await lookupActorRole(tx, actorUserId);
    await createAuditEntryTx(tx, {
      actorId: actorUserId,
      actorRole,
      entityType: "booking",
      entityId: bookingId,
      action: "cancelled",
    });

    return { success: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
