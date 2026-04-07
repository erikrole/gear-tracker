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
import { checkAvailability, type BulkRequest } from "@/lib/services/availability";
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
  return db.$transaction(
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

      const status = input.kind === BookingKind.RESERVATION ? BookingStatus.BOOKED : BookingStatus.OPEN;

      const seqResult = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('booking_ref_seq')`;
      const seq = Number(seqResult[0].nextval);
      const prefix = input.kind === BookingKind.CHECKOUT ? "CO" : "RV";
      const refNumber = `${prefix}-${String(seq).padStart(4, "0")}`;

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
          eventId: input.eventId ?? null,
          sportCode: input.sportCode ?? null,
          shiftAssignmentId: input.shiftAssignmentId ?? null,
          kitId: input.kitId ?? null
        }
      });

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
            checkedOutQuantity: input.kind === BookingKind.CHECKOUT ? 0 : null,
            checkedInQuantity: null
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

      await tx.auditLog.create({
        data: {
          actorUserId: input.createdBy,
          entityType: "booking",
          entityId: booking.id,
          action: "created",
          afterJson: {
            kind: input.kind,
            title: input.title,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            serializedAssetIds: resolvedSerializedAssetIds,
            bulkItems: resolvedBulkItems,
            sourceReservationId: input.sourceReservationId
          }
        }
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

        await tx.auditLog.create({
          data: {
            actorUserId: input.createdBy,
            entityType: "booking",
            entityId: input.sourceReservationId,
            action: "cancelled_by_checkout_conversion",
            afterJson: { convertedToCheckoutId: booking.id }
          }
        });
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
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

      if (Object.keys(fieldChanges).length > 0 || equipEntries.length === 0) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: "updated",
            beforeJson: {
              title: existing.title,
              startsAt: existing.startsAt.toISOString(),
              endsAt: existing.endsAt.toISOString(),
              notes: existing.notes
            } satisfies AuditJson,
            afterJson: fieldChanges
          }
        });
      }

      if (equipEntries.length > 0) {
        await tx.auditLog.createMany({
          data: equipEntries.map((entry) => ({
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: entry.action,
            beforeJson: entry.beforeJson as Prisma.InputJsonValue,
            afterJson: entry.afterJson as Prisma.InputJsonValue
          }))
        });
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

    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: "booking",
        entityId: bookingId,
        action: "cancelled"
      }
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
            checkedOutQuantity: 0,
            checkedInQuantity: null
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

      if (Object.keys(fieldChanges).length > 0 || equipEntries.length === 0) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: "updated",
            beforeJson: {
              title: existing.title,
              endsAt: existing.endsAt.toISOString(),
              notes: existing.notes
            } satisfies AuditJson,
            afterJson: fieldChanges
          }
        });
      }

      if (equipEntries.length > 0) {
        await tx.auditLog.createMany({
          data: equipEntries.map((entry) => ({
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: entry.action,
            beforeJson: entry.beforeJson as Prisma.InputJsonValue,
            afterJson: entry.afterJson as Prisma.InputJsonValue
          }))
        });
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

      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: "booking",
          entityId: bookingId,
          action: "extended",
          beforeJson: { endsAt: existing.endsAt },
          afterJson: { endsAt: newEndsAt }
        }
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

    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: "booking",
        entityId: bookingId,
        action: "cancelled"
      }
    });

    return { success: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
