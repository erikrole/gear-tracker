import {
  AllocationKind,
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  BulkUnitStatus,
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
  custodySource?: "KIOSK";
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
  /** KioskDevice that handled pickup — captured at kiosk custody transitions. */
  pickupKioskDeviceId?: string;
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

function hasDuplicateIds(ids: string[]) {
  return new Set(ids).size !== ids.length;
}

function assertValidBookingWindow(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new HttpError(400, "Invalid startsAt or endsAt");
  }
  if (endsAt <= startsAt) {
    throw new HttpError(400, "endsAt must be later than startsAt");
  }
}

function assertValidCreateEventLinks(input: CreateBookingInput) {
  if (input.eventId && input.eventIds && input.eventIds.length > 0) {
    throw new HttpError(400, "Provide either eventId or eventIds, not both");
  }
  if (input.eventIds && input.eventIds.length > 3) {
    throw new HttpError(400, "A booking may link at most 3 events");
  }
  if (input.eventIds && hasDuplicateIds(input.eventIds)) {
    throw new HttpError(400, "eventIds must be unique");
  }
}

function assertValidCreateEquipment(serializedAssetIds: string[], bulkItems: BulkRequest[]) {
  if (serializedAssetIds.length === 0 && bulkItems.length === 0) {
    throw new HttpError(400, "Add at least one piece of equipment");
  }

  const seenBulkSkuIds = new Set<string>();
  for (const item of bulkItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new HttpError(400, "Bulk item quantities must be positive whole numbers");
    }
    if (seenBulkSkuIds.has(item.bulkSkuId)) {
      throw new HttpError(400, "Duplicate bulk item");
    }
    seenBulkSkuIds.add(item.bulkSkuId);
  }
}

function assertCheckoutCustodySource(input: CreateBookingInput) {
  if (input.kind === BookingKind.CHECKOUT && input.custodySource !== "KIOSK") {
    throw new HttpError(403, "Direct checkout custody can only be created at a kiosk");
  }
}

function prismaErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const meta = typeof error === "object" && error && "meta" in error
    ? JSON.stringify((error as { meta?: unknown }).meta ?? {})
    : "";
  return `${message} ${meta}`;
}

function isSerializableConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const metaCode = (error as { meta?: { code?: unknown } }).meta?.code;
  return code === "P2034" || code === "40001" || metaCode === "40001";
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

export async function createBooking(input: CreateBookingInput) {
  assertValidBookingWindow(input.startsAt, input.endsAt);
  assertValidCreateEventLinks(input);
  assertCheckoutCustodySource(input);

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

      assertValidCreateEquipment(resolvedSerializedAssetIds, resolvedBulkItems);

      const availability = await checkAvailability(tx, {
        locationId: input.locationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        serializedAssetIds: resolvedSerializedAssetIds,
        bulkItems: resolvedBulkItems,
        excludeBookingId: input.sourceReservationId,
        bookingKind: input.kind,
      });

      if (availability.conflicts.length > 0 || availability.shortages.length > 0 || availability.unavailableAssets.length > 0) {
        throw new HttpError(409, "Availability conflict", availability);
      }

      const status = input.kind === BookingKind.RESERVATION
        ? BookingStatus.BOOKED
        : input.custodySource === "KIOSK" && input.sourceReservationId
          ? BookingStatus.OPEN
          : BookingStatus.PENDING_PICKUP;

      // Resolve event linking: multi-event (eventIds) or legacy single (eventId).
      // Sort chronologically so primary = first.
      const requestedEventIds = input.eventIds && input.eventIds.length > 0
        ? input.eventIds
        : input.eventId ? [input.eventId] : [];
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
          kitId: input.kitId ?? null,
          pickupKioskDeviceId: input.pickupKioskDeviceId ?? null
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

      // Fulfill the source reservation atomically within the same transaction.
      if (input.sourceReservationId) {
        await tx.booking.update({
          where: { id: input.sourceReservationId },
          data: { status: BookingStatus.COMPLETED, completedAt: new Date() }
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
          action: "fulfilled_by_kiosk_pickup",
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
    if (isSerializableConflict(error)) {
      throw new HttpError(409, "Someone else submitted at the same time; please try again.");
    }
    if (isBookingAllocationConstraintError(error)) {
      throw new HttpError(409, "One or more items are no longer available");
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
      assertValidBookingWindow(nextStartsAt, nextEndsAt);
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
      assertValidBookingWindow(nextStartsAt, nextEndsAt);

      const serializedAssetIds = dedupeIds(
        updates.serializedAssetIds ?? existing.serializedItems.map((item) => item.assetId)
      );
      const bulkItems = updates.bulkItems ??
        existing.bulkItems.map((item) => ({
          bulkSkuId: item.bulkSkuId,
          quantity: item.plannedQuantity
        }));
      const updatesEquipment = updates.serializedAssetIds !== undefined || updates.bulkItems !== undefined;

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

      if (!updatesEquipment) {
        await tx.assetAllocation.updateMany({
          where: { bookingId },
          data: {
            startsAt: nextStartsAt,
            endsAt: nextEndsAt,
          },
        });
      } else {
        // Rebuild allocations only when the caller explicitly changed equipment.
        // Detail-only edits must not cascade-delete numbered bulk unit history.
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
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        bulkItems: {
          select: {
            id: true,
            bulkSkuId: true,
            plannedQuantity: true,
            checkedInQuantity: true,
            unitAllocations: {
              where: { checkedOutAt: { not: null }, checkedInAt: null },
              select: { bulkSkuUnitId: true },
            },
          },
        },
      },
    });

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

    const bulkItems = booking.bulkItems ?? [];
    if (booking.kind === BookingKind.CHECKOUT && (booking.status === BookingStatus.PENDING_PICKUP || booking.status === BookingStatus.OPEN) && bulkItems.length > 0) {
      const outstandingBulk = bulkItems
        .map((item) => ({
          bulkSkuId: item.bulkSkuId,
          quantity: item.plannedQuantity - (item.checkedInQuantity ?? 0),
        }))
        .filter((item) => item.quantity > 0);

      await upsertBulkBalancesAndMovements(tx, {
        locationId: booking.locationId,
        bookingId,
        actorUserId,
        kind: BulkMovementKind.CHECKIN,
        items: outstandingBulk,
      });

      const activeUnitIds = bulkItems.flatMap((item) => (item.unitAllocations ?? []).map((allocation) => allocation.bulkSkuUnitId));
      if (activeUnitIds.length > 0) {
        await tx.bookingBulkUnitAllocation.updateMany({
          where: {
            bookingBulkItemId: { in: bulkItems.map((item) => item.id) },
            bulkSkuUnitId: { in: activeUnitIds },
            checkedOutAt: { not: null },
            checkedInAt: null,
          },
          data: { checkedInAt: new Date() },
        });
        await tx.bulkSkuUnit.updateMany({
          where: { id: { in: activeUnitIds } },
          data: { status: BulkUnitStatus.AVAILABLE },
        });
      }
    }

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
