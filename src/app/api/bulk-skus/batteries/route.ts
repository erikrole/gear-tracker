import { withAuth } from "@/lib/api";
import { getBatteryCompatibilitySummaries } from "@/lib/battery-compatibility";
import { isBatterySku } from "@/lib/bulk-batteries";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { BookingKind, BookingStatus } from "@prisma/client";

function daysSince(value: Date | null | undefined, now: Date) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "bulk_sku", "adjust");

  const now = new Date();
  const [rawSkus, cameraAssets, activeUnitAllocations, openUnitTrackedBulkItems] = await Promise.all([
    db.bulkSku.findMany({
      where: {
        active: true,
      },
      include: {
        location: { select: { id: true, name: true } },
        categoryRel: { select: { id: true, name: true } },
        balances: true,
        units: {
          orderBy: { unitNumber: "asc" },
          include: {
            allocations: {
              where: { checkedInAt: null },
              orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              include: {
                bookingBulkItem: {
                  include: {
                    booking: {
                      select: {
                        id: true,
                        title: true,
                        refNumber: true,
                        endsAt: true,
                        requester: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ locationId: "asc" }, { name: "asc" }],
    }),
    db.asset.findMany({
      where: {
        status: { not: "RETIRED" },
        parentAssetId: null,
      },
      select: {
        brand: true,
        model: true,
        type: true,
        category: { select: { name: true } },
      },
    }),
    db.bookingBulkUnitAllocation.findMany({
      where: {
        checkedOutAt: { not: null },
        checkedInAt: null,
        bookingBulkItem: {
          booking: {
            kind: BookingKind.CHECKOUT,
            status: BookingStatus.OPEN,
          },
        },
      },
      orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
      select: {
        bulkSkuUnitId: true,
        checkedOutAt: true,
        createdAt: true,
        bookingBulkItem: {
          select: {
            booking: {
              select: {
                id: true,
                title: true,
                refNumber: true,
                endsAt: true,
                requester: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.bookingBulkItem.findMany({
      where: {
        bulkSku: {
          active: true,
          trackByNumber: true,
        },
        booking: {
          kind: BookingKind.CHECKOUT,
          status: BookingStatus.OPEN,
        },
      },
      orderBy: [{ booking: { endsAt: "asc" } }, { createdAt: "asc" }],
      select: {
        bulkSkuId: true,
        plannedQuantity: true,
        checkedInQuantity: true,
        unitAllocations: {
          where: { checkedInAt: null },
          select: { id: true },
        },
        booking: {
          select: {
            id: true,
            title: true,
            refNumber: true,
            startsAt: true,
            endsAt: true,
            requester: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const activeAllocationByUnitId = new Map(
    activeUnitAllocations.map((allocation) => [allocation.bulkSkuUnitId, allocation]),
  );
  const fallbackContextsBySkuId = new Map<
    string,
    Array<{
      remaining: number;
      checkedOutAt: Date;
      booking: {
        id: string;
        title: string;
        refNumber: string | null;
        endsAt: Date;
        requester: { name: string };
      };
    }>
  >();
  for (const item of openUnitTrackedBulkItems) {
    const outstanding = Math.max(0, item.plannedQuantity - item.checkedInQuantity - item.unitAllocations.length);
    if (outstanding <= 0) continue;
    const contexts = fallbackContextsBySkuId.get(item.bulkSkuId) ?? [];
    contexts.push({
      remaining: outstanding,
      checkedOutAt: item.booking.startsAt,
      booking: item.booking,
    });
    fallbackContextsBySkuId.set(item.bulkSkuId, contexts);
  }

  const skus = rawSkus.filter(isBatterySku).map((sku) => {
    const fallbackAssignmentsByUnitId = new Map<
      string,
      {
        checkedOutAt: Date;
        booking: {
          id: string;
          title: string;
          refNumber: string | null;
          endsAt: Date;
          requester: { name: string };
        };
      }
    >();
    const fallbackContexts = fallbackContextsBySkuId.get(sku.id) ?? [];
    if (fallbackContexts.length > 0) {
      const orphanCheckedOutUnits = sku.units
        .filter((unit) => unit.status === "CHECKED_OUT" && !activeAllocationByUnitId.has(unit.id) && unit.allocations.length === 0)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      for (const unit of orphanCheckedOutUnits) {
        const context = fallbackContexts.find((candidate) => candidate.remaining > 0);
        if (!context) break;
        fallbackAssignmentsByUnitId.set(unit.id, {
          checkedOutAt: context.checkedOutAt,
          booking: context.booking,
        });
        context.remaining -= 1;
      }
    }

    const units = sku.units.map((unit) => {
      const allocation = activeAllocationByUnitId.get(unit.id) ?? unit.allocations[0];
      const fallback = allocation ? null : fallbackAssignmentsByUnitId.get(unit.id);
      const booking = allocation?.bookingBulkItem.booking ?? fallback?.booking;
      const checkedOutAt = allocation?.checkedOutAt ?? allocation?.createdAt ?? fallback?.checkedOutAt ?? null;

      return {
        id: unit.id,
        unitNumber: unit.unitNumber,
        status: unit.status,
        notes: unit.notes,
        labelPrintedAt: unit.labelPrintedAt?.toISOString() ?? null,
        labelPrintedById: unit.labelPrintedById,
        labelPrintBatchId: unit.labelPrintBatchId,
        checkedOutAt: checkedOutAt?.toISOString() ?? null,
        checkedOutDays: daysSince(checkedOutAt, now),
        booking: booking
          ? {
              id: booking.id,
              title: booking.title,
              refNumber: booking.refNumber,
              endsAt: booking.endsAt.toISOString(),
              requesterName: booking.requester.name,
            }
          : null,
      };
    });

    const onHand = sku.balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0);
    const available = sku.trackByNumber
      ? units.filter((unit) => unit.status === "AVAILABLE").length
      : Math.max(0, onHand);
    const checkedOut = sku.trackByNumber ? units.filter((unit) => unit.status === "CHECKED_OUT").length : 0;
    const lost = sku.trackByNumber ? units.filter((unit) => unit.status === "LOST").length : 0;
    const retired = sku.trackByNumber ? units.filter((unit) => unit.status === "RETIRED").length : 0;
    const total = sku.trackByNumber ? units.length : available;
    const threshold = Math.max(10, sku.minThreshold);
    const labelPrintedCount = sku.trackByNumber
      ? units.filter((unit) => unit.labelPrintedAt !== null).length
      : 0;
    const labelNeededCount = sku.trackByNumber
      ? units.filter((unit) => unit.labelPrintedAt === null && unit.status !== "RETIRED").length
      : 0;

    return {
      id: sku.id,
      name: sku.name,
      category: sku.categoryRel?.name ?? sku.category,
      trackByNumber: sku.trackByNumber,
      location: sku.location,
      minThreshold: sku.minThreshold,
      threshold,
      binQrCodeValue: sku.binQrCodeValue,
      counts: {
        total,
        available,
        checkedOut,
        lost,
        retired,
      },
      labelPrintedCount,
      labelNeededCount,
      isLow: available < threshold,
      units,
    };
  });

  const totals = skus.reduce(
    (acc, sku) => {
      acc.total += sku.counts.total;
      acc.available += sku.counts.available;
      acc.checkedOut += sku.counts.checkedOut;
      acc.lost += sku.counts.lost;
      acc.retired += sku.counts.retired;
      if (sku.isLow) acc.lowSkus += 1;
      acc.agingCheckedOut += sku.units.filter(
        (unit) => unit.status === "CHECKED_OUT" && (unit.checkedOutDays ?? 0) >= 7,
      ).length;
      return acc;
    },
    { total: 0, available: 0, checkedOut: 0, lost: 0, retired: 0, lowSkus: 0, agingCheckedOut: 0 },
  );

  const compatibility = getBatteryCompatibilitySummaries({
    cameraAssets: cameraAssets.map((asset) => ({
      brand: asset.brand,
      model: asset.model,
      type: asset.type,
      categoryName: asset.category?.name ?? null,
    })),
    bulkSkus: skus.map((sku) => ({
      id: sku.id,
      name: sku.name,
      category: sku.category,
      availableQuantity: sku.counts.available,
      minThreshold: sku.minThreshold,
    })),
  })
    .filter((summary) => summary.isLow)
    .sort((a, b) => (a.availableQuantity - a.threshold) - (b.availableQuantity - b.threshold));

  return ok({ data: { totals, skus, compatibility } });
});
