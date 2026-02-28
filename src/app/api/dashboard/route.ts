export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    await requireAuth();

    const now = new Date();

    const [
      assetsAvailable,
      assetsMaintenance,
      assetsRetired,
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
      db.asset.count({ where: { status: "AVAILABLE" } }),
      db.asset.count({ where: { status: "MAINTENANCE" } }),
      db.asset.count({ where: { status: "RETIRED" } }),
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

    const checkedOutAssets = await db.bookingSerializedItem.count({
      where: {
        booking: { kind: "CHECKOUT", status: "OPEN" },
        allocationStatus: "active",
      },
    });

    return ok({
      data: {
        items: {
          available: assetsAvailable,
          checkedOut: checkedOutAssets,
          maintenance: assetsMaintenance,
          retired: assetsRetired,
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
