import { BookingKind, BookingStatus, Role, ScanPhase, ScanSessionStatus, ScanType } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { markCheckoutCompleted } from "@/lib/services/bookings";

export async function startScanSession(args: {
  bookingId: string;
  actorUserId: string;
  phase: ScanPhase;
}) {
  const booking = await db.booking.findUnique({ where: { id: args.bookingId } });

  if (!booking || booking.kind !== BookingKind.CHECKOUT) {
    throw new HttpError(404, "Checkout not found");
  }

  const existing = await db.scanSession.findFirst({
    where: {
      bookingId: args.bookingId,
      phase: args.phase,
      status: ScanSessionStatus.OPEN
    }
  });

  if (existing) {
    return existing;
  }

  return db.scanSession.create({
    data: {
      bookingId: args.bookingId,
      actorUserId: args.actorUserId,
      phase: args.phase,
      status: ScanSessionStatus.OPEN
    }
  });
}

export async function recordScan(args: {
  bookingId: string;
  actorUserId: string;
  phase: ScanPhase;
  scanType: ScanType;
  scanValue: string;
  quantity?: number;
  deviceContext?: string;
}) {
  const booking = await db.booking.findUnique({
    where: { id: args.bookingId },
    include: {
      serializedItems: { include: { asset: true } },
      bulkItems: { include: { bulkSku: true } }
    }
  });

  if (!booking || booking.kind !== BookingKind.CHECKOUT) {
    throw new HttpError(404, "Checkout not found");
  }

  if (args.scanType === ScanType.SERIALIZED) {
    const asset = booking.serializedItems.find((item) => item.asset.qrCodeValue === args.scanValue)?.asset;

    if (!asset) {
      await db.scanEvent.create({
        data: {
          bookingId: args.bookingId,
          actorUserId: args.actorUserId,
          scanType: ScanType.SERIALIZED,
          scanValue: args.scanValue,
          phase: args.phase,
          success: false,
          deviceContext: args.deviceContext
        }
      });

      throw new HttpError(400, "Scanned serialized QR does not belong to this checkout");
    }

    const event = await db.scanEvent.create({
      data: {
        bookingId: args.bookingId,
        actorUserId: args.actorUserId,
        scanType: ScanType.SERIALIZED,
        scanValue: args.scanValue,
        assetId: asset.id,
        phase: args.phase,
        success: true,
        deviceContext: args.deviceContext
      }
    });

    return { success: true, event };
  }

  if (!args.quantity || args.quantity <= 0) {
    throw new HttpError(400, "Bulk scans require a positive quantity");
  }

  const bulkSku = booking.bulkItems.find((item) => item.bulkSku.binQrCodeValue === args.scanValue)?.bulkSku;

  if (!bulkSku) {
    await db.scanEvent.create({
      data: {
        bookingId: args.bookingId,
        actorUserId: args.actorUserId,
        scanType: ScanType.BULK_BIN,
        scanValue: args.scanValue,
        phase: args.phase,
        success: false,
        quantity: args.quantity,
        deviceContext: args.deviceContext
      }
    });

    throw new HttpError(400, "Scanned bulk bin QR does not belong to this checkout");
  }

  const { event } = await db.$transaction(async (tx) => {
    const event = await tx.scanEvent.create({
      data: {
        bookingId: args.bookingId,
        actorUserId: args.actorUserId,
        scanType: ScanType.BULK_BIN,
        scanValue: args.scanValue,
        bulkSkuId: bulkSku.id,
        phase: args.phase,
        success: true,
        quantity: args.quantity,
        deviceContext: args.deviceContext
      }
    });

    const quantityField =
      args.phase === ScanPhase.CHECKOUT ? "checkedOutQuantity" : "checkedInQuantity";

    await tx.bookingBulkItem.update({
      where: {
        bookingId_bulkSkuId: {
          bookingId: args.bookingId,
          bulkSkuId: bulkSku.id
        }
      },
      data: { [quantityField]: { increment: args.quantity } }
    });

    return { event };
  });

  return { success: true, event };
}

async function hasAdminOverride(bookingId: string) {
  const count = await db.overrideEvent.count({ where: { bookingId } });
  return count > 0;
}

