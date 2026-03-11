export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireAuth();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      // Global: all checkouts (overdue first, then nearest due)
      allCheckouts,
      checkoutsOverdueCount,
      // Global: all reservations (soonest start)
      allReservations,
      // Upcoming events (next 7 days)
      upcomingEvents,
      // Personal: my checked-out items via allocations
      myCheckoutBookings,
      // Personal: my reservations
      myReservations,
      // Overdue: top 3 for banner
      topOverdue,
    ] = await Promise.all([
      db.booking.findMany({
        where: { kind: "CHECKOUT", status: "OPEN" },
        orderBy: { endsAt: "asc" },
        take: 5,
        include: {
          requester: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN", endsAt: { lt: now } },
      }),
      db.booking.findMany({
        where: { kind: "RESERVATION", status: "BOOKED" },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: {
          requester: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      }),
      db.calendarEvent.findMany({
        where: {
          startsAt: { gte: now, lte: sevenDaysFromNow },
          status: "CONFIRMED",
        },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: {
          location: { select: { id: true, name: true } },
        },
      }),
      db.booking.findMany({
        where: {
          kind: "CHECKOUT",
          status: "OPEN",
          requesterUserId: user.id,
        },
        include: {
          serializedItems: {
            include: {
              asset: {
                select: { id: true, assetTag: true, brand: true, model: true, type: true },
              },
            },
          },
        },
      }),
      db.booking.findMany({
        where: {
          kind: "RESERVATION",
          status: "BOOKED",
          requesterUserId: user.id,
        },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: {
          location: { select: { id: true, name: true } },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      }),
      db.booking.findMany({
        where: {
          kind: "CHECKOUT",
          status: "OPEN",
          endsAt: { lt: now },
        },
        orderBy: { endsAt: "asc" },
        take: 3,
        include: {
          requester: { select: { id: true, name: true } },
          serializedItems: {
            take: 3,
            include: {
              asset: { select: { assetTag: true } },
            },
          },
        },
      }),
    ]);

    // Build "my possession" items: flatten booking → individual assets
    const myPossession = myCheckoutBookings.flatMap((booking) =>
      booking.serializedItems.map((item) => ({
        assetId: item.asset.id,
        assetTag: item.asset.assetTag,
        brand: item.asset.brand,
        model: item.asset.model,
        type: item.asset.type,
        bookingId: booking.id,
        bookingTitle: booking.title,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        isOverdue: booking.endsAt < now,
      }))
    );

    // Sort: overdue first, then nearest due
    myPossession.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    });

    // Format checkouts for response
    const checkouts = allCheckouts.map((c) => ({
      id: c.id,
      title: c.title,
      requesterName: c.requester.name,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      itemCount: c._count.serializedItems + c._count.bulkItems,
      status: c.status,
      isOverdue: c.endsAt < now,
    }));

    // Sort checkouts: overdue first, then nearest due
    checkouts.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    });

    const reservations = allReservations.map((r) => ({
      id: r.id,
      title: r.title,
      requesterName: r.requester.name,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      itemCount: r._count.serializedItems + r._count.bulkItems,
      status: r.status,
      isOverdue: r.endsAt < now,
    }));

    const events = upcomingEvents.map((e) => ({
      id: e.id,
      title: e.summary,
      sportCode: e.sportCode ?? null,
      startsAt: e.startsAt.toISOString(),
      location: e.location?.name ?? null,
      opponent: e.opponent ?? null,
      isHome: e.isHome ?? null,
    }));

    const overdueItems = topOverdue.map((b) => ({
      bookingId: b.id,
      bookingTitle: b.title,
      requesterName: b.requester.name,
      assetTags: b.serializedItems.map((si) => si.asset.assetTag),
      endsAt: b.endsAt.toISOString(),
    }));

    return ok({
      data: {
        checkouts: {
          total: allCheckouts.length < 5 ? allCheckouts.length : checkoutsOverdueCount + allCheckouts.length,
          overdue: checkoutsOverdueCount,
          items: checkouts,
        },
        reservations: {
          total: allReservations.length,
          items: reservations,
        },
        upcomingEvents: events,
        myPossession,
        myReservations: myReservations.map((r) => ({
          id: r.id,
          title: r.title,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          itemCount: r._count.serializedItems + r._count.bulkItems,
          locationName: r.location?.name ?? null,
        })),
        overdueCount: checkoutsOverdueCount,
        overdueItems,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
