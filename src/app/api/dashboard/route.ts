import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

// Sort comparator: overdue first, then nearest due date
const sortOverdueFirst = (a: { isOverdue: boolean; endsAt: string }, b: { isOverdue: boolean; endsAt: string }) => {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function toBookingSummary(c: {
  id: string;
  title: string;
  refNumber: string | null;
  requester: { name: string };
  location?: { name: string } | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  _count: { serializedItems: number; bulkItems: number };
  serializedItems: Array<{ asset: { id: string; name: string | null; imageUrl: string | null } }>;
}, now: Date, canBeOverdue: boolean) {
  return {
    id: c.id,
    title: c.title,
    refNumber: c.refNumber,
    requesterName: c.requester.name,
    requesterInitials: getInitials(c.requester.name),
    locationName: c.location?.name ?? null,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    itemCount: c._count.serializedItems + c._count.bulkItems,
    status: c.status,
    isOverdue: canBeOverdue && c.endsAt < now,
    items: c.serializedItems.map((si) => ({
      id: si.asset.id,
      name: si.asset.name,
      imageUrl: si.asset.imageUrl,
    })),
  };
}

export const GET = withAuth(async (_req, { user }) => {
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
    serializedItems: {
      take: 3,
      include: { asset: { select: { id: true, name: true, imageUrl: true } } },
    },
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
    // Drafts: current user's in-progress work
    myDrafts,
    // My shift assignments
    myShiftsRaw,
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
    // Upcoming events (with shift assignment data)
    db.calendarEvent.findMany({
      where: {
        startsAt: { gte: now, lte: sevenDaysFromNow },
        status: "CONFIRMED",
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        location: { select: { id: true, name: true } },
        shiftGroup: {
          include: {
            shifts: {
              include: {
                assignments: {
                  where: { status: { in: ["DIRECT_ASSIGNED", "APPROVED"] } },
                  include: { user: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
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
        serializedItems: {
          take: 3,
          include: { asset: { select: { id: true, name: true, imageUrl: true } } },
        },
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
    // Drafts: current user's in-progress work
    db.booking.findMany({
      where: { status: "DRAFT", createdBy: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        _count: { select: { serializedItems: true, bulkItems: true } },
      },
    }),
    // My upcoming shift assignments
    db.shiftAssignment.findMany({
      where: {
        userId: user.id,
        status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
        shift: {
          shiftGroup: {
            event: { startsAt: { gte: now }, status: "CONFIRMED" },
          },
        },
      },
      orderBy: { shift: { startsAt: "asc" } },
      take: 5,
      include: {
        shift: {
          include: {
            shiftGroup: {
              include: {
                event: {
                  select: {
                    id: true,
                    summary: true,
                    startsAt: true,
                    endsAt: true,
                    sportCode: true,
                    opponent: true,
                    isHome: true,
                    locationId: true,
                    location: { select: { id: true, name: true } },
                  },
                },
              },
            },
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

  const events = upcomingEvents.map((e) => {
    // Collect assigned users across all shifts
    const shifts = e.shiftGroup?.shifts ?? [];
    const totalShiftSlots = shifts.length;
    const seenUserIds = new Set<string>();
    const assignedUsers: Array<{ id: string; name: string; initials: string }> = [];
    for (const shift of shifts) {
      for (const a of shift.assignments) {
        if (!seenUserIds.has(a.user.id)) {
          seenUserIds.add(a.user.id);
          assignedUsers.push({
            id: a.user.id,
            name: a.user.name,
            initials: getInitials(a.user.name),
          });
        }
      }
    }
    return {
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
      totalShiftSlots,
      assignedUsers,
    };
  });

  const overdueItems = topOverdue.map((b) => ({
    bookingId: b.id,
    bookingTitle: b.title,
    requesterName: b.requester.name,
    assetTags: b.serializedItems.map((si) => si.asset.assetTag),
    endsAt: b.endsAt.toISOString(),
  }));

  // Build my shifts with gear status
  const shiftEventIds = [...new Set(myShiftsRaw.map((a) => a.shift.shiftGroup.event.id))];
  const shiftGearBookings = shiftEventIds.length > 0
    ? await db.booking.findMany({
        where: {
          requesterUserId: user.id,
          eventId: { in: shiftEventIds },
          status: { in: ["DRAFT", "BOOKED", "OPEN"] },
        },
        select: { eventId: true, status: true },
      })
    : [];
  const gearByEvent = new Map<string, string>();
  for (const b of shiftGearBookings) {
    if (!b.eventId) continue;
    const current = gearByEvent.get(b.eventId);
    // Prioritize: checked_out > reserved > draft
    if (b.status === "OPEN") gearByEvent.set(b.eventId, "checked_out");
    else if (b.status === "BOOKED" && current !== "checked_out") gearByEvent.set(b.eventId, "reserved");
    else if (b.status === "DRAFT" && !current) gearByEvent.set(b.eventId, "draft");
  }

  const myShifts = myShiftsRaw.map((a) => {
    const ev = a.shift.shiftGroup.event;
    return {
      id: a.id,
      area: a.shift.area,
      workerType: a.shift.workerType,
      startsAt: a.shift.startsAt.toISOString(),
      endsAt: a.shift.endsAt.toISOString(),
      event: {
        id: ev.id,
        summary: ev.summary,
        startsAt: ev.startsAt.toISOString(),
        endsAt: ev.endsAt.toISOString(),
        sportCode: ev.sportCode,
        opponent: ev.opponent,
        isHome: ev.isHome,
        locationId: ev.locationId,
        locationName: ev.location?.name ?? null,
      },
      gearStatus: gearByEvent.get(ev.id) ?? "none",
    };
  });

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
        refNumber: r.refNumber,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        itemCount: r._count.serializedItems + r._count.bulkItems,
        locationName: r.location?.name ?? null,
        items: r.serializedItems.map((si) => ({
          id: si.asset.id,
          name: si.asset.name,
          imageUrl: si.asset.imageUrl,
        })),
      })),
      overdueCount: totalOverdue,
      overdueItems,
      drafts: myDrafts.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        itemCount: d._count.serializedItems + d._count.bulkItems,
        updatedAt: d.updatedAt.toISOString(),
      })),
      myShifts,
    },
  });
});