async function buildScanCompletionState(bookingId: string, phase: ScanPhase) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      serializedItems: true,
      bulkItems: true,
      scanEvents: {
        where: {
          phase,
          success: true
        }
      }
    }
  });

  if (!booking) {
    throw new HttpError(404, "Checkout not found");
  }

  const requiredSerialized = new Set(booking.serializedItems.map((item) => item.assetId));
  const scannedSerialized = new Set(
    booking.scanEvents.filter((event) => event.scanType === ScanType.SERIALIZED && event.assetId).map((e) => e.assetId!)
  );

  const missingSerialized = [...requiredSerialized].filter((assetId) => !scannedSerialized.has(assetId));

  const requiredBulk = new Map(booking.bulkItems.map((item) => [item.bulkSkuId, item.plannedQuantity]));
  const scannedBulk = new Map<string, number>();

  for (const event of booking.scanEvents) {
    if (event.scanType !== ScanType.BULK_BIN || !event.bulkSkuId) {
      continue;
    }

    const current = scannedBulk.get(event.bulkSkuId) ?? 0;
    scannedBulk.set(event.bulkSkuId, current + (event.quantity ?? 0));
  }

  const missingBulk = [...requiredBulk.entries()]
    .filter(([skuId, qty]) => (scannedBulk.get(skuId) ?? 0) < qty)
    .map(([skuId, qty]) => ({
      bulkSkuId: skuId,
      required: qty,
      scanned: scannedBulk.get(skuId) ?? 0
    }));

  return {
    booking,
    missingSerialized,
    missingBulk
  };
}

export async function completeCheckoutScan(bookingId: string, actorUserId: string) {
  const state = await buildScanCompletionState(bookingId, ScanPhase.CHECKOUT);

  if (state.booking.status !== BookingStatus.OPEN) {
    throw new HttpError(400, "Checkout must be open");
  }

  const override = await hasAdminOverride(bookingId);

  if (!override && (state.missingSerialized.length > 0 || state.missingBulk.length > 0)) {
    throw new HttpError(400, "Scan requirements not met", {
      missingSerialized: state.missingSerialized,
      missingBulk: state.missingBulk
    });
  }

  await db.scanSession.updateMany({
    where: {
      bookingId,
      phase: ScanPhase.CHECKOUT,
      status: ScanSessionStatus.OPEN
    },
    data: {
      status: ScanSessionStatus.COMPLETED,
      completedAt: new Date()
    }
  });

  await db.auditLog.create({
    data: {
      actorUserId,
      entityType: "booking",
      entityId: bookingId,
      action: "checkout_scan_completed"
    }
  });

  return {
    success: true,
    missingSerialized: state.missingSerialized,
    missingBulk: state.missingBulk,
    overrideUsed: override
  };
}

export async function completeCheckinScan(bookingId: string, actorUserId: string) {
  const state = await buildScanCompletionState(bookingId, ScanPhase.CHECKIN);
  const override = await hasAdminOverride(bookingId);

  if (!override && (state.missingSerialized.length > 0 || state.missingBulk.length > 0)) {
    throw new HttpError(400, "Scan requirements not met", {
      missingSerialized: state.missingSerialized,
      missingBulk: state.missingBulk
    });
  }

  await db.scanSession.updateMany({
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

  await markCheckoutCompleted(bookingId, actorUserId);

  return {
    success: true,
    missingSerialized: state.missingSerialized,
    missingBulk: state.missingBulk,
    overrideUsed: override
  };
}

export async function createAdminOverride(args: {
  bookingId: string;
  actorUserId: string;
  actorRole: Role;
  reason: string;
  details?: Record<string, unknown>;
}) {
  if (args.actorRole !== Role.ADMIN) {
    throw new HttpError(403, "Only admins can create overrides");
  }

  const booking = await db.booking.findUnique({ where: { id: args.bookingId } });
  if (!booking) {
    throw new HttpError(404, "Checkout not found");
  }

  const event = await db.overrideEvent.create({
    data: {
      bookingId: args.bookingId,
      actorUserId: args.actorUserId,
      reason: args.reason,
      details: (args.details ?? undefined) as never
    }
  });

  await db.auditLog.create({
    data: {
      actorUserId: args.actorUserId,
      entityType: "booking",
      entityId: args.bookingId,
      action: "admin_override",
      afterJson: {
        reason: args.reason,
        details: args.details ?? null
      } as never
    }
  });

  return event;
}
