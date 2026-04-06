import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { countAssetsByEffectiveStatus } from "@/lib/services/status";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  const report = searchParams.get("type") || "utilization";

  if (report === "utilization") {
    return ok(await getUtilizationReport());
  }

  if (report === "checkouts") {
    const days = parseInt(searchParams.get("days") || "30", 10);
    return ok(await getCheckoutReport(days));
  }

  if (report === "audit") {
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const action = searchParams.get("action");
    return ok(await getAuditReport(limit, offset, startDate, endDate, action));
  }

  if (report === "overdue") {
    return ok(await getOverdueReport());
  }

  if (report === "scans") {
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const phase = searchParams.get("phase");
    return ok(await getScanHistoryReport(limit, offset, startDate, endDate, phase));
  }

  throw new HttpError(400, "Unknown report type");
});

async function getUtilizationReport() {
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

async function getCheckoutReport(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const now = new Date();

  // 365-day window for heatmap (independent of period filter)
  const heatmapSince = new Date(Date.now() - 365 * 86_400_000);

  const checkoutResults = await Promise.allSettled([
    db.booking.count({
      where: { kind: "CHECKOUT", createdAt: { gte: since } }
    }),
    db.booking.count({
      where: {
        kind: "CHECKOUT",
        status: "OPEN",
        endsAt: { lt: now }
      }
    }),
    db.booking.findMany({
      where: { kind: "CHECKOUT", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        requester: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { serializedItems: true, bulkItems: true } }
      }
    }),
    db.booking.groupBy({
      by: ["requesterUserId"],
      where: { kind: "CHECKOUT", createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { requesterUserId: "desc" } },
      take: 10
    }),
    // Daily checkout counts for trend chart
    db.booking.findMany({
      where: { kind: "CHECKOUT", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    // 365-day heatmap data
    db.booking.findMany({
      where: { kind: "CHECKOUT", createdAt: { gte: heatmapSince } },
      select: { createdAt: true },
    }),
  ]);

  const totalCheckouts = checkoutResults[0].status === "fulfilled" ? checkoutResults[0].value : 0;
  const overdueCheckouts = checkoutResults[1].status === "fulfilled" ? checkoutResults[1].value : 0;
  const recentCheckouts = checkoutResults[2].status === "fulfilled" ? checkoutResults[2].value : [];
  const topRequesters = checkoutResults[3].status === "fulfilled" ? checkoutResults[3].value : [];
  const allInPeriod = checkoutResults[4].status === "fulfilled" ? checkoutResults[4].value : [];
  const heatmapRaw = checkoutResults[5].status === "fulfilled" ? checkoutResults[5].value : [];

  // Resolve requester names for top requesters
  const requesterIds = topRequesters.map((r) => r.requesterUserId);
  const users =
    requesterIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, name: true }
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Aggregate daily checkout counts for trend chart
  const dailyMap = new Map<string, number>();
  for (const b of allInPeriod) {
    const day = b.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  // Fill in zero-count days
  const dailyTrend: { date: string; count: number }[] = [];
  const cursor = new Date(since);
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10);
    dailyTrend.push({ date: key, count: dailyMap.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Aggregate 365-day heatmap
  const heatmapMap = new Map<string, number>();
  for (const b of heatmapRaw) {
    const day = b.createdAt.toISOString().slice(0, 10);
    heatmapMap.set(day, (heatmapMap.get(day) ?? 0) + 1);
  }
  const heatmap = Array.from(heatmapMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    totalCheckouts,
    overdueCheckouts,
    dailyTrend,
    heatmap,
    recentCheckouts: recentCheckouts.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      createdAt: c.createdAt,
      requester: c.requester.name,
      location: c.location.name,
      itemCount: c._count.serializedItems + c._count.bulkItems,
      isOverdue: c.status === "OPEN" && c.endsAt < now
    })),
    topRequesters: topRequesters.map((r) => ({
      name: userMap[r.requesterUserId] || "Unknown",
      count: r._count
    }))
  };
}

async function getOverdueReport() {
  const now = new Date();

  const overdueBookings = await db.booking.findMany({
    where: {
      kind: "CHECKOUT",
      status: "OPEN",
      endsAt: { lt: now },
    },
    include: {
      requester: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      serializedItems: {
        include: { asset: { select: { id: true, assetTag: true, name: true } } },
      },
      bulkItems: {
        include: { bulkSku: { select: { id: true, name: true } } },
      },
    },
    orderBy: { endsAt: "asc" },
  });

  // Group by requester
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
    const hours = Math.round((now.getTime() - new Date(b.endsAt).getTime()) / 3_600_000);
    const items: string[] = [];
    for (const si of b.serializedItems) {
      items.push(si.asset.assetTag ?? si.asset.name);
    }
    for (const bi of b.bulkItems) {
      items.push(`${bi.bulkSku.name} x${(bi.checkedOutQuantity ?? 0) - (bi.checkedInQuantity ?? 0)}`);
    }
    const itemCount = b.serializedItems.length + b.bulkItems.length;

    const existing = byRequester.get(b.requester.id);
    const booking = {
      id: b.id,
      title: b.title,
      endsAt: b.endsAt.toISOString(),
      overdueHours: hours,
      location: b.location.name,
      itemCount,
      items: items.slice(0, 5),
    };

    if (existing) {
      existing.overdueCount++;
      existing.totalOverdueHours += hours;
      existing.bookings.push(booking);
    } else {
      byRequester.set(b.requester.id, {
        userId: b.requester.id,
        name: b.requester.name,
        overdueCount: 1,
        totalOverdueHours: hours,
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

async function getScanHistoryReport(
  limit: number,
  offset: number,
  startDate?: string | null,
  endDate?: string | null,
  phase?: string | null
) {
  const where: Record<string, unknown> = {};
  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
  if (phase && (phase === "CHECKOUT" || phase === "CHECKIN")) where.phase = phase;

  const scanResults = await Promise.allSettled([
    db.scanEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, name: true } },
        asset: { select: { id: true, assetTag: true, name: true } },
        bulkSku: { select: { id: true, name: true } },
        booking: { select: { id: true, title: true } },
      },
    }),
    db.scanEvent.count({ where }),
    db.scanEvent.count({ where: { ...where, success: true } }),
    // Daily aggregation for stacked bar chart
    db.scanEvent.findMany({
      where,
      select: { createdAt: true, success: true },
    }),
  ]);

  const data = scanResults[0].status === "fulfilled" ? scanResults[0].value : [];
  const total = scanResults[1].status === "fulfilled" ? scanResults[1].value : 0;
  const successCount = scanResults[2].status === "fulfilled" ? scanResults[2].value : 0;
  const allScans = scanResults[3].status === "fulfilled" ? scanResults[3].value : [];

  // Aggregate daily scan volume (success vs fail)
  const dailyScanMap = new Map<string, { success: number; fail: number }>();
  for (const s of allScans) {
    const day = s.createdAt.toISOString().slice(0, 10);
    const entry = dailyScanMap.get(day) ?? { success: 0, fail: 0 };
    if (s.success) entry.success++;
    else entry.fail++;
    dailyScanMap.set(day, entry);
  }
  const dailyScans = Array.from(dailyScanMap.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    data: data.map((s) => ({
      id: s.id,
      actor: s.actor.name,
      scanType: s.scanType,
      scanValue: s.scanValue,
      success: s.success,
      phase: s.phase,
      item: s.asset
        ? s.asset.assetTag || s.asset.name
        : s.bulkSku
          ? s.bulkSku.name
          : s.scanValue,
      bookingId: s.booking.id,
      bookingTitle: s.booking.title,
      createdAt: s.createdAt,
    })),
    total,
    successCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
    dailyScans,
    limit,
    offset,
  };
}

async function getAuditReport(
  limit: number,
  offset: number,
  startDate?: string | null,
  endDate?: string | null,
  action?: string | null
) {
  const where: Record<string, unknown> = {};
  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
  if (action) where.action = action;

  const auditResults = await Promise.allSettled([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, name: true } }
      }
    }),
    db.auditLog.count({ where }),
    // Group by action for bar chart
    db.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
      orderBy: { _count: { action: "desc" } },
      take: 15,
    }),
    // Group by entity type for bar chart
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
    data: data.map((entry) => ({
      id: entry.id,
      actor: entry.actor?.name || "System",
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      createdAt: entry.createdAt,
      details: entry.afterJson
    })),
    total,
    byAction,
    byEntityType,
    limit,
    offset
  };
}
