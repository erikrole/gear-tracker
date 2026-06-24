import { BookingKind, BookingStatus, BulkMovementKind, ScanSessionStatus, type Role } from "@prisma/client";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { upsertBulkBalancesAndMovements } from "@/lib/services/bookings-helpers";

export type UserDeactivationResult = {
  cancelledIds: string[];
  directReportsCleared: number;
};

export async function deactivateUserWithCleanup(args: {
  targetUserId: string;
  actorId: string;
  actorRole: Role;
}): Promise<UserDeactivationResult> {
  const { targetUserId, actorId, actorRole } = args;

  const deactivationResult = await db.$transaction(async (tx) => {
    const openCheckouts = await tx.booking.count({
      where: {
        requesterUserId: targetUserId,
        kind: "CHECKOUT",
        status: BookingStatus.OPEN,
      },
    });
    if (openCheckouts > 0) {
      throw new HttpError(
        400,
        `Cannot deactivate: user has ${openCheckouts} open checkout${openCheckouts > 1 ? "s" : ""}. Return all gear first.`
      );
    }

    const toCancel = await tx.booking.findMany({
      where: {
        requesterUserId: targetUserId,
        status: { in: [BookingStatus.BOOKED, BookingStatus.DRAFT, BookingStatus.PENDING_PICKUP] },
      },
      select: {
        id: true,
        kind: true,
        status: true,
        locationId: true,
        bulkItems: { select: { bulkSkuId: true, plannedQuantity: true } },
      },
    });

    if (toCancel.length > 0) {
      for (const booking of toCancel) {
        if (booking.kind === BookingKind.CHECKOUT && booking.status === BookingStatus.PENDING_PICKUP && booking.bulkItems.length > 0) {
          await upsertBulkBalancesAndMovements(tx, {
            locationId: booking.locationId,
            bookingId: booking.id,
            actorUserId: actorId,
            kind: BulkMovementKind.CHECKIN,
            items: booking.bulkItems.map((item) => ({
              bulkSkuId: item.bulkSkuId,
              quantity: item.plannedQuantity,
            })),
          });
        }
      }

      await tx.booking.updateMany({
        where: { id: { in: toCancel.map((b) => b.id) } },
        data: { status: BookingStatus.CANCELLED },
      });
      await tx.assetAllocation.updateMany({
        where: { bookingId: { in: toCancel.map((b) => b.id) } },
        data: { active: false },
      });
      await tx.scanSession.updateMany({
        where: { bookingId: { in: toCancel.map((b) => b.id) }, status: ScanSessionStatus.OPEN },
        data: { status: ScanSessionStatus.CANCELLED },
      });
    }

    await tx.session.deleteMany({ where: { userId: targetUserId } });
    const directReportCleanup = await tx.user.updateMany({
      where: { directReportId: targetUserId },
      data: { directReportId: null },
    });
    await tx.user.update({
      where: { id: targetUserId },
      data: { active: false },
    });

    return {
      cancelledIds: toCancel.map((b) => b.id),
      directReportsCleared: directReportCleanup.count,
    };
  }, { isolationLevel: "Serializable" });

  if (deactivationResult.cancelledIds.length > 0 || deactivationResult.directReportsCleared > 0) {
    await createAuditEntry({
      actorId,
      actorRole,
      entityType: "user",
      entityId: targetUserId,
      action: "deactivation_cancelled_bookings",
      after: {
        cancelledBookingIds: deactivationResult.cancelledIds,
        cancelledCount: deactivationResult.cancelledIds.length,
        directReportsCleared: deactivationResult.directReportsCleared,
      },
    });
  }

  return deactivationResult;
}
