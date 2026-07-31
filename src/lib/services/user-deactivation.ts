import {
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  Prisma,
  ScanSessionStatus,
  type Role,
} from "@prisma/client";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";

export type UserDeactivationResult = {
  cancelledIds: string[];
  directReportsCleared: number;
};

type PendingPickupBulkRestoration = {
  bookingId: string;
  bulkSkuId: string;
  locationId: string;
  quantity: number;
};

async function restorePendingPickupBulkStock(
  tx: Prisma.TransactionClient,
  args: {
    actorUserId: string;
    restorations: PendingPickupBulkRestoration[];
  },
) {
  if (args.restorations.length === 0) return;

  const balanceDeltasByKey = new Map<
    string,
    { bulkSkuId: string; locationId: string; quantity: number }
  >();
  for (const restoration of args.restorations) {
    const key = `${restoration.bulkSkuId}\u0000${restoration.locationId}`;
    const existing = balanceDeltasByKey.get(key);
    if (existing) {
      existing.quantity += restoration.quantity;
    } else {
      balanceDeltasByKey.set(key, {
        bulkSkuId: restoration.bulkSkuId,
        locationId: restoration.locationId,
        quantity: restoration.quantity,
      });
    }
  }

  const balanceDeltas = [...balanceDeltasByKey.values()].sort((left, right) => {
    const locationOrder = left.locationId.localeCompare(right.locationId);
    return locationOrder !== 0
      ? locationOrder
      : left.bulkSkuId.localeCompare(right.bulkSkuId);
  });
  const existingBalances = await tx.bulkStockBalance.findMany({
    where: {
      OR: balanceDeltas.map((balance) => ({
        bulkSkuId: balance.bulkSkuId,
        locationId: balance.locationId,
      })),
    },
    select: {
      bulkSkuId: true,
      locationId: true,
      onHandQuantity: true,
    },
  });
  const existingByKey = new Map(
    existingBalances.map((balance) => [
      `${balance.bulkSkuId}\u0000${balance.locationId}`,
      balance.onHandQuantity,
    ]),
  );

  const updates: Array<{
    bulkSkuId: string;
    locationId: string;
    next: number;
  }> = [];
  const creates: Array<{
    bulkSkuId: string;
    locationId: string;
    onHandQuantity: number;
  }> = [];
  for (const balance of balanceDeltas) {
    const key = `${balance.bulkSkuId}\u0000${balance.locationId}`;
    const current = existingByKey.get(key) ?? 0;
    const next = current + balance.quantity;
    if (next < 0) {
      throw new HttpError(
        409,
        `Insufficient bulk stock for ${balance.bulkSkuId}. On hand: ${current}, required: ${balance.quantity}`,
      );
    }

    if (existingByKey.has(key)) {
      updates.push({
        bulkSkuId: balance.bulkSkuId,
        locationId: balance.locationId,
        next,
      });
    } else {
      creates.push({
        bulkSkuId: balance.bulkSkuId,
        locationId: balance.locationId,
        onHandQuantity: next,
      });
    }
  }

  if (updates.length > 0) {
    const values = updates.map((update) => Prisma.sql`(
      CAST(${update.bulkSkuId} AS TEXT),
      CAST(${update.locationId} AS TEXT),
      CAST(${update.next} AS INTEGER)
    )`);
    const updatedCount = await tx.$executeRaw(Prisma.sql`
      UPDATE "bulk_stock_balances" AS current
      SET
        "on_hand_quantity" = incoming.next_quantity,
        "updated_at" = NOW()
      FROM (
        VALUES ${Prisma.join(values)}
      ) AS incoming(bulk_sku_id, location_id, next_quantity)
      WHERE current."bulk_sku_id" = incoming.bulk_sku_id
        AND current."location_id" = incoming.location_id
    `);
    if (updatedCount !== updates.length) {
      throw new Error("One or more bulk stock balances changed during user deactivation");
    }
  }

  if (creates.length > 0) {
    await tx.bulkStockBalance.createMany({ data: creates });
  }

  await tx.bulkStockMovement.createMany({
    data: args.restorations.map((restoration) => ({
      bulkSkuId: restoration.bulkSkuId,
      locationId: restoration.locationId,
      bookingId: restoration.bookingId,
      actorUserId: args.actorUserId,
      kind: BulkMovementKind.CHECKIN,
      quantity: restoration.quantity,
    })),
  });
}

