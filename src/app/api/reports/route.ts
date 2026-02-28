export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { countAssetsByEffectiveStatus } from "@/lib/services/status";

export async function GET(req: Request) {
  try {
    await requireAuth();
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
      return ok(await getAuditReport(limit, offset));
    }

    return ok({ error: "Unknown report type" });
  } catch (error) {
    return fail(error);
  }
}

async function getUtilizationReport() {
  const [statusCounts, totalAssets, byLocation, byType, byDepartment] =
    await Promise.all([
      countAssetsByEffectiveStatus(),
      db.asset.count(),
      db.asset.groupBy({ by: ["locationId"], _count: true }),
      db.asset.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } }),
      db.asset.groupBy({ by: ["departmentId"], _count: true })
    ]);

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

  const [totalCheckouts, overdueCheckouts, recentCheckouts, topRequesters] =
    await Promise.all([
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
      })
    ]);

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

  return {
    days,
    totalCheckouts,
    overdueCheckouts,
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

async function getAuditReport(limit: number, offset: number) {
  const [data, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, name: true } }
      }
    }),
    db.auditLog.count()
  ]);

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
    limit,
    offset
  };
}
