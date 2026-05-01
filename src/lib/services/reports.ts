import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { countAssetsByEffectiveStatus } from "@/lib/services/status";

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

export async function getCheckoutReport(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const now = new Date();
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
    // Single 365-day daily aggregation (period series is sliced in JS).
    // Using date_trunc keeps the work in Postgres regardless of row count.
    db.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
             COUNT(*)::bigint AS count
      FROM bookings
      WHERE kind = 'CHECKOUT' AND "created_at" >= ${heatmapSince}
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

export async function getOverdueReport() {
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

export async function getScanHistoryReport(
  limit: number,
  offset: number,
  startDate?: string | null,
  endDate?: string | null,
  phase?: string | null,
) {
  const where: Prisma.ScanEventWhereInput = {};
  const dateFilter: Prisma.DateTimeFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
  if (phase === "CHECKOUT" || phase === "CHECKIN") where.phase = phase;

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

  const scanResults = await Promise.allSettled([
    db.scanEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
        asset: { select: { id: true, assetTag: true, name: true } },
        bulkSku: { select: { id: true, name: true } },
        booking: { select: { id: true, title: true } },
      },
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

export async function getAuditReport(
  limit: number,
  offset: number,
  startDate?: string | null,
  endDate?: string | null,
  action?: string | null,
) {
  const where: Prisma.AuditLogWhereInput = {};
  const dateFilter: Prisma.DateTimeFilter = {};
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
    data: data.map((entry) => ({
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
    })),
    total,
    byAction,
    byEntityType,
    limit,
    offset
  };
}

/**
 * Bulk loss report: lost units grouped by SKU and by last requester.
 */
export async function getBulkLossReport() {
  const [lostBySkuResult, lostByUserResult, recentLossesResult] = await Promise.allSettled([
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
  };
}
