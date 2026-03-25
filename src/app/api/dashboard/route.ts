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

// Prioritize bodies and lenses in gear avatar display
function sortItemsByCategory(
  items: Array<{ asset: { id: string; name: string | null; imageUrl: string | null; category: { name: string } | null } }>,
) {
  return [...items].sort((a, b) => {
    const aIsBodyLens = /body|lens/i.test(a.asset.category?.name ?? "");
    const bIsBodyLens = /body|lens/i.test(b.asset.category?.name ?? "");
    if (aIsBodyLens && !bIsBodyLens) return -1;
    if (!aIsBodyLens && bIsBodyLens) return 1;
    return 0;
  });
}

function toBookingSummary(c: {
  id: string;
  kind: string;
  title: string;
  refNumber: string | null;
  sportCode: string | null;
  requester: { name: string; avatarUrl: string | null };
  location?: { name: string } | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  _count: { serializedItems: number; bulkItems: number };
  serializedItems: Array<{ asset: { id: string; name: string | null; imageUrl: string | null; category: { name: string } | null } }>;
}, now: Date, canBeOverdue: boolean) {
  const sorted = sortItemsByCategory(c.serializedItems);
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    refNumber: c.refNumber,
    sportCode: c.sportCode ?? null,
    requesterName: c.requester.name,
    requesterInitials: getInitials(c.requester.name),
    requesterAvatarUrl: c.requester.avatarUrl ?? null,
    locationName: c.location?.name ?? null,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    itemCount: c._count.serializedItems + c._count.bulkItems,
    status: c.status,
    isOverdue: canBeOverdue && c.endsAt < now,
    items: sorted.slice(0, 3).map((si) => ({
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
    requester: { select: { id: true, name: true, avatarUrl: true } },
    location: { select: { id: true, name: true } },
    _count: { select: { serializedItems: true, bulkItems: true } },
    serializedItems: {
      include: { asset: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } } },
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
    // My overdue count (user-scoped, used for sidebar badge)
    myOverdueCount,
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
    // Team reservations (excl. me) — next 7 days only (AC-4)
    db.booking.findMany({
      where: { kind: "RESERVATION", status: "BOOKED", requesterUserId: { not: user.id }, startsAt: { gte: now, lte: sevenDaysFromNow } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: bookingInclude,
    }),
    db.booking.count({
      where: { kind: "RESERVATION", status: "BOOKED", requesterUserId: { not: user.id }, startsAt: { gte: now, lte: sevenDaysFromNow } },
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
    // My overdue count (user-scoped — for sidebar badge, works correctly for all roles)
    db.booking.count({
      where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: user.id, endsAt: { lt: now } },
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
                  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                },
              },
            },
          },
        },
      },
    }),
    // My reservations — next 7 days only (AC-4)
    db.booking.findMany({
      where: {
        kind: "RESERVATION",
        status: "BOOKED",
        requesterUserId: user.id,
        startsAt: { gte: now, lte: sevenDaysFromNow },
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { serializedItems: true, bulkItems: true } },
        serializedItems: {
          include: { asset: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } } },
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
        requester: { select: { id: true, name: true, avatarUrl: true } },
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
    const assignedUsers: Array<{ id: string; name: string; initials: string; avatarUrl: string | null }> = [];
    for (const shift of shifts) {
      for (const a of shift.assignments) {
        if (!seenUserIds.has(a.user.id)) {
          seenUserIds.add(a.user.id);
          assignedUsers.push({
            id: a.user.id,
            name: a.user.name,
            initials: getInitials(a.user.name),
            avatarUrl: a.user.avatarUrl ?? null,
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
    requesterInitials: getInitials(b.requester.name),
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
        select: {
          eventId: true,
          status: true,
          serializedItems: {
            include: { asset: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } } },
          },
          _count: { select: { serializedItems: true, bulkItems: true } },
        },
      })
    : [];
  const gearByEvent = new Map<string, { status: string; items: Array<{ asset: { id: string; name: string | null; imageUrl: string | null } }>; itemCount: number }>();
  for (const b of shiftGearBookings) {
    if (!b.eventId) continue;
    const current = gearByEvent.get(b.eventId);
    const gearStatus = b.status === "OPEN" ? "checked_out" : b.status === "BOOKED" ? "reserved" : "draft";
    const priority = { checked_out: 3, reserved: 2, draft: 1 };
    if (!current || priority[gearStatus as keyof typeof priority] > priority[current.status as keyof typeof priority]) {
      gearByEvent.set(b.eventId, {
        status: gearStatus,
        items: sortItemsByCategory(b.serializedItems).slice(0, 3),
        itemCount: b._count.serializedItems + b._count.bulkItems,
      });
    }
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
      gearStatus: gearByEvent.get(ev.id)?.status ?? "none",
      gearItems: (gearByEvent.get(ev.id)?.items ?? []).map((si) => ({
        id: si.asset.id,
        name: si.asset.name,
        imageUrl: si.asset.imageUrl,
      })),
      gearItemCount: gearByEvent.get(ev.id)?.itemCount ?? 0,
    };
  });

  return ok({
    data: {
      role: user.role,
      stats: {
        checkedOut: totalCheckedOut,
        overdue: totalOverdue,
        reserved: totalReserved,
        dueToday: dueTodayCount,
      },
      myCheckouts: {
        total: myCheckoutsTotalCount,
        overdue: myOverdueCount,
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
      myReservations: myReservations.map((r) => {
        const sorted = sortItemsByCategory(r.serializedItems);
        return {
          id: r.id,
          title: r.title,
          refNumber: r.refNumber,
          sportCode: r.sportCode ?? null,
          requesterName: r.requester.name,
          requesterInitials: getInitials(r.requester.name),
          requesterAvatarUrl: r.requester.avatarUrl ?? null,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          itemCount: r._count.serializedItems + r._count.bulkItems,
          locationName: r.location?.name ?? null,
          items: sorted.slice(0, 3).map((si) => ({
            id: si.asset.id,
            name: si.asset.name,
            imageUrl: si.asset.imageUrl,
          })),
        };
      }),
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
