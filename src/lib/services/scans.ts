import { BookingKind, BookingStatus, BulkUnitStatus, Prisma, Role, ScanPhase, ScanSessionStatus, ScanType } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { markCheckoutCompleted } from "@/lib/services/bookings";
import { createAuditEntry } from "@/lib/audit";

export async function startScanSession(args: {
  bookingId: string;
  actorUserId: string;
  phase: ScanPhase;
}) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: args.bookingId } });

    if (!booking || booking.kind !== BookingKind.CHECKOUT) {
      throw new HttpError(404, "Checkout not found");
    }

    if (booking.status !== BookingStatus.OPEN) {
      throw new HttpError(400, "Cannot scan — this checkout is no longer open");
    }

    const existing = await tx.scanSession.findFirst({
      where: {
        bookingId: args.bookingId,
        phase: args.phase,
        status: ScanSessionStatus.OPEN
      }
    });

    if (existing) {
      return existing;
    }

    return tx.scanSession.create({
      data: {
        bookingId: args.bookingId,
        actorUserId: args.actorUserId,
        phase: args.phase,
        status: ScanSessionStatus.OPEN
      }
    });
  });
}

export async function recordScan(args: {
  bookingId: string;
  actorUserId: string;
  phase: ScanPhase;
  scanType: ScanType;
  scanValue: string;
  quantity?: number;
  unitNumbers?: number[];
  deviceContext?: string;
}) {
  // Wrap dedup check + booking fetch + scan creation in a transaction to prevent
  // race conditions (concurrent identical scans both passing the dedup window).
  const { booking, earlyReturn } = await db.$transaction(async (tx) => {
    // Dedup: reject if an identical successful scan was recorded in the last 5 seconds
    const dedupeWindow = new Date(Date.now() - 5000);
    const recentDupe = await tx.scanEvent.findFirst({
      where: {
        bookingId: args.bookingId,
        scanValue: args.scanValue,
        phase: args.phase,
        success: true,
        createdAt: { gte: dedupeWindow },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentDupe) {
      throw new HttpError(409, "Duplicate scan detected — this item was just scanned", {
        code: "DUPLICATE_SCAN",
      });
    }

    const booking = await tx.booking.findUnique({
      where: { id: args.bookingId },
      include: {
        serializedItems: { include: { asset: true } },
        bulkItems: { include: { bulkSku: true } }
      }
    });

    if (!booking || booking.kind !== BookingKind.CHECKOUT) {
      throw new HttpError(404, "Checkout not found");
    }

    // Prevent scans on completed/cancelled bookings
    if (booking.status !== BookingStatus.OPEN) {
      throw new HttpError(400, "Cannot scan — this checkout is no longer open");
    }

    if (args.scanType === ScanType.SERIALIZED) {
      const sv = args.scanValue.toLowerCase();
      const asset = booking.serializedItems.find((item) => {
        const a = item.asset;
        const qr = a.qrCodeValue.toLowerCase();
        const sc = a.primaryScanCode?.toLowerCase() ?? "";
        const tag = a.assetTag?.toLowerCase() ?? "";
        return qr === sv || qr === `qr-${sv}` || sc === sv || sc === `qr-${sv}` || tag === sv;
      })?.asset;

      if (!asset) {
        await tx.scanEvent.create({
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

        throw new HttpError(400, "Scanned item does not belong to this checkout", {
          code: "SCAN_NOT_IN_CHECKOUT",
        });
      }

      const event = await tx.scanEvent.create({
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

      return { booking, earlyReturn: { success: true as const, event } };
    }

    return { booking, earlyReturn: null };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (earlyReturn) {
    return earlyReturn;
  }

  const bulkItem = booking.bulkItems.find((item) => item.bulkSku.binQrCodeValue === args.scanValue);

  if (!bulkItem) {
    await db.scanEvent.create({
      data: {
        bookingId: args.bookingId,
        actorUserId: args.actorUserId,
        scanType: ScanType.BULK_BIN,
        scanValue: args.scanValue,
        phase: args.phase,
        success: false,
        quantity: args.quantity ?? args.unitNumbers?.length,
        deviceContext: args.deviceContext
      }
    });

    throw new HttpError(400, "Scanned bulk bin QR does not belong to this checkout", {
      code: "SCAN_NOT_IN_CHECKOUT",
    });
  }

  const bulkSku = bulkItem.bulkSku;

  // Numbered bulk: requires unitNumbers instead of quantity
  if (bulkSku.trackByNumber) {
    if (!args.unitNumbers || args.unitNumbers.length === 0) {
      throw new HttpError(400, "Numbered bulk items require unitNumbers");
    }

    const { event } = await db.$transaction(async (tx) => {
      const units = await tx.bulkSkuUnit.findMany({
        where: {
          bulkSkuId: bulkSku.id,
          unitNumber: { in: args.unitNumbers! }
        }
      });

      if (units.length !== args.unitNumbers!.length) {
        const found = new Set(units.map((u) => u.unitNumber));
        const missing = args.unitNumbers!.filter((n) => !found.has(n));
        throw new HttpError(400, `Unit numbers not found: ${missing.join(", ")}`);
      }

      if (args.phase === ScanPhase.CHECKOUT) {
        const unavailable = units.filter((u) => u.status !== BulkUnitStatus.AVAILABLE);
        if (unavailable.length > 0) {
          throw new HttpError(409, `Units not available: ${unavailable.map((u) => `#${u.unitNumber} (${u.status})`).join(", ")}`);
        }
      } else {
        const notCheckedOut = units.filter((u) => u.status !== BulkUnitStatus.CHECKED_OUT);
        if (notCheckedOut.length > 0) {
          throw new HttpError(409, `Units not checked out: ${notCheckedOut.map((u) => `#${u.unitNumber} (${u.status})`).join(", ")}`);
        }
      }

      const event = await tx.scanEvent.create({
        data: {
          bookingId: args.bookingId,
          actorUserId: args.actorUserId,
          scanType: ScanType.BULK_BIN,
          scanValue: args.scanValue,
          bulkSkuId: bulkSku.id,
          phase: args.phase,
          success: true,
          quantity: args.unitNumbers!.length,
          deviceContext: args.deviceContext
        }
      });

      const newStatus = args.phase === ScanPhase.CHECKOUT
        ? BulkUnitStatus.CHECKED_OUT
        : BulkUnitStatus.AVAILABLE;

      await tx.bulkSkuUnit.updateMany({
        where: {
          bulkSkuId: bulkSku.id,
          unitNumber: { in: args.unitNumbers! }
        },
        data: { status: newStatus }
      });

      const now = new Date();
      const allocationData = units.map((unit) => ({
        bookingBulkItemId: bulkItem.id,
        bulkSkuUnitId: unit.id,
        ...(args.phase === ScanPhase.CHECKOUT
          ? { checkedOutAt: now }
          : { checkedInAt: now })
      }));

      if (args.phase === ScanPhase.CHECKOUT) {
        await tx.bookingBulkUnitAllocation.createMany({ data: allocationData });
      } else {
        // On check-in, update existing allocation records
        for (const unit of units) {
          await tx.bookingBulkUnitAllocation.updateMany({
            where: {
              bookingBulkItemId: bulkItem.id,
              bulkSkuUnitId: unit.id
            },
            data: { checkedInAt: now }
          });
        }
      }

      const quantityField =
        args.phase === ScanPhase.CHECKOUT ? "checkedOutQuantity" : "checkedInQuantity";

      await tx.bookingBulkItem.update({
        where: { id: bulkItem.id },
        data: { [quantityField]: { increment: args.unitNumbers!.length } }
      });

      return { event };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { success: true, event };
  }

  // Standard (non-numbered) bulk flow
  if (!args.quantity || args.quantity <= 0) {
    throw new HttpError(400, "Bulk scans require a positive quantity");
  }

  // Guard + increment inside a single SERIALIZABLE transaction to prevent TOCTOU race
  const { event } = await db.$transaction(async (tx) => {
    // Re-read bulkItem inside transaction for fresh quantity values
    const freshBulkItem = await tx.bookingBulkItem.findUnique({
      where: {
        bookingId_bulkSkuId: {
          bookingId: args.bookingId,
          bulkSkuId: bulkSku.id
        }
      }
    });
    if (!freshBulkItem) {
      throw new HttpError(404, "Bulk item not found on this booking");
    }

    const currentQty = args.phase === ScanPhase.CHECKOUT
      ? (freshBulkItem.checkedOutQuantity ?? 0)
      : (freshBulkItem.checkedInQuantity ?? 0);
    const maxQty = args.phase === ScanPhase.CHECKOUT
      ? freshBulkItem.plannedQuantity
      : (freshBulkItem.checkedOutQuantity ?? freshBulkItem.plannedQuantity);
    if (currentQty + args.quantity! > maxQty) {
      throw new HttpError(400, `Scan would exceed ${args.phase === ScanPhase.CHECKOUT ? "planned" : "checked-out"} quantity. Current: ${currentQty}, scanning: ${args.quantity}, max: ${maxQty}`);
    }

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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { success: true, event };
}

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function buildScanCompletionState(tx: TxClient, bookingId: string, phase: ScanPhase) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      serializedItems: true,
      bulkItems: {
        include: {
          bulkSku: true,
          unitAllocations: {
            include: { bulkSkuUnit: true }
          }
        }
      },
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

  // Load checkin item reports (damaged/lost) — these count as "accounted for"
  const checkinReports = phase === ScanPhase.CHECKIN
    ? await tx.checkinItemReport.findMany({ where: { bookingId } })
    : [];
  const reportedAssetIds = new Set(checkinReports.map((r) => r.assetId));

  const requiredSerialized = new Set(booking.serializedItems.map((item) => item.assetId));
  const scannedSerialized = new Set(
    booking.scanEvents.filter((event) => event.scanType === ScanType.SERIALIZED && event.assetId).map((e) => e.assetId!)
  );

  // Items that are scanned OR reported (damaged/lost) are not considered "missing"
  const missingSerialized = [...requiredSerialized].filter(
    (assetId) => !scannedSerialized.has(assetId) && !reportedAssetIds.has(assetId)
  );

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

  // For numbered bulk items during check-in, report which specific units are outstanding
  const missingUnits: Array<{ bulkSkuId: string; unitNumbers: number[] }> = [];

  if (phase === ScanPhase.CHECKIN) {
    for (const bulkItem of booking.bulkItems) {
      if (!bulkItem.bulkSku.trackByNumber) continue;

      const outstanding = bulkItem.unitAllocations
        .filter((a) => a.checkedOutAt && !a.checkedInAt)
        .map((a) => a.bulkSkuUnit.unitNumber)
        .sort((a, b) => a - b);

      if (outstanding.length > 0) {
        missingUnits.push({
          bulkSkuId: bulkItem.bulkSkuId,
          unitNumbers: outstanding
        });
      }
    }
  }

  return {
    booking,
    missingSerialized,
    missingBulk,
    missingUnits
  };
}

export async function completeCheckoutScan(bookingId: string, actorUserId: string, actorRole: Role) {
  return db.$transaction(async (tx) => {
    const state = await buildScanCompletionState(tx, bookingId, ScanPhase.CHECKOUT);

    if (state.booking.status !== BookingStatus.OPEN) {
      throw new HttpError(400, "Checkout must be open");
    }

    const overrideCount = await tx.overrideEvent.count({ where: { bookingId } });
    const override = overrideCount > 0;

    if (!override && (state.missingSerialized.length > 0 || state.missingBulk.length > 0)) {
      throw new HttpError(400, "Scan requirements not met", {
        missingSerialized: state.missingSerialized,
        missingBulk: state.missingBulk
      });
    }

    await tx.scanSession.updateMany({
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

    await createAuditEntry({
      actorId: actorUserId,
      actorRole,
      entityType: "booking",
      entityId: bookingId,
      action: "checkout_scan_completed",
    });

    return {
      success: true,
      missingSerialized: state.missingSerialized,
      missingBulk: state.missingBulk,
      missingUnits: state.missingUnits,
      overrideUsed: override
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function completeCheckinScan(bookingId: string, actorUserId: string, actorRole: Role) {
  // Wrap state validation + session close in a transaction to prevent concurrent completions
  const result = await db.$transaction(async (tx) => {
    const state = await buildScanCompletionState(tx, bookingId, ScanPhase.CHECKIN);
    const overrideCount = await tx.overrideEvent.count({ where: { bookingId } });
    const override = overrideCount > 0;

    if (!override && (state.missingSerialized.length > 0 || state.missingBulk.length > 0)) {
      throw new HttpError(400, "Scan requirements not met", {
        missingSerialized: state.missingSerialized,
        missingBulk: state.missingBulk
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

    return {
      missingSerialized: state.missingSerialized,
      missingBulk: state.missingBulk,
      missingUnits: state.missingUnits,
      overrideUsed: override
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // markCheckoutCompleted runs its own SERIALIZABLE transaction
  await markCheckoutCompleted(bookingId, actorUserId);

  return {
    success: true,
    ...result
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

  await createAuditEntry({
    actorId: args.actorUserId,
    actorRole: args.actorRole,
    entityType: "booking",
    entityId: args.bookingId,
    action: "admin_override",
    after: {
      reason: args.reason,
      details: args.details ?? null,
    },
  });

  return event;
}
