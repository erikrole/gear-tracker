import { BookingStatus, Prisma } from "@prisma/client";
import { isBatterySku } from "@/lib/bulk-batteries";
import { db } from "@/lib/db";
import { summarizeItemFamilyState } from "@/lib/item-family-state";
import { countAssetsByEffectiveStatus, deriveAssetStatusesFromLoaded } from "@/lib/services/status";

const AUDIT_REPORT_EXPORT_LIMIT = 5000;
const CHECKOUT_REPORT_EXPORT_LIMIT = 5000;
const OVERDUE_REPORT_EXPORT_LIMIT = 5000;
const SCAN_REPORT_EXPORT_LIMIT = 5000;
const BULK_LOSS_REPORT_EXPORT_LIMIT = 5000;
const UTILIZATION_REPORT_EXPORT_LIMIT = 5000;
const CHECKOUT_CUSTODY_REPORT_STATUSES = [BookingStatus.OPEN, BookingStatus.COMPLETED] as const;

export async function getUtilizationReport() {
  const results = await Promise.allSettled([
    countAssetsByEffectiveStatus(),
    db.asset.count(),
    db.asset.groupBy({ by: ["locationId"], _count: true }),
    db.asset.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } }),
    db.asset.groupBy({ by: ["departmentId"], _count: true })
  ]);

  const statusCounts = results[0].status === "fulfilled" ? results[0].value : {};
  const totalAssets = results[1].status === "fulfilled" ? results[1].value : 0;
  const byLocation = results[2].status === "fulfilled" ? results[2].value : [];
  const byType = results[3].status === "fulfilled" ? results[3].value : [];
  const byDepartment = results[4].status === "fulfilled" ? results[4].value : [];

  const locationIds = byLocation.map((g) => g.locationId);
  const locations =
    locationIds.length > 0
      ? await db.location.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, name: true }
        })
      : [];
  const locMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  const deptIds = byDepartment
    .map((g) => g.departmentId)
    .filter((id): id is string => id !== null);
  const departments =
    deptIds.length > 0
      ? await db.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true }
        })
      : [];
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  return {
    totalAssets,
    statusCounts,
    byLocation: byLocation.map((g) => ({
      location: locMap[g.locationId] || "Unknown",
      count: g._count
    })),
    byType: byType.map((g) => ({ type: g.type, count: g._count })),
    byDepartment: byDepartment
      .filter((g) => g.departmentId)
      .map((g) => ({
        department: deptMap[g.departmentId!] || "Unknown",
        count: g._count
      }))
  };
}

const utilizationReportExportAssetSelect = {
  id: true,
  assetTag: true,
  name: true,
  type: true,
  brand: true,
  model: true,
  status: true,
  availableForReservation: true,
  availableForCheckout: true,
  availableForCustody: true,
  updatedAt: true,
  location: { select: { name: true } },
  department: { select: { name: true } },
  category: { select: { name: true } },
} satisfies Prisma.AssetSelect;

type UtilizationReportExportAsset = Prisma.AssetGetPayload<{
  select: typeof utilizationReportExportAssetSelect;
}>;

