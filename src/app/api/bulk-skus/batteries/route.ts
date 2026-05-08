import { withAuth } from "@/lib/api";
import { getBatteryCompatibilitySummaries } from "@/lib/battery-compatibility";
import { db } from "@/lib/db";
import { cachedOk } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const BATTERY_TERMS = [
  "battery",
  "batteries",
  "np-fz100",
  "npfz100",
  "fz100",
  "bp-u",
  "bpu",
  "lp-e6",
  "lpe6",
  "v-mount",
  "vmount",
  "gold mount",
];

const BATTERY_TERM_PATTERNS = BATTERY_TERMS.map((term) =>
  new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i")
);

function isBatterySku(sku: {
  name: string;
  category: string;
  categoryRel: { name: string } | null;
}) {
  const text = [sku.name, sku.category, sku.categoryRel?.name ?? ""].join(" ").toLowerCase();
  return BATTERY_TERM_PATTERNS.some((pattern) => pattern.test(text));
}

function daysSince(value: Date | null | undefined, now: Date) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "bulk_sku", "adjust");

  const now = new Date();
  const [rawSkus, cameraAssets] = await Promise.all([
    db.bulkSku.findMany({
      where: {
        active: true,
        trackByNumber: true,
      },
      include: {
        location: { select: { id: true, name: true } },
        categoryRel: { select: { id: true, name: true } },
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
  ]);

  const skus = rawSkus.filter(isBatterySku).map((sku) => {
    const units = sku.units.map((unit) => {
      const allocation = unit.allocations[0];
      const booking = allocation?.bookingBulkItem.booking;
      const checkedOutAt = allocation?.checkedOutAt ?? allocation?.createdAt ?? null;

      return {
        id: unit.id,
        unitNumber: unit.unitNumber,
        status: unit.status,
        notes: unit.notes,
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

    const available = units.filter((unit) => unit.status === "AVAILABLE").length;
    const checkedOut = units.filter((unit) => unit.status === "CHECKED_OUT").length;
    const lost = units.filter((unit) => unit.status === "LOST").length;
    const retired = units.filter((unit) => unit.status === "RETIRED").length;
    const threshold = Math.max(10, sku.minThreshold);

    return {
      id: sku.id,
      name: sku.name,
      category: sku.categoryRel?.name ?? sku.category,
      location: sku.location,
      minThreshold: sku.minThreshold,
      threshold,
      binQrCodeValue: sku.binQrCodeValue,
      counts: {
        total: units.length,
        available,
        checkedOut,
        lost,
        retired,
      },
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

  return cachedOk({ data: { totals, skus, compatibility } });
});
