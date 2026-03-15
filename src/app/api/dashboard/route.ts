export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

// Sort comparator: overdue first, then nearest due date
const sortOverdueFirst = (a: { isOverdue: boolean; endsAt: string }, b: { isOverdue: boolean; endsAt: string }) => {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
};

function toBookingSummary(c: {
  id: string;
  title: string;
  requester: { name: string };
  startsAt: Date;
  endsAt: Date;
  status: string;
  _count: { serializedItems: number; bulkItems: number };
}, now: Date, canBeOverdue: boolean) {
  return {
    id: c.id,
    title: c.title,
    requesterName: c.requester.name,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    itemCount: c._count.serializedItems + c._count.bulkItems,
    status: c.status,
    isOverdue: canBeOverdue && c.endsAt < now,
  };
}

export async function GET() {
  try {
    const user = await requireAuth();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Compute start/end of today for dueToday count
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const bookingInclude = {
      requester: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      _count: { select: { serializedItems: true, bulkItems: true } },
    } as const;

    const [
      // Team: checkouts excluding current user
      teamCheckoutsRaw,
      teamCheckoutsTotalCount,
      teamCheckoutsOverdueCount,
      // Team: reservations excluding current user
      teamReservationsRaw,
      teamReservationsTotalCount,
      // My checkouts (booking-level)
      myCheckoutsRaw,
      myCheckoutsTotalCount,
      // Stats: totals across all users
      totalCheckedOut,
      totalOverdue,
      totalReserved,
      dueTodayCount,
      // Upcoming events (next 7 days)
      upcomingEvents,
      // Personal: my reservations
      myReservations,
      // Overdue: top items for banner
      topOverdue,
    ] = await Promise.all([
      // Team checkouts (excl. me)
      db.booking.findMany({
        where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: { not: user.id } },
        orderBy: { endsAt: "asc" },
        take: 5,
        include: bookingInclude,
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: { not: user.id } },
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: { not: user.id }, endsAt: { lt: now } },
      }),
      // Team reservations (excl. me)
      db.booking.findMany({
        where: { kind: "RESERVATION", status: "BOOKED", requesterUserId: { not: user.id } },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: bookingInclude,
      }),
      db.booking.count({
        where: { kind: "RESERVATION", status: "BOOKED", requesterUserId: { not: user.id } },
      }),
      // My checkouts (booking-level summaries)
      db.booking.findMany({
        where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: user.id },
        orderBy: { endsAt: "asc" },
        take: 5,
        include: bookingInclude,
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: user.id },
      }),
      // Stats: totals across all users
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN" },
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN", endsAt: { lt: now } },
      }),
      db.booking.count({
        where: { kind: "RESERVATION", status: "BOOKED" },
      }),
      db.booking.count({
        where: { kind: "CHECKOUT", status: "OPEN", endsAt: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      // Upcoming events
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
      // My reservations
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
      // Top overdue for banner
      db.booking.findMany({
        where: {
          kind: "CHECKOUT",
          status: "OPEN",
          endsAt: { lt: now },
        },
        orderBy: { endsAt: "asc" },
        take: 5,
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

    // Format team checkouts
    const teamCheckouts = teamCheckoutsRaw.map((c) => toBookingSummary(c, now, true));
    teamCheckouts.sort(sortOverdueFirst);

    // Format team reservations
    const teamReservations = teamReservationsRaw.map((r) => toBookingSummary(r, now, false));

    // Format my checkouts
    const myCheckouts = myCheckoutsRaw.map((c) => toBookingSummary(c, now, true));
    myCheckouts.sort(sortOverdueFirst);

    const events = upcomingEvents.map((e) => ({
      id: e.id,
      title: e.summary,
      sportCode: e.sportCode ?? null,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      allDay: e.allDay,
      location: e.location?.name ?? null,
      locationId: e.location?.id ?? null,
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
        stats: {
          checkedOut: totalCheckedOut,
          overdue: totalOverdue,
          reserved: totalReserved,
          dueToday: dueTodayCount,
        },
        myCheckouts: {
          total: myCheckoutsTotalCount,
          items: myCheckouts,
        },
        teamCheckouts: {
          total: teamCheckoutsTotalCount,
          overdue: teamCheckoutsOverdueCount,
          items: teamCheckouts,
        },
        teamReservations: {
          total: teamReservationsTotalCount,
          items: teamReservations,
        },
        upcomingEvents: events,
        myReservations: myReservations.map((r) => ({
          id: r.id,
          title: r.title,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          itemCount: r._count.serializedItems + r._count.bulkItems,
          locationName: r.location?.name ?? null,
        })),
        overdueCount: totalOverdue,
        overdueItems,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
