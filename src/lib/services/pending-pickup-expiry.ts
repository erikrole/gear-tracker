import {
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  BulkUnitStatus,
  Prisma,
  ScanSessionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditEntryTx } from "@/lib/audit";
import { loadReservationRules } from "@/lib/services/reservation-rules";
import { createShiftScheduleNotification } from "@/lib/services/notifications";
import { releaseReservationManagedAssignmentTx } from "@/lib/services/reservation-schedule";

const DEFAULT_EXPIRY_LIMIT = 50;

type PendingPickupExpiryResult = {
  scanned: number;
  expired: number;
  failed: number;
  cutoff: Date;
  errors: Record<string, string>;
};

type PickupNoShowCandidate = {
  id: string;
};

export async function expirePickupNoShows(
  now = new Date(),
  limit = DEFAULT_EXPIRY_LIMIT,
): Promise<PendingPickupExpiryResult> {
  const rules = await loadReservationRules();
  const cutoff = new Date(now.getTime() - rules.noShowExpiryHours * 3_600_000);
  const candidates = await db.booking.findMany({
    where: {
      OR: [
        {
          kind: BookingKind.RESERVATION,
          status: BookingStatus.BOOKED,
        },
        {
          kind: BookingKind.CHECKOUT,
          status: BookingStatus.PENDING_PICKUP,
        },
      ],
      startsAt: { lt: cutoff },
    },
    select: { id: true },
    orderBy: { startsAt: "asc" },
    take: limit,
  });

  const errors: Record<string, string> = {};
  let expired = 0;

  for (const candidate of candidates) {
    try {
      const didExpire = await expirePickupNoShow(candidate, cutoff, now, rules.noShowExpiryHours);
      if (didExpire) expired += 1;
    } catch (error) {
      console.error(`[pending-pickup-expiry] failed to expire ${candidate.id}`, error);
      errors[candidate.id] = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return {
    scanned: candidates.length,
    expired,
    failed: Object.keys(errors).length,
    cutoff,
    errors,
  };
}

async function expirePickupNoShow(
  candidate: PickupNoShowCandidate,
  cutoff: Date,
  now: Date,
  noShowExpiryHours: number,
) {
  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: candidate.id },
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

    const isReservationNoShow = booking?.kind === BookingKind.RESERVATION
      && booking.status === BookingStatus.BOOKED;
    const isLegacyPendingCheckout = booking?.kind === BookingKind.CHECKOUT
      && booking.status === BookingStatus.PENDING_PICKUP;

    if (!booking || (!isReservationNoShow && !isLegacyPendingCheckout) || booking.startsAt >= cutoff) {
      return { expired: false, releasedAssignmentId: null as string | null };
    }

    const cancelled = await tx.booking.updateMany({
      where: {
        id: booking.id,
        OR: [
          { kind: BookingKind.RESERVATION, status: BookingStatus.BOOKED },
          { kind: BookingKind.CHECKOUT, status: BookingStatus.PENDING_PICKUP },
        ],
        startsAt: { lt: cutoff },
      },
      data: { status: BookingStatus.CANCELLED },
    });
    if (cancelled.count !== 1) return { expired: false, releasedAssignmentId: null as string | null };

    let releasedAssignmentId: string | null = null;
    if (isReservationNoShow && booking.shiftAssignmentId) {
      const release = await releaseReservationManagedAssignmentTx(tx, {
        bookingId: booking.id,
        assignmentId: booking.shiftAssignmentId,
      });
      if (release.released) {
        releasedAssignmentId = release.assignmentId;
        await createAuditEntryTx(tx, {
          actorId: null,
          actorRole: null,
          entityType: "shift_assignment",
          entityId: release.assignmentId!,
          action: "shift_assignment_removed",
          before: {
            source: "event_gear_reservation",
            bookingId: booking.id,
          },
          after: { reason: "reservation_no_show_expired" },
        });
      } else if (release.blocked) {
        await createAuditEntryTx(tx, {
          actorId: null,
          actorRole: null,
          entityType: "booking",
          entityId: booking.id,
          action: "schedule_assignment_review_needed",
          after: {
            status: "blocked_working_copy",
            reason: "No-show expiry could not change an event's working schedule.",
          },
        });
      }
    }

    // BOOKED reservations express quantity intent and never decrement bulk
    // stock. Only legacy staged checkouts have stock/unit custody to restore.
    if (isLegacyPendingCheckout) {
      const outstandingBulk = booking.bulkItems
        .map((item) => ({
          bulkSkuId: item.bulkSkuId,
          quantity: item.plannedQuantity - (item.checkedInQuantity ?? 0),
        }))
        .filter((item) => item.quantity > 0);

      await restoreBulkStock(tx, {
        bookingId: booking.id,
        locationId: booking.locationId,
        actorUserId: booking.createdBy,
        items: outstandingBulk,
      });

      const activeUnitIds = booking.bulkItems.flatMap((item) =>
        item.unitAllocations.map((allocation) => allocation.bulkSkuUnitId),
      );
      if (activeUnitIds.length > 0) {
        await tx.bookingBulkUnitAllocation.updateMany({
          where: {
            bookingBulkItemId: { in: booking.bulkItems.map((item) => item.id) },
            bulkSkuUnitId: { in: activeUnitIds },
            checkedOutAt: { not: null },
            checkedInAt: null,
          },
          data: { checkedInAt: now },
        });
        await tx.bulkSkuUnit.updateMany({
          where: { id: { in: activeUnitIds } },
          data: { status: BulkUnitStatus.AVAILABLE },
        });
      }
    }

    await tx.assetAllocation.updateMany({
      where: { bookingId: booking.id },
      data: { active: false },
    });

    await tx.scanSession.updateMany({
      where: { bookingId: booking.id, status: ScanSessionStatus.OPEN },
      data: { status: ScanSessionStatus.CANCELLED },
    });

    await createAuditEntryTx(tx, {
      actorId: null,
      actorRole: null,
      entityType: "booking",
      entityId: booking.id,
      action: isReservationNoShow ? "reservation_no_show_expired" : "pending_pickup_expired",
      before: {
        kind: booking.kind,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
      },
      after: {
        status: BookingStatus.CANCELLED,
        expiredAt: now.toISOString(),
        policyHours: noShowExpiryHours,
      },
    });

    return { expired: true, releasedAssignmentId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (result.releasedAssignmentId) {
    await createShiftScheduleNotification(result.releasedAssignmentId, "removed");
  }
  return result.expired;
}

async function restoreBulkStock(
  tx: Prisma.TransactionClient,
  args: {
    bookingId: string;
    locationId: string;
    actorUserId: string;
    items: Array<{ bulkSkuId: string; quantity: number }>;
  },
) {
  if (args.items.length === 0) return;

  const balances = await tx.bulkStockBalance.findMany({
    where: {
      locationId: args.locationId,
      bulkSkuId: { in: args.items.map((item) => item.bulkSkuId) },
    },
  });
  const balanceMap = new Map(balances.map((balance) => [balance.bulkSkuId, balance.onHandQuantity]));

  for (const item of args.items) {
    const next = (balanceMap.get(item.bulkSkuId) ?? 0) + item.quantity;
    await tx.bulkStockBalance.upsert({
      where: {
        bulkSkuId_locationId: {
          bulkSkuId: item.bulkSkuId,
          locationId: args.locationId,
        },
      },
      create: {
        bulkSkuId: item.bulkSkuId,
        locationId: args.locationId,
        onHandQuantity: next,
      },
      update: { onHandQuantity: next },
    });
  }

  await tx.bulkStockMovement.createMany({
    data: args.items.map((item) => ({
      bulkSkuId: item.bulkSkuId,
      locationId: args.locationId,
      bookingId: args.bookingId,
      actorUserId: args.actorUserId,
      kind: BulkMovementKind.CHECKIN,
      quantity: item.quantity,
      reason: "pending_pickup_auto_expired",
    })),
  });
}
