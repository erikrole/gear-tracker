export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { countAssetsByEffectiveStatus } from "@/lib/services/status";

export async function GET() {
  try {
    await requireAuth();

    const now = new Date();

    let statusCounts: Record<string, number>;
    try {
      statusCounts = await countAssetsByEffectiveStatus();
    } catch {
      // Fallback if allocation tables not yet migrated
      const counts = await db.asset.groupBy({ by: ["status"], _count: true });
      statusCounts = { AVAILABLE: 0, CHECKED_OUT: 0, RESERVED: 0, MAINTENANCE: 0, RETIRED: 0 };
      for (const c of counts) statusCounts[c.status] = c._count;
    }

    const [
      totalAssets,
      reservationsBooked,
      reservationsOverdue,
      checkoutsOpen,
      checkoutsOverdue,
      recentReservations,
      recentCheckouts,
      assetsByLocation,
      assetsByType,
    ] = await Promise.all([
      db.asset.count(),
      db.booking.count({
        where: { kind: "RESERVATION", status: "BOOKED" },
      }),
      db.booking.count({
        where: {
          kind: "RESERVATION",
          status: "BOOKED",
          endsAt: { lt: now },
        },
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN" },
      }),
      db.booking.count({
        where: {
          kind: "CHECKOUT",
          status: "OPEN",
          endsAt: { lt: now },
        },
      }),
      db.booking.findMany({
        where: { kind: "RESERVATION", status: { in: ["BOOKED", "DRAFT"] } },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: {
          requester: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      }),
      db.booking.findMany({
        where: { kind: "CHECKOUT", status: "OPEN" },
        orderBy: { startsAt: "desc" },
        take: 5,
        include: {
          requester: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      }),
      db.asset.groupBy({
        by: ["locationId"],
        _count: true,
      }),
      db.asset.groupBy({
        by: ["type"],
        _count: true,
      }),
    ]);

    // Resolve location names for the grouped data
    const locationIds = assetsByLocation.map((g) => g.locationId);
    const locations =
      locationIds.length > 0
        ? await db.location.findMany({
            where: { id: { in: locationIds } },
            select: { id: true, name: true },
          })
        : [];

    const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

    return ok({
      data: {
        items: {
          available: statusCounts.AVAILABLE,
          checkedOut: statusCounts.CHECKED_OUT,
          reserved: statusCounts.RESERVED,
          maintenance: statusCounts.MAINTENANCE,
          retired: statusCounts.RETIRED,
          total: totalAssets,
        },
        reservations: {
          booked: reservationsBooked,
          overdue: reservationsOverdue,
        },
        checkouts: {
          open: checkoutsOpen,
          overdue: checkoutsOverdue,
        },
        recentReservations,
        recentCheckouts,
        itemsByLocation: assetsByLocation.map((g) => ({
          location: locationMap[g.locationId] || "Unknown",
          count: g._count,
        })),
        itemsByType: assetsByType.map((g) => ({
          type: g.type,
          count: g._count,
        })),
      },
    });
  } catch (error) {
    return fail(error);
  }
}
