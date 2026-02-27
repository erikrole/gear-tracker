import {
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  Prisma,
  PrismaClient,
  ScanPhase,
  ScanSessionStatus
} from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { checkAvailability, type BulkRequest } from "@/lib/services/availability";

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

const bookingInclude = {
  serializedItems: {
    include: {
      asset: true
    }
  },
  bulkItems: {
    include: {
      bulkSku: true
    }
  },
  location: true,
  requester: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.BookingInclude;

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}

async function upsertBulkBalancesAndMovements(
  tx: Prisma.TransactionClient,
  args: {
    locationId: string;
    bookingId: string;
    actorUserId: string;
    kind: BulkMovementKind;
    items: BulkRequest[];
  }
) {
  for (const item of args.items) {
    const existing = await tx.bulkStockBalance.findUnique({
      where: {
        bulkSkuId_locationId: {
          bulkSkuId: item.bulkSkuId,
          locationId: args.locationId
        }
      }
    });

    const current = existing?.onHandQuantity ?? 0;
    const delta = args.kind === BulkMovementKind.CHECKIN ? item.quantity : -item.quantity;
    const next = current + delta;

    if (next < 0) {
      throw new HttpError(
        409,
        `Insufficient bulk stock for ${item.bulkSkuId}. On hand: ${current}, required: ${item.quantity}`
      );
    }

    await tx.bulkStockBalance.upsert({
      where: {
        bulkSkuId_locationId: {
          bulkSkuId: item.bulkSkuId,
          locationId: args.locationId
        }
      },
      create: {
        bulkSkuId: item.bulkSkuId,
        locationId: args.locationId,
        onHandQuantity: next
      },
      update: {
        onHandQuantity: next
      }
    });

    await tx.bulkStockMovement.create({
      data: {
        bulkSkuId: item.bulkSkuId,
        locationId: args.locationId,
        bookingId: args.bookingId,
        actorUserId: args.actorUserId,
        kind: args.kind,
        quantity: item.quantity
      }
    });
  }
}

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
        bulkItems: resolvedBulkItems
      });

      if (availability.conflicts.length > 0 || availability.shortages.length > 0 || availability.unavailableAssets.length > 0) {
        throw new HttpError(409, "Availability conflict", availability);
      }

      const status = input.kind === BookingKind.RESERVATION ? BookingStatus.BOOKED : BookingStatus.OPEN;

      const booking = await tx.booking.create({
        data: {
          kind: input.kind,
          title: input.title,
          requesterUserId: input.requesterUserId,
          locationId: input.locationId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status,
          createdBy: input.createdBy,
          notes: input.notes,
          sourceReservationId: input.sourceReservationId ?? null
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
            kind: input.kind === BookingKind.RESERVATION ? "RESERVATION" : "CHECKOUT"
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
        excludeBookingId: bookingId
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

      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: "booking",
          entityId: bookingId,
          action: "updated",
          beforeJson: existing,
          afterJson: {
            ...updates,
            serializedAssetIds,
            bulkItems
          }
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
  });
}

export async function markCheckoutCompleted(bookingId: string, actorUserId: string) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { bulkItems: true }
    });

    if (!booking || booking.kind !== BookingKind.CHECKOUT) {
      throw new HttpError(404, "Checkout not found");
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED
      }
    });

    await tx.assetAllocation.updateMany({
      where: { bookingId },
      data: { active: false }
    });

    const checkinItems = booking.bulkItems.map((item) => ({
      bulkSkuId: item.bulkSkuId,
      quantity: item.checkedOutQuantity ?? item.plannedQuantity
    }));

    if (checkinItems.length > 0) {
      await upsertBulkBalancesAndMovements(tx, {
        bookingId,
        locationId: booking.locationId,
        actorUserId,
        kind: BulkMovementKind.CHECKIN,
        items: checkinItems
      });
    }

    await tx.scanSession.updateMany({
      where: {
        bookingId,
        phase: ScanPhase.CHECKIN,
        status: ScanSessionStatus.OPEN
      },
      data: {
        status: ScanSessionStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: "booking",
        entityId: bookingId,
        action: "checkin_completed"
      }
    });

    return { success: true };
  });
}

export async function getBookingForScan(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      serializedItems: { include: { asset: true } },
      bulkItems: { include: { bulkSku: true } },
      scanSessions: true,
      overrides: true
    }
  });

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  return booking;
}