function mapUtilizationReportExportAsset(
  asset: UtilizationReportExportAsset,
  computedStatus: string,
) {
  return {
    assetTag: asset.assetTag,
    name: asset.name ?? "",
    type: asset.type,
    brand: asset.brand,
    model: asset.model,
    computedStatus,
    storedStatus: asset.status,
    location: asset.location.name,
    department: asset.department?.name ?? "",
    category: asset.category?.name ?? "",
    availableForReservation: asset.availableForReservation,
    availableForCheckout: asset.availableForCheckout,
    availableForCustody: asset.availableForCustody,
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export async function getUtilizationReportExport() {
  const [assets, total] = await Promise.all([
    db.asset.findMany({
      orderBy: { assetTag: "asc" },
      take: UTILIZATION_REPORT_EXPORT_LIMIT,
      select: utilizationReportExportAssetSelect,
    }),
    db.asset.count(),
  ]);
  const statusMap = await deriveAssetStatusesFromLoaded(assets);

  return {
    data: assets.map((asset) =>
      mapUtilizationReportExportAsset(
        asset,
        statusMap.get(asset.id) ?? "AVAILABLE",
      ),
    ),
    total,
    truncated: total > UTILIZATION_REPORT_EXPORT_LIMIT,
    limit: UTILIZATION_REPORT_EXPORT_LIMIT,
  };
}

export async function getCheckoutReport(days: number) {
  const since = checkoutReportSince(days);
  const now = new Date();
  const heatmapSince = new Date(Date.now() - 365 * 86_400_000);
  const checkoutActivityWhere = buildCheckoutReportWhere(days);

  const checkoutResults = await Promise.allSettled([
    db.booking.count({
      where: checkoutActivityWhere
    }),
    db.booking.count({
      where: {
        kind: "CHECKOUT",
        status: "OPEN",
        endsAt: { lt: now }
      }
    }),
    db.booking.findMany({
      where: checkoutActivityWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: checkoutReportInclude,
    }),
    db.booking.groupBy({
      by: ["requesterUserId"],
      where: checkoutActivityWhere,
      _count: true,
      orderBy: { _count: { requesterUserId: "desc" } },
      take: 10
    }),
    // Single 365-day daily aggregation (period series is sliced in JS).
    // Using date_trunc keeps the work in Postgres regardless of row count.
    db.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
             COUNT(*)::bigint AS count
      FROM bookings
      WHERE kind = 'CHECKOUT'
        AND "status" IN ('OPEN', 'COMPLETED')
        AND "created_at" >= ${heatmapSince}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const totalCheckouts = checkoutResults[0].status === "fulfilled" ? checkoutResults[0].value : 0;
  const overdueCheckouts = checkoutResults[1].status === "fulfilled" ? checkoutResults[1].value : 0;
  const recentCheckouts = checkoutResults[2].status === "fulfilled" ? checkoutResults[2].value : [];
  const topRequesters = checkoutResults[3].status === "fulfilled" ? checkoutResults[3].value : [];
  const heatmapRaw = checkoutResults[4].status === "fulfilled" ? checkoutResults[4].value : [];

  const requesterIds = topRequesters.map((r) => r.requesterUserId);
  const users =
    requesterIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, name: true }
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Build day → count map from the 365-day aggregate, then derive both series.
  const dayMap = new Map<string, number>();
  for (const row of heatmapRaw) dayMap.set(row.date, Number(row.count));

  const sinceKey = since.toISOString().slice(0, 10);
  const dailyTrend: { date: string; count: number }[] = [];
  const cursor = new Date(since);
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10);
    if (key >= sinceKey) {
      dailyTrend.push({ date: key, count: dayMap.get(key) ?? 0 });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const heatmap = Array.from(dayMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    totalCheckouts,
    overdueCheckouts,
    dailyTrend,
    heatmap,
    recentCheckouts: recentCheckouts.map((checkout) => mapCheckoutReportEntry(checkout, now)),
    topRequesters: topRequesters.map((r) => ({
      name: userMap[r.requesterUserId] || "Unknown",
      count: r._count
    }))
  };
}

function checkoutReportSince(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function buildCheckoutReportWhere(days: number): Prisma.BookingWhereInput {
  return {
    kind: "CHECKOUT",
    status: { in: [...CHECKOUT_CUSTODY_REPORT_STATUSES] },
    createdAt: { gte: checkoutReportSince(days) },
  };
}

const checkoutReportInclude = {
  requester: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  _count: { select: { serializedItems: true, bulkItems: true } },
} satisfies Prisma.BookingInclude;

function mapCheckoutReportEntry(checkout: Prisma.BookingGetPayload<{
  include: typeof checkoutReportInclude;
}>, now: Date) {
  return {
    id: checkout.id,
    title: checkout.title,
    status: checkout.status,
    startsAt: checkout.startsAt,
    endsAt: checkout.endsAt,
    createdAt: checkout.createdAt,
    requester: checkout.requester.name,
    location: checkout.location.name,
    itemCount: checkout._count.serializedItems + checkout._count.bulkItems,
    isOverdue: checkout.status === "OPEN" && checkout.endsAt < now,
  };
}

export async function getCheckoutReportExport(days: number) {
  const where = buildCheckoutReportWhere(days);
  const now = new Date();
  const [data, total] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: CHECKOUT_REPORT_EXPORT_LIMIT,
      include: checkoutReportInclude,
    }),
    db.booking.count({ where }),
  ]);

  return {
    data: data.map((checkout) => mapCheckoutReportEntry(checkout, now)),
    total,
    truncated: total > CHECKOUT_REPORT_EXPORT_LIMIT,
    limit: CHECKOUT_REPORT_EXPORT_LIMIT,
  };
}

export async function getOverdueReport() {
  const now = new Date();

  const overdueBookings = await db.booking.findMany({
    where: buildOverdueReportWhere(now),
    include: overdueReportInclude,
    orderBy: { endsAt: "asc" },
  });

  const byRequester = new Map<
    string,
    {
      userId: string;
      name: string;
      overdueCount: number;
      totalOverdueHours: number;
      bookings: {
        id: string;
        title: string;
        endsAt: string;
        overdueHours: number;
        location: string;
        itemCount: number;
        items: string[];
      }[];
    }
  >();

  for (const b of overdueBookings) {
    const existing = byRequester.get(b.requester.id);
    const booking = mapOverdueReportBooking(b, now, 5);

    if (existing) {
      existing.overdueCount++;
      existing.totalOverdueHours += booking.overdueHours;
      existing.bookings.push(booking);
    } else {
      byRequester.set(b.requester.id, {
        userId: b.requester.id,
        name: b.requester.name,
        overdueCount: 1,
        totalOverdueHours: booking.overdueHours,
        bookings: [booking],
      });
    }
  }

  const leaderboard = Array.from(byRequester.values()).sort(
    (a, b) => b.totalOverdueHours - a.totalOverdueHours
  );

  return {
    totalOverdueBookings: overdueBookings.length,
    leaderboard,
  };
}

