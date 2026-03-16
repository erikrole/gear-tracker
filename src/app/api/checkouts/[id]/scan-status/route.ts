import { ScanPhase, ScanType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

/**
 * GET /api/checkouts/[id]/scan-status?phase=CHECKOUT|CHECKIN
 *
 * Returns the scan progress for a checkout: which serialized items
 * have been scanned and bulk item quantities scanned vs required.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const phase = searchParams.get("phase") as ScanPhase | null;

    if (!phase || !["CHECKOUT", "CHECKIN"].includes(phase)) {
      throw new HttpError(400, "phase query param required (CHECKOUT or CHECKIN)");
    }

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        serializedItems: {
          include: {
            asset: {
              select: {
                id: true,
                assetTag: true,
                brand: true,
                model: true,
                qrCodeValue: true,
                primaryScanCode: true,
              },
            },
          },
        },
        bulkItems: {
          include: {
            bulkSku: {
              select: { id: true, name: true, binQrCodeValue: true, trackByNumber: true },
            },
            unitAllocations: {
              include: {
                bulkSkuUnit: { select: { unitNumber: true, status: true } },
              },
            },
          },
        },
        requester: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });

    if (!booking || booking.kind !== "CHECKOUT") {
      throw new HttpError(404, "Checkout not found");
    }

    // Students can only view scan status for their own checkouts
    if (actor.role === "STUDENT" && booking.requester.id !== actor.id) {
      throw new HttpError(403, "You can only view scan status for your own checkouts");
    }

    // Get successful scan events for this phase
    const scanEvents = await db.scanEvent.findMany({
      where: { bookingId: id, phase, success: true },
      select: { assetId: true, bulkSkuId: true, quantity: true, scanType: true },
    });

    const scannedAssetIds = new Set(
      scanEvents.filter((e) => e.scanType === ScanType.SERIALIZED && e.assetId).map((e) => e.assetId!)
    );

    const bulkScanned = new Map<string, number>();
    for (const e of scanEvents) {
      if (e.scanType === ScanType.BULK_BIN && e.bulkSkuId) {
        bulkScanned.set(e.bulkSkuId, (bulkScanned.get(e.bulkSkuId) ?? 0) + (e.quantity ?? 0));
      }
    }

    // For checkin phase, only show items that are still active (not yet returned)
    const serializedItems = booking.serializedItems
      .filter((item) => phase === "CHECKOUT" || item.allocationStatus === "active")
      .map((item) => ({
        assetId: item.asset.id,
        assetTag: item.asset.assetTag,
        brand: item.asset.brand,
        model: item.asset.model,
        scanned: scannedAssetIds.has(item.asset.id),
      }));

    const bulkItems = booking.bulkItems.map((item) => ({
      bulkSkuId: item.bulkSku.id,
      name: item.bulkSku.name,
      required: item.plannedQuantity,
      scanned: bulkScanned.get(item.bulkSku.id) ?? 0,
      trackByNumber: item.bulkSku.trackByNumber,
      ...(item.bulkSku.trackByNumber ? {
        allocatedUnits: item.unitAllocations.map((a) => ({
          unitNumber: a.bulkSkuUnit.unitNumber,
          checkedOut: !!a.checkedOutAt,
          checkedIn: !!a.checkedInAt,
        })),
      } : {}),
    }));

    const serializedTotal = serializedItems.length;
    const serializedScanned = serializedItems.filter((i) => i.scanned).length;
    const bulkComplete = bulkItems.every((i) => i.scanned >= i.required);
    const allComplete = serializedScanned === serializedTotal && bulkComplete;

    return ok({
      data: {
        checkoutId: id,
        title: booking.title,
        status: booking.status,
        phase,
        requester: booking.requester,
        location: booking.location,
        serializedItems,
        bulkItems,
        progress: {
          serializedScanned,
          serializedTotal,
          bulkComplete,
          allComplete,
        },
      },
    });
  } catch (error) {
    return fail(error);
  }
}