export async function deactivateUserWithCleanup(args: {
  targetUserId: string;
  actorId: string;
  actorRole: Role;
  audit?: {
    action: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}): Promise<UserDeactivationResult> {
  const { targetUserId, actorId, actorRole, audit } = args;

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
      await restorePendingPickupBulkStock(tx, {
        actorUserId: actorId,
        restorations: toCancel.flatMap((booking) => {
          if (
            booking.kind !== BookingKind.CHECKOUT
            || booking.status !== BookingStatus.PENDING_PICKUP
          ) {
            return [];
          }
          return booking.bulkItems.map((item) => ({
            bookingId: booking.id,
            locationId: booking.locationId,
            bulkSkuId: item.bulkSkuId,
            quantity: item.plannedQuantity,
          }));
        }),
      });

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

    const notificationAccessRevokedAt = new Date();
    await tx.session.deleteMany({ where: { userId: targetUserId } });
    const deviceTokenCleanup = await tx.deviceToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: notificationAccessRevokedAt },
    });
    const liveActivityStartTokenCleanup = await tx.liveActivityStartToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: notificationAccessRevokedAt },
    });
    const liveActivityTokensQueuedForEnd = await tx.liveActivityToken.count({
      where: { userId: targetUserId, endedAt: null },
    });
    const liveActivityStartsQueuedForEnd = await tx.liveActivityStart.count({
      where: { userId: targetUserId, endedAt: null },
    });
    const passwordResetTokenCleanup = await tx.passwordResetToken.deleteMany({
      where: { userId: targetUserId },
    });
    const directReportCleanup = await tx.user.updateMany({
      where: { directReportId: targetUserId },
      data: { directReportId: null },
    });
    await tx.user.update({
      where: { id: targetUserId },
      data: { active: false },
    });

    const result = {
      cancelledIds: toCancel.map((b) => b.id),
      directReportsCleared: directReportCleanup.count,
      notificationAccessRevoked: {
        deviceTokens: deviceTokenCleanup.count,
        liveActivityStartTokens: liveActivityStartTokenCleanup.count,
        liveActivityTokensQueuedForEnd,
        liveActivityStartsQueuedForEnd,
        passwordResetTokens: passwordResetTokenCleanup.count,
      },
    };

    const cleanupAfter = {
      cancelledBookingIds: result.cancelledIds,
      cancelledCount: result.cancelledIds.length,
      directReportsCleared: result.directReportsCleared,
      notificationAccessRevoked: result.notificationAccessRevoked,
    };
    const revokedNotificationAccessCount = Object.values(
      result.notificationAccessRevoked
    ).reduce((sum, count) => sum + count, 0);
    if (
      result.cancelledIds.length > 0
      || result.directReportsCleared > 0
      || revokedNotificationAccessCount > 0
    ) {
      await createAuditEntryTx(tx, {
        actorId,
        actorRole,
        entityType: "user",
        entityId: targetUserId,
        action: "deactivation_cleanup",
        after: cleanupAfter,
      });
    }

    if (audit) {
      await createAuditEntryTx(tx, {
        actorId,
        actorRole,
        entityType: "user",
        entityId: targetUserId,
        action: audit.action,
        before: audit.before,
        after: {
          ...(audit.after ?? {}),
          ...cleanupAfter,
        },
      });
    }

    return result;
  }, { isolationLevel: "Serializable" });

  return {
    cancelledIds: deactivationResult.cancelledIds,
    directReportsCleared: deactivationResult.directReportsCleared,
  };
}