function buildOverdueReportWhere(now: Date): Prisma.BookingWhereInput {
  return {
    kind: "CHECKOUT",
    status: "OPEN",
    endsAt: { lt: now },
  };
}

const overdueReportInclude = {
  requester: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  serializedItems: {
    where: { allocationStatus: "active" },
    include: { asset: { select: { id: true, assetTag: true, name: true } } },
  },
  bulkItems: {
    include: { bulkSku: { select: { id: true, name: true } } },
  },
} satisfies Prisma.BookingInclude;

type OverdueReportBooking = Prisma.BookingGetPayload<{
  include: typeof overdueReportInclude;
}>;

function getOverdueOutstandingItems(booking: OverdueReportBooking) {
  const items: string[] = [];
  for (const si of booking.serializedItems) {
    items.push(si.asset.assetTag || si.asset.name || "Unknown item");
  }

  let itemCount = booking.serializedItems.length;
  for (const bi of booking.bulkItems) {
    const checkedOutQuantity = bi.checkedOutQuantity > 0
      ? bi.checkedOutQuantity
      : bi.plannedQuantity;
    const outstandingQuantity = Math.max(0, checkedOutQuantity - bi.checkedInQuantity);
    if (outstandingQuantity > 0) {
      itemCount += outstandingQuantity;
      items.push(`${bi.bulkSku.name} x${outstandingQuantity}`);
    }
  }

  return { itemCount, items };
}

function mapOverdueReportBooking(
  booking: OverdueReportBooking,
  now: Date,
  itemLimit?: number,
) {
  const hours = Math.round((now.getTime() - booking.endsAt.getTime()) / 3_600_000);
  const outstanding = getOverdueOutstandingItems(booking);

  return {
    id: booking.id,
    title: booking.title,
    endsAt: booking.endsAt.toISOString(),
    overdueHours: hours,
    location: booking.location.name,
    itemCount: outstanding.itemCount,
    items: typeof itemLimit === "number" ? outstanding.items.slice(0, itemLimit) : outstanding.items,
  };
}

export async function getOverdueReportExport() {
  const now = new Date();
  const where = buildOverdueReportWhere(now);
  const [bookings, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: overdueReportInclude,
      orderBy: { endsAt: "asc" },
      take: OVERDUE_REPORT_EXPORT_LIMIT,
    }),
    db.booking.count({ where }),
  ]);

  return {
    data: bookings.map((booking) => {
      const row = mapOverdueReportBooking(booking, now);
      return {
        bookingId: booking.id,
        requester: booking.requester.name,
        title: row.title,
        endsAt: row.endsAt,
        overdueHours: row.overdueHours,
        location: row.location,
        itemCount: row.itemCount,
        itemSummary: row.items.join("; "),
      };
    }),
    total,
    truncated: total > OVERDUE_REPORT_EXPORT_LIMIT,
    limit: OVERDUE_REPORT_EXPORT_LIMIT,
  };
}

