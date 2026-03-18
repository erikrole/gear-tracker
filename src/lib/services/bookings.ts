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
import { HttpError, parsePagination } from "@/lib/http";
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
  eventId?: string;
  sportCode?: string;
  shiftAssignmentId?: string;
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

const bookingListInclude = {
  location: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true } },
  serializedItems: {
    select: {
      id: true, assetId: true, allocationStatus: true,
      asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true } },
    },
  },
  bulkItems: {
    select: {
      id: true, plannedQuantity: true, checkedOutQuantity: true, checkedInQuantity: true,
      bulkSku: { select: { id: true, name: true, unit: true } },
    },
  },
  event: { select: { id: true, summary: true, sportCode: true, opponent: true, isHome: true } },
} satisfies Prisma.BookingInclude;

const BOOKING_SORT_MAP: Record<string, Prisma.BookingOrderByWithRelationInput[]> = {
  oldest: [{ startsAt: "asc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
  title_desc: [{ title: "desc" }, { id: "asc" }],
  endsAt: [{ endsAt: "asc" }, { id: "asc" }],
  endsAt_desc: [{ endsAt: "desc" }, { id: "asc" }],
};

export async function listBookings(
  kind: BookingKind,
  searchParams: URLSearchParams,
  extraWhere?: Prisma.BookingWhereInput
) {
  const q = searchParams.get("q")?.trim();
  const sortParam = searchParams.get("sort");

  const where: Prisma.BookingWhereInput = {
    kind,
    ...extraWhere,
    ...(!extraWhere && searchParams.get("status") ? { status: searchParams.get("status") as never } : {}),
    ...(searchParams.get("location_id") ? { locationId: searchParams.get("location_id")! } : {}),
    ...(searchParams.get("sport_code") ? { sportCode: searchParams.get("sport_code")! } : {}),
    ...(searchParams.get("requester_id") ? { requesterUserId: searchParams.get("requester_id")! } : {}),
    ...(searchParams.get("from") || searchParams.get("to")
      ? {
          startsAt: {
            ...(searchParams.get("from") ? { gte: new Date(searchParams.get("from")!) } : {}),
            ...(searchParams.get("to") ? { lte: new Date(searchParams.get("to")!) } : {})
          }
        }
      : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { requester: { name: { contains: q, mode: "insensitive" as const } } },
        { refNumber: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const orderBy = (sortParam && BOOKING_SORT_MAP[sortParam]) || [{ startsAt: "desc" }, { id: "asc" }];
  const { limit, offset } = parsePagination(searchParams);

  const [data, total] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy,
      include: bookingListInclude,
      take: limit,
      skip: offset
    }),
    db.booking.count({ where })
  ]);

  return { data, total, limit, offset };
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}

/* ── Equipment diff helpers for granular audit ── */

type AuditJson = Record<string, string | number | boolean | null | string[] | { bulkSkuId: string; quantity: number }[]>;

type EquipmentAuditEntry = {
  action: string;
  beforeJson: AuditJson;
  afterJson: AuditJson;
};

function diffEquipment(
  existingSerializedIds: string[],
  nextSerializedIds: string[],
  existingBulk: { bulkSkuId: string; quantity: number }[],
  nextBulk: { bulkSkuId: string; quantity: number }[]
): EquipmentAuditEntry[] {
  const entries: EquipmentAuditEntry[] = [];

  const oldSet = new Set(existingSerializedIds);
  const newSet = new Set(nextSerializedIds);
  const added = nextSerializedIds.filter((id) => !oldSet.has(id));
  const removed = existingSerializedIds.filter((id) => !newSet.has(id));

  if (added.length > 0) {
    entries.push({
      action: "booking.items_added",
      beforeJson: {},
      afterJson: { serializedAssetIds: added }
    });
  }

  if (removed.length > 0) {
    entries.push({
      action: "booking.items_removed",
      beforeJson: { serializedAssetIds: removed },
      afterJson: {}
    });
  }

  // Bulk qty changes
  const oldBulkMap = new Map(existingBulk.map((b) => [b.bulkSkuId, b.quantity]));
  const newBulkMap = new Map(nextBulk.map((b) => [b.bulkSkuId, b.quantity]));

  const bulkAdded: { bulkSkuId: string; quantity: number }[] = [];
  const bulkRemoved: { bulkSkuId: string; quantity: number }[] = [];
  const bulkChanged: { bulkSkuId: string; from: number; to: number }[] = [];

  for (const [skuId, qty] of newBulkMap) {
    const oldQty = oldBulkMap.get(skuId);
    if (oldQty === undefined) {
      bulkAdded.push({ bulkSkuId: skuId, quantity: qty });
    } else if (oldQty !== qty) {
      bulkChanged.push({ bulkSkuId: skuId, from: oldQty, to: qty });
    }
  }

  for (const [skuId, qty] of oldBulkMap) {
    if (!newBulkMap.has(skuId)) {
      bulkRemoved.push({ bulkSkuId: skuId, quantity: qty });
    }
  }

  if (bulkAdded.length > 0) {
    entries.push({
      action: "booking.items_added",
      beforeJson: {},
      afterJson: { bulkItems: bulkAdded }
    });
  }

  if (bulkRemoved.length > 0) {
    entries.push({
      action: "booking.items_removed",
      beforeJson: { bulkItems: bulkRemoved },
      afterJson: {}
    });
  }

  if (bulkChanged.length > 0) {
    entries.push({
      action: "booking.items_qty_changed",
      beforeJson: { bulkItems: bulkChanged.map((c) => ({ bulkSkuId: c.bulkSkuId, quantity: c.from })) },
      afterJson: { bulkItems: bulkChanged.map((c) => ({ bulkSkuId: c.bulkSkuId, quantity: c.to })) }
    });
  }

  return entries;
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
        bulkItems: resolvedBulkItems,
        bookingKind: input.kind as "CHECKOUT" | "RESERVATION",
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
          sourceReservationId: input.sourceReservationId ?? null,
          eventId: input.eventId ?? null,
          sportCode: input.sportCode ?? null,
          shiftAssignmentId: input.shiftAssignmentId ?? null
        }
      });

      // Generate human-readable reference number (CO-0001 / RV-0002)
      const seqResult = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('booking_ref_seq')`;
      const seq = Number(seqResult[0].nextval);
      const prefix = input.kind === BookingKind.CHECKOUT ? "CO" : "RV";
      const refNumber = `${prefix}-${String(seq).padStart(4, "0")}`;
      await tx.booking.update({ where: { id: booking.id }, data: { refNumber } });

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

      for (const entry of equipEntries) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: entry.action,
            beforeJson: entry.beforeJson as Prisma.InputJsonValue,
            afterJson: entry.afterJson as Prisma.InputJsonValue
          }
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

      for (const entry of equipEntries) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: entry.action,
            beforeJson: entry.beforeJson as Prisma.InputJsonValue,
            afterJson: entry.afterJson as Prisma.InputJsonValue
          }
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
        bookingKind: existing.kind as "CHECKOUT" | "RESERVATION",
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
  });
}

/**
 * Partial check-in: return individual serialized items from a checkout.
 * Marks each item's allocationStatus as "returned" and deactivates its allocation.
 * If all serialized items are returned (and bulk items fully checked in),
 * auto-completes the checkout.
 *
 * Source: BRIEF_CHECKOUT_UX_V2.md — "Partial check-in: multi-item
 * allocations can be returned incrementally without triggering completion"
 */
export async function checkinItems(
  bookingId: string,
  actorUserId: string,
  assetIds: string[]
) {
  return db.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { serializedItems: true, bulkItems: true }
      });

      if (!booking || booking.kind !== BookingKind.CHECKOUT) {
        throw new HttpError(404, "Checkout not found");
      }

      if (booking.status !== BookingStatus.OPEN) {
        throw new HttpError(400, "Can only check in items from an open checkout");
      }

      // Validate all requested assets belong to this checkout
      const bookingAssetIds = new Set(booking.serializedItems.map((i) => i.assetId));
      const invalid = assetIds.filter((id) => !bookingAssetIds.has(id));
      if (invalid.length > 0) {
        throw new HttpError(400, `Assets not in this checkout: ${invalid.join(", ")}`);
      }

      // Validate none are already returned
      const alreadyReturned = booking.serializedItems
        .filter((i) => assetIds.includes(i.assetId) && i.allocationStatus === "returned")
        .map((i) => i.assetId);
      if (alreadyReturned.length > 0) {
        throw new HttpError(400, `Assets already returned: ${alreadyReturned.join(", ")}`);
      }

      // Mark items as returned
      for (const assetId of assetIds) {
        await tx.bookingSerializedItem.updateMany({
          where: { bookingId, assetId },
          data: { allocationStatus: "returned" }
        });

        await tx.assetAllocation.updateMany({
          where: { bookingId, assetId, active: true },
          data: { active: false }
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: "booking",
          entityId: bookingId,
          action: "partial_checkin",
          afterJson: { returnedAssetIds: assetIds }
        }
      });

      // Check if all serialized items are now returned
      const remainingActive = await tx.bookingSerializedItem.count({
        where: { bookingId, allocationStatus: "active" }
      });

      // Check if all bulk items are fully checked in
      const bulkRemaining = booking.bulkItems.some(
        (item) => (item.checkedInQuantity ?? 0) < (item.checkedOutQuantity ?? item.plannedQuantity)
      );

      const allReturned = remainingActive === 0 && !bulkRemaining;

      if (allReturned) {
        await tx.assetAllocation.updateMany({
          where: { bookingId, active: true },
          data: { active: false }
        });

        // Return bulk stock
        const checkinBulkItems = booking.bulkItems.map((item) => ({
          bulkSkuId: item.bulkSkuId,
          quantity: item.checkedOutQuantity ?? item.plannedQuantity
        }));

        if (checkinBulkItems.length > 0) {
          await upsertBulkBalancesAndMovements(tx, {
            bookingId,
            locationId: booking.locationId,
            actorUserId,
            kind: BulkMovementKind.CHECKIN,
            items: checkinBulkItems
          });
        }

        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.COMPLETED }
        });

        await tx.scanSession.updateMany({
          where: { bookingId, phase: ScanPhase.CHECKIN, status: ScanSessionStatus.OPEN },
          data: { status: ScanSessionStatus.COMPLETED, completedAt: new Date() }
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            entityType: "booking",
            entityId: bookingId,
            action: "auto_completed_by_partial_checkin"
          }
        });
      }

      return {
        success: true,
        returnedAssetIds: assetIds,
        remainingActiveItems: remainingActive,
        autoCompleted: allReturned
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function getBookingDetail(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...bookingInclude,
      creator: { select: { id: true, name: true, email: true } },
      serializedItems: { include: { asset: { include: { location: { select: { id: true, name: true } } } } } },
    }
  });

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  const auditLogs = await db.auditLog.findMany({
    where: { entityType: "booking", entityId: bookingId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, name: true } } }
  });

  const isOverdue = booking.status === BookingStatus.OPEN && booking.endsAt < new Date();
  const isActive = booking.status === BookingStatus.OPEN || booking.status === BookingStatus.BOOKED;

  // Compute distinct locations represented by assets in this booking
  const locationMap = new Map<string, string>();
  locationMap.set(booking.location.id, booking.location.name);
  for (const item of booking.serializedItems) {
    if (item.asset.location) {
      locationMap.set(item.asset.location.id, item.asset.location.name);
    }
  }
  const itemLocations = Array.from(locationMap, ([id, name]) => ({ id, name }));
  const locationMode: "SINGLE" | "MIXED" = itemLocations.length > 1 ? "MIXED" : "SINGLE";

  return {
    ...booking,
    isOverdue,
    isActive,
    bookingType: booking.kind === BookingKind.RESERVATION ? "Reservation" : "Checkout",
    auditLogs,
    itemLocations,
    locationMode
  };
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
