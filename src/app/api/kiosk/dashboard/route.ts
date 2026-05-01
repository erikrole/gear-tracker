import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { getInitials } from "@/lib/avatar";

/** Kiosk idle screen data: stats, today's events, active checkouts (location-scoped). */
export const GET = withKiosk(async (_req, { kiosk }) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [statsResult, events, checkouts] = await Promise.all([
    // Stats: count active checkouts, items out, overdue (scoped to this kiosk's location).
    db.$queryRaw<
      Array<{ checkouts: bigint; items_out: bigint; overdue: bigint }>
    >`
      SELECT
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'OPEN' AND b.kind = 'CHECKOUT') as checkouts,
        COUNT(bsi.id) FILTER (WHERE b.status = 'OPEN' AND b.kind = 'CHECKOUT') as items_out,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'OPEN' AND b.kind = 'CHECKOUT' AND b.ends_at < ${now}) as overdue
      FROM bookings b
      LEFT JOIN booking_serialized_items bsi ON bsi.booking_id = b.id AND bsi.allocation_status = 'active'
      WHERE b.location_id = ${kiosk.locationId}
    `,

    // Today's events
    db.calendarEvent.findMany({
      where: {
        startsAt: { gte: todayStart, lte: todayEnd },
        isHidden: false,
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: {
        id: true,
        summary: true,
        sportCode: true,
        startsAt: true,
        shiftGroup: {
          select: {
            _count: {
              select: { shifts: true },
            },
          },
        },
      },
    }),

    // Active checkouts at this kiosk's location, most overdue first, max 10.
    db.booking.findMany({
      where: {
        kind: "CHECKOUT",
        status: "OPEN",
        locationId: kiosk.locationId,
      },
      orderBy: [{ endsAt: "asc" }],
      take: 10,
      select: {
        id: true,
        title: true,
        endsAt: true,
        requester: {
          select: { id: true, name: true, avatarUrl: true },
        },
        serializedItems: {
          where: { allocationStatus: "active" },
          take: 3,
          select: {
            asset: {
              select: { assetTag: true, name: true },
            },
          },
        },
        _count: {
          select: { serializedItems: { where: { allocationStatus: "active" } } },
        },
      },
    }),
  ]);

  const stats = {
    itemsOut: Number(statsResult[0]?.items_out ?? 0),
    checkouts: Number(statsResult[0]?.checkouts ?? 0),
    overdue: Number(statsResult[0]?.overdue ?? 0),
  };

  return ok({
    stats,
    events: events.map((e) => ({
      id: e.id,
      title: e.summary,
      sportCode: e.sportCode,
      startsAt: e.startsAt,
      shiftCount: e.shiftGroup?._count.shifts ?? 0,
    })),
    checkouts: checkouts.map((c) => ({
      id: c.id,
      title: c.title,
      requesterName: c.requester.name,
      requesterAvatarUrl: c.requester.avatarUrl,
      requesterInitials: getInitials(c.requester.name),
      items: c.serializedItems.map((si) => ({
        name: si.asset.name || si.asset.assetTag,
      })),
      itemCount: c._count.serializedItems,
      endsAt: c.endsAt,
      isOverdue: c.endsAt < now,
    })),
  });
});