export async function getScanHistoryReport(
  limit: number,
  offset: number,
  startDate?: string | null,
  endDate?: string | null,
  phase?: string | null,
) {
  const where = buildScanHistoryWhere({ startDate, endDate, phase });
  const whereSql = buildScanHistoryWhereSql({ startDate, endDate, phase });

  const scanResults = await Promise.allSettled([
    db.scanEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: scanReportInclude,
    }),
    db.scanEvent.count({ where }),
    db.scanEvent.count({ where: { ...where, success: true } }),
    db.$queryRaw<{ date: string; success: bigint; fail: bigint }[]>`
      SELECT to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
             COUNT(*) FILTER (WHERE success = true)::bigint AS success,
             COUNT(*) FILTER (WHERE success = false)::bigint AS fail
      FROM scan_events
      ${whereSql}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const data = scanResults[0].status === "fulfilled" ? scanResults[0].value : [];
  const total = scanResults[1].status === "fulfilled" ? scanResults[1].value : 0;
  const successCount = scanResults[2].status === "fulfilled" ? scanResults[2].value : 0;
  const dailyRaw = scanResults[3].status === "fulfilled" ? scanResults[3].value : [];

  const dailyScans = dailyRaw.map((r) => ({
    date: r.date,
    success: Number(r.success),
    fail: Number(r.fail),
  }));

  return {
    data: data.map(mapScanReportEntry),
    total,
    successCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
    dailyScans,
    limit,
    offset,
  };
}

type ScanHistoryFilters = {
  startDate?: string | null;
  endDate?: string | null;
  phase?: string | null;
};

const scanReportInclude = {
  actor: { select: { id: true, name: true, avatarUrl: true } },
  asset: { select: { id: true, assetTag: true, name: true } },
  bulkSku: { select: { id: true, name: true } },
  booking: { select: { id: true, title: true } },
} satisfies Prisma.ScanEventInclude;

function buildScanHistoryWhere({
  endDate,
  phase,
  startDate,
}: ScanHistoryFilters) {
  const where: Prisma.ScanEventWhereInput = {};
  const dateFilter: Prisma.DateTimeFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
  if (phase === "CHECKOUT" || phase === "CHECKIN") where.phase = phase;

  return where;
}

function buildScanHistoryWhereSql({
  endDate,
  phase,
  startDate,
}: ScanHistoryFilters) {
  // Build SQL fragments mirroring the Prisma where for the raw aggregation.
  const conditions: Prisma.Sql[] = [];
  if (startDate) conditions.push(Prisma.sql`"created_at" >= ${new Date(startDate)}`);
  if (endDate) conditions.push(Prisma.sql`"created_at" <= ${new Date(endDate)}`);
  if (phase === "CHECKOUT" || phase === "CHECKIN") {
    conditions.push(Prisma.sql`phase::text = ${phase}`);
  }
  const whereSql = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  return whereSql;
}

function mapScanReportEntry(scan: Prisma.ScanEventGetPayload<{
  include: typeof scanReportInclude;
}>) {
  return {
    id: scan.id,
    actor: scan.actor.name,
    scanType: scan.scanType,
    scanValue: scan.scanValue,
    success: scan.success,
    phase: scan.phase,
    item: scan.asset
      ? scan.asset.assetTag || scan.asset.name
      : scan.bulkSku
        ? scan.bulkSku.name
        : scan.scanValue,
    bookingId: scan.booking.id,
    bookingTitle: scan.booking.title,
    createdAt: scan.createdAt,
  };
}

export async function getScanHistoryReportExport(
  startDate?: string | null,
  endDate?: string | null,
  phase?: string | null,
) {
  const where = buildScanHistoryWhere({ startDate, endDate, phase });
  const [data, total] = await Promise.all([
    db.scanEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: SCAN_REPORT_EXPORT_LIMIT,
      include: scanReportInclude,
    }),
    db.scanEvent.count({ where }),
  ]);

  return {
    data: data.map(mapScanReportEntry),
    total,
    truncated: total > SCAN_REPORT_EXPORT_LIMIT,
    limit: SCAN_REPORT_EXPORT_LIMIT,
  };
}

type AuditReportFilters = {
  startDate?: string | null,
  endDate?: string | null,
  action?: string | null,
};

function buildAuditReportWhere({
  action,
  endDate,
  startDate,
}: AuditReportFilters) {
  const where: Prisma.AuditLogWhereInput = {};
  const dateFilter: Prisma.DateTimeFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
  if (action) where.action = action;

  return where;
}

function mapAuditReportEntry(entry: Prisma.AuditLogGetPayload<{
  include: { actor: { select: { id: true; name: true; avatarUrl: true } } };
}>) {
  return {
    id: entry.id,
    actor: entry.actor?.name || "System",
    actorId: entry.actor?.id ?? null,
    actorAvatarUrl: entry.actor?.avatarUrl ?? null,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    createdAt: entry.createdAt,
    beforeJson: entry.beforeJson,
    afterJson: entry.afterJson,
  };
}

export async function getAuditReport(
  limit: number,
  offset: number,
  startDate?: string | null,
  endDate?: string | null,
  action?: string | null,
) {
  const where = buildAuditReportWhere({ startDate, endDate, action });

  const auditResults = await Promise.allSettled([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } }
      }
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
      orderBy: { _count: { action: "desc" } },
      take: 15,
    }),
    db.auditLog.groupBy({
      by: ["entityType"],
      where,
      _count: true,
      orderBy: { _count: { entityType: "desc" } },
      take: 10,
    }),
  ]);

  const data = auditResults[0].status === "fulfilled" ? auditResults[0].value : [];
  const total = auditResults[1].status === "fulfilled" ? auditResults[1].value : 0;
  const byAction = auditResults[2].status === "fulfilled"
    ? auditResults[2].value.map((g) => ({ action: g.action, count: g._count }))
    : [];
  const byEntityType = auditResults[3].status === "fulfilled"
    ? auditResults[3].value.map((g) => ({ entityType: g.entityType, count: g._count }))
    : [];

  return {
    data: data.map(mapAuditReportEntry),
    total,
    byAction,
    byEntityType,
    limit,
    offset
  };
}

export async function getAuditReportExport(
  startDate?: string | null,
  endDate?: string | null,
  action?: string | null,
) {
  const where = buildAuditReportWhere({ startDate, endDate, action });
  const [data, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: AUDIT_REPORT_EXPORT_LIMIT,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    data: data.map(mapAuditReportEntry),
    total,
    truncated: total > AUDIT_REPORT_EXPORT_LIMIT,
    limit: AUDIT_REPORT_EXPORT_LIMIT,
  };
}

/**
 * Bulk loss report: lost units grouped by SKU and by last requester.
 */
function daysBetween(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end) return null;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

async function getBatteryAuditReport() {
  const now = new Date();
  const [batterySkuResult, allocationHistoryResult] = await Promise.allSettled([
    db.bulkSku.findMany({
      where: {
        active: true,
        trackByNumber: true,
      },
      select: {
        id: true,
        name: true,
        category: true,
        categoryRel: { select: { name: true } },
        location: { select: { id: true, name: true } },
        units: {
          orderBy: { unitNumber: "asc" },
          select: {
            id: true,
            unitNumber: true,
            status: true,
            notes: true,
            updatedAt: true,
            allocations: {
              orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                checkedOutAt: true,
                checkedInAt: true,
                createdAt: true,
                bookingBulkItem: {
                  select: {
                    booking: {
                      select: {
                        id: true,
                        refNumber: true,
                        title: true,
                        requester: { select: { id: true, name: true } },
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
    db.bookingBulkUnitAllocation.findMany({
      where: {
        checkedOutAt: { not: null },
        bulkSkuUnit: {
          bulkSku: {
            active: true,
            trackByNumber: true,
          },
        },
      },
      orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        checkedOutAt: true,
        checkedInAt: true,
        createdAt: true,
        bulkSkuUnit: {
          select: {
            id: true,
            unitNumber: true,
            status: true,
            bulkSku: {
              select: {
                id: true,
                name: true,
                category: true,
                categoryRel: { select: { name: true } },
              },
            },
          },
        },
        bookingBulkItem: {
          select: {
            booking: {
              select: {
                id: true,
                refNumber: true,
                title: true,
                requester: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const batterySkus = batterySkuResult.status === "fulfilled"
    ? batterySkuResult.value.filter(isBatterySku)
    : [];
  const batterySkuIds = new Set(batterySkus.map((sku) => sku.id));
  const bySku = batterySkus.map((sku) => {
    const activeAllocationByUnitId = new Map(
      sku.units.flatMap((unit) =>
        unit.allocations
          .filter((allocation) => allocation.checkedOutAt && !allocation.checkedInAt)
          .map((allocation) => [unit.id, allocation] as const)
      ),
    );
    const state = summarizeItemFamilyState({ ...sku, trackByNumber: true, balances: [] }, activeAllocationByUnitId);
    const total = state.onHandQuantity;
    const available = state.availableQuantity;
    const checkedOut = state.checkedOutQuantity;
    const lost = sku.units.filter((unit) => unit.status === "LOST").length;
    const retired = sku.units.filter((unit) => unit.status === "RETIRED").length;
    const missingUnits = sku.units.filter((unit) => unit.status === "LOST");
    const lastMissingAt = missingUnits
      .map((unit) => unit.updatedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      bulkSkuId: sku.id,
      skuName: sku.name,
      category: sku.categoryRel?.name ?? sku.category,
      location: sku.location.name,
      total,
      available,
      checkedOut,
      lost,
      retired,
      lossRate: total > 0 ? lost / total : 0,
      missingUnitNumbers: missingUnits.map((unit) => unit.unitNumber),
      lastMissingAt: lastMissingAt?.toISOString() ?? null,
    };
  }).sort((a, b) => b.lost - a.lost || b.lossRate - a.lossRate || a.skuName.localeCompare(b.skuName));

  const missingUnits = batterySkus.flatMap((sku) =>
    sku.units
      .filter((unit) => unit.status === "LOST")
      .map((unit) => {
        const allocation = unit.allocations[0];
        const booking = allocation?.bookingBulkItem.booking;
        return {
          id: unit.id,
          bulkSkuId: sku.id,
          skuName: sku.name,
          unitNumber: unit.unitNumber,
          notes: unit.notes,
          markedMissingAt: unit.updatedAt.toISOString(),
          lastCheckoutAt: allocation?.checkedOutAt?.toISOString() ?? allocation?.createdAt?.toISOString() ?? null,
          lastRequesterId: booking?.requester.id ?? null,
          lastRequesterName: booking?.requester.name ?? null,
          lastBookingId: booking?.id ?? null,
          lastBookingRef: booking?.refNumber ?? null,
          lastBookingTitle: booking?.title ?? null,
        };
      }),
  ).sort((a, b) => b.markedMissingAt.localeCompare(a.markedMissingAt));

  const requesterLossCounts = new Map<string, { requesterId: string; requesterName: string; lost: number }>();
  for (const unit of missingUnits) {
    if (!unit.lastRequesterId || !unit.lastRequesterName) continue;
    const existing = requesterLossCounts.get(unit.lastRequesterId);
    if (existing) {
      existing.lost++;
    } else {
      requesterLossCounts.set(unit.lastRequesterId, {
        requesterId: unit.lastRequesterId,
        requesterName: unit.lastRequesterName,
        lost: 1,
      });
    }
  }

  const repeatPatterns = [
    ...bySku
      .filter((sku) => sku.lost >= 2)
      .map((sku) => ({
        type: "sku" as const,
        label: sku.skuName,
        count: sku.lost,
        detail: `${sku.missingUnitNumbers.length} missing units`,
      })),
    ...Array.from(requesterLossCounts.values())
      .filter((requester) => requester.lost >= 2)
      .map((requester) => ({
        type: "requester" as const,
        label: requester.requesterName,
        count: requester.lost,
        detail: "Last holder on missing units",
      })),
  ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const rawHistory = allocationHistoryResult.status === "fulfilled" ? allocationHistoryResult.value : [];
  const checkoutHistory = rawHistory
    .filter((allocation) => batterySkuIds.has(allocation.bulkSkuUnit.bulkSku.id))
    .map((allocation) => {
      const checkedOutAt = allocation.checkedOutAt ?? allocation.createdAt;
      const checkedInAt = allocation.checkedInAt ?? null;
      const booking = allocation.bookingBulkItem.booking;

      return {
        id: allocation.id,
        bulkSkuUnitId: allocation.bulkSkuUnit.id,
        bulkSkuId: allocation.bulkSkuUnit.bulkSku.id,
        skuName: allocation.bulkSkuUnit.bulkSku.name,
        unitNumber: allocation.bulkSkuUnit.unitNumber,
        status: allocation.bulkSkuUnit.status,
        checkedOutAt: checkedOutAt.toISOString(),
        checkedInAt: checkedInAt?.toISOString() ?? null,
        durationDays: daysBetween(checkedOutAt, checkedInAt ?? now),
        bookingId: booking.id,
        bookingRef: booking.refNumber,
        bookingTitle: booking.title,
        requesterId: booking.requester.id,
        requesterName: booking.requester.name,
      };
    })
    .slice(0, 50);

  const totals = bySku.reduce(
    (acc, sku) => {
      acc.totalUnits += sku.total;
      acc.available += sku.available;
      acc.checkedOut += sku.checkedOut;
      acc.lost += sku.lost;
      acc.retired += sku.retired;
      return acc;
    },
    { skuCount: bySku.length, totalUnits: 0, available: 0, checkedOut: 0, lost: 0, retired: 0 },
  );

  return {
    totals: {
      ...totals,
      lossRate: totals.totalUnits > 0 ? totals.lost / totals.totalUnits : 0,
      repeatPatternCount: repeatPatterns.length,
    },
    bySku,
    missingUnits,
    checkoutHistory,
    repeatPatterns,
  };
}

export async function getBulkLossReport() {
  const [lostBySkuResult, lostByUserResult, recentLossesResult, batteryAuditResult] = await Promise.allSettled([
    db.bulkSkuUnit.groupBy({
      by: ["bulkSkuId"],
      where: { status: "LOST" },
      _count: { id: true },
    }),
    db.bulkSkuUnit.findMany({
      where: { status: "LOST" },
      select: {
        id: true,
        unitNumber: true,
        notes: true,
        updatedAt: true,
        bulkSku: { select: { id: true, name: true } },
        allocations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            bookingBulkItem: {
              select: {
                booking: {
                  select: {
                    id: true,
                    refNumber: true,
                    title: true,
                    requester: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.auditLog.findMany({
      where: { action: "bulk_units_auto_lost" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        entityId: true,
        afterJson: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    getBatteryAuditReport(),
  ]);

  const lostBySku = lostBySkuResult.status === "fulfilled" ? lostBySkuResult.value : [];
  const skuIds = lostBySku.map((r) => r.bulkSkuId);
  const skuNames = skuIds.length > 0
    ? await db.bulkSku.findMany({ where: { id: { in: skuIds } }, select: { id: true, name: true } })
    : [];
  const skuNameMap = new Map(skuNames.map((s) => [s.id, s.name]));

  const bySkuSummary = lostBySku.map((r) => ({
    skuName: skuNameMap.get(r.bulkSkuId) ?? "Unknown",
    bulkSkuId: r.bulkSkuId,
    count: r._count.id,
  })).sort((a, b) => b.count - a.count);

  const lostUnits = lostByUserResult.status === "fulfilled" ? lostByUserResult.value : [];
  const userLossCounts = new Map<string, { name: string; count: number }>();
  for (const unit of lostUnits) {
    const alloc = unit.allocations[0];
    const requester = alloc?.bookingBulkItem?.booking?.requester;
    if (!requester) continue;
    const existing = userLossCounts.get(requester.id);
    if (existing) {
      existing.count++;
    } else {
      userLossCounts.set(requester.id, { name: requester.name, count: 1 });
    }
  }
  const byUserLeaderboard = Array.from(userLossCounts.values())
    .sort((a, b) => b.count - a.count);

  const totalLost = lostBySku.reduce((sum, r) => sum + r._count.id, 0);

  const recentLosses = recentLossesResult.status === "fulfilled"
    ? recentLossesResult.value.map((log) => ({
        id: log.id,
        bookingId: log.entityId,
        lostUnits: log.afterJson as unknown,
        createdAt: log.createdAt.toISOString(),
        actor: log.actor,
      }))
    : [];

  return {
    totalLost,
    bySku: bySkuSummary,
    byUser: byUserLeaderboard,
    recentLosses,
    batteryAudit: batteryAuditResult.status === "fulfilled"
      ? batteryAuditResult.value
      : {
          totals: {
            skuCount: 0,
            totalUnits: 0,
            available: 0,
            checkedOut: 0,
            lost: 0,
            retired: 0,
            lossRate: 0,
            repeatPatternCount: 0,
          },
          bySku: [],
          missingUnits: [],
          checkoutHistory: [],
          repeatPatterns: [],
        },
  };
}

type BulkLossReportData = Awaited<ReturnType<typeof getBulkLossReport>>;

type BulkLossReportExportRow = {
  section: string;
  itemFamily: string;
  category: string;
  location: string;
  unitNumber: number | string;
  person: string;
  booking: string;
  timestamp: string;
  count: number | string;
  status: string;
  detail: string;
  notes: string;
};

function bookingExportLabel({
  id,
  ref,
  title,
}: {
  id?: string | null;
  ref?: string | null;
  title?: string | null;
}) {
  return ref ?? title ?? id ?? "";
}

function jsonExportDetail(value: unknown) {
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildBulkLossReportExportRows(report: BulkLossReportData): BulkLossReportExportRow[] {
  const rows: BulkLossReportExportRow[] = [];

  for (const sku of report.bySku) {
    rows.push({
      section: "Missing units by family",
      itemFamily: sku.skuName,
      category: "",
      location: "",
      unitNumber: "",
      person: "",
      booking: "",
      timestamp: "",
      count: sku.count,
      status: "LOST",
      detail: "Current missing numbered units by family",
      notes: "",
    });
  }

  for (const user of report.byUser) {
    rows.push({
      section: "Missing units by requester",
      itemFamily: "",
      category: "",
      location: "",
      unitNumber: "",
      person: user.name,
      booking: "",
      timestamp: "",
      count: user.count,
      status: "LOST",
      detail: "Last requester attributed from unit allocation history",
      notes: "",
    });
  }

  for (const event of report.recentLosses) {
    rows.push({
      section: "Recent missing-unit events",
      itemFamily: "",
      category: "",
      location: "",
      unitNumber: "",
      person: event.actor?.name ?? "System",
      booking: event.bookingId,
      timestamp: event.createdAt,
      count: "",
      status: "",
      detail: "Check-in completed with missing units",
      notes: jsonExportDetail(event.lostUnits),
    });
  }

  for (const sku of report.batteryAudit.bySku) {
    rows.push({
      section: "Battery family summary",
      itemFamily: sku.skuName,
      category: sku.category,
      location: sku.location,
      unitNumber: "",
      person: "",
      booking: "",
      timestamp: sku.lastMissingAt ?? "",
      count: sku.lost,
      status: `${sku.available} available; ${sku.checkedOut} checked out; ${sku.retired} retired; ${sku.total} total`,
      detail: sku.missingUnitNumbers.length > 0
        ? `Missing units: ${sku.missingUnitNumbers.join(", ")}`
        : "No missing units",
      notes: "",
    });
  }

  for (const unit of report.batteryAudit.missingUnits) {
    rows.push({
      section: "Battery missing units",
      itemFamily: unit.skuName,
      category: "",
      location: "",
      unitNumber: unit.unitNumber,
      person: unit.lastRequesterName ?? "Unknown",
      booking: bookingExportLabel({
        id: unit.lastBookingId,
        ref: unit.lastBookingRef,
        title: unit.lastBookingTitle,
      }),
      timestamp: unit.markedMissingAt,
      count: 1,
      status: "LOST",
      detail: unit.lastCheckoutAt ? `Last checkout ${unit.lastCheckoutAt}` : "",
      notes: unit.notes ?? "",
    });
  }

  for (const entry of report.batteryAudit.checkoutHistory) {
    rows.push({
      section: "Battery checkout history",
      itemFamily: entry.skuName,
      category: "",
      location: "",
      unitNumber: entry.unitNumber,
      person: entry.requesterName,
      booking: bookingExportLabel({
        id: entry.bookingId,
        ref: entry.bookingRef,
        title: entry.bookingTitle,
      }),
      timestamp: entry.checkedOutAt,
      count: entry.durationDays ?? "",
      status: entry.checkedInAt ? `Returned ${entry.checkedInAt}` : "Still out",
      detail: `Unit status: ${entry.status}`,
      notes: "",
    });
  }

  for (const pattern of report.batteryAudit.repeatPatterns) {
    rows.push({
      section: "Battery repeat missing patterns",
      itemFamily: pattern.type === "sku" ? pattern.label : "",
      category: "",
      location: "",
      unitNumber: "",
      person: pattern.type === "requester" ? pattern.label : "",
      booking: "",
      timestamp: "",
      count: pattern.count,
      status: pattern.type,
      detail: pattern.detail,
      notes: "",
    });
  }

  return rows;
}

export async function getBulkLossReportExport() {
  const report = await getBulkLossReport();
  const rows = buildBulkLossReportExportRows(report);

  return {
    data: rows.slice(0, BULK_LOSS_REPORT_EXPORT_LIMIT),
    total: rows.length,
    truncated: rows.length > BULK_LOSS_REPORT_EXPORT_LIMIT,
    limit: BULK_LOSS_REPORT_EXPORT_LIMIT,
  };
}

export async function getBadgeReport() {
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [
    totalAwards,
    manualAwards,
    recentAwardCount,
    activeDefinitions,
    leaderboard,
    distribution,
    recentAwards,
  ] = await Promise.all([
    db.studentBadge.count(),
    db.studentBadge.count({ where: { source: "MANUAL" } }),
    db.studentBadge.count({ where: { awardedAt: { gte: since } } }),
    db.badgeDefinition.findMany({
      where: { active: true },
      select: { id: true, key: true, name: true, category: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.studentBadge.groupBy({
      by: ["userId"],
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    }),
    db.studentBadge.groupBy({
      by: ["definitionId"],
      _count: true,
      orderBy: { _count: { definitionId: "desc" } },
      take: 12,
    }),
    db.studentBadge.findMany({
      orderBy: { awardedAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true, email: true } },
        definition: {
          select: {
            id: true,
            key: true,
            name: true,
            category: true,
            icon: true,
            active: true,
          },
        },
        awardedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const userIds = leaderboard.map((row) => row.userId);
  const definitionIds = distribution.map((row) => row.definitionId);
  const [users, definitions] = await Promise.all([
    userIds.length > 0
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [],
    definitionIds.length > 0
      ? db.badgeDefinition.findMany({
          where: { id: { in: definitionIds } },
          select: { id: true, key: true, name: true, category: true, active: true },
        })
      : [],
  ]);
  const userMap = Object.fromEntries(users.map((user) => [user.id, user]));
  const definitionMap = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));
  const distributionCountMap = new Map(distribution.map((row) => [row.definitionId, row._count]));
  const underusedDefinitions = activeDefinitions
    .map((definition) => ({
      definitionId: definition.id,
      key: definition.key,
      name: definition.name,
      category: definition.category,
      count: distributionCountMap.get(definition.id) ?? 0,
    }))
    .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name))
    .slice(0, 8);

  return {
    totalAwards,
    manualAwards,
    automaticAwards: totalAwards - manualAwards,
    manualAwardRate: totalAwards > 0 ? manualAwards / totalAwards : 0,
    recentAwardCount,
    activeDefinitionCount: activeDefinitions.length,
    leaderboard: leaderboard.map((row) => {
      const user = userMap[row.userId];
      return {
        userId: row.userId,
        name: user?.name ?? "Unknown user",
        email: user?.email ?? null,
        count: row._count,
      };
    }),
    distribution: distribution.map((row) => {
      const definition = definitionMap[row.definitionId];
      return {
        definitionId: row.definitionId,
        key: definition?.key ?? "unknown",
        name: definition?.name ?? "Unknown badge",
        category: definition?.category ?? "MILESTONE",
        active: definition?.active ?? false,
        count: row._count,
      };
    }),
    recentAwards: recentAwards.map((award) => ({
      id: award.id,
      awardedAt: award.awardedAt.toISOString(),
      source: award.source,
      note: award.note,
      user: award.user,
      definition: award.definition,
      awardedBy: award.awardedBy,
    })),
    underusedDefinitions,
  };
}
