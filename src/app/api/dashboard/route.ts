import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { getInitials } from "@/lib/avatar";
import { Prisma } from "@prisma/client";

// Sort comparator: overdue first, then nearest due date
const sortOverdueFirst = (a: { isOverdue: boolean; endsAt: string }, b: { isOverdue: boolean; endsAt: string }) => {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
};

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
      take: 3,
      include: { asset: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } } },
    },
  } as const;

  // Consolidate 9 count queries into a single raw SQL query with conditional aggregation
  type CountRow = {
    team_checkouts: bigint;
    team_checkouts_overdue: bigint;
    team_reservations: bigint;
    my_checkouts: bigint;
    my_overdue: bigint;
    total_checked_out: bigint;
    total_overdue: bigint;
    total_reserved: bigint;
    due_today: bigint;
  };
  const countsPromise = db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN') AS total_checked_out,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND ends_at < ${now}) AS total_overdue,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND ends_at >= ${startOfToday} AND ends_at < ${startOfTomorrow}) AS due_today,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id != ${user.id}) AS team_checkouts,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id != ${user.id} AND ends_at < ${now}) AS team_checkouts_overdue,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id = ${user.id}) AS my_checkouts,
      COUNT(*) FILTER (WHERE kind = 'CHECKOUT' AND status = 'OPEN' AND requester_user_id = ${user.id} AND ends_at < ${now}) AS my_overdue,
      COUNT(*) FILTER (WHERE kind = 'RESERVATION' AND status = 'BOOKED' AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow}) AS total_reserved,
      COUNT(*) FILTER (WHERE kind = 'RESERVATION' AND status = 'BOOKED' AND requester_user_id != ${user.id} AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow}) AS team_reservations
    FROM bookings
    WHERE (kind = 'CHECKOUT' AND status = 'OPEN')
       OR (kind = 'RESERVATION' AND status = 'BOOKED' AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow})
  `);

  const [
    counts,
    // Team: checkouts excluding current user
    teamCheckoutsRaw,
    // Team: reservations excluding current user
    teamReservationsRaw,
    // My checkouts (booking-level)
    myCheckoutsRaw,
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
    // Flagged items: recent damage/lost reports + maintenance assets
    recentReports,
    maintenanceAssets,
    // Lost bulk units summary (admin only)
    lostBulkUnitsRaw,
  ] = await Promise.all([
    countsPromise,
    // Team checkouts (excl. me)
    db.booking.findMany({
      where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: { not: user.id } },
      orderBy: { endsAt: "asc" },
      take: 5,
      include: bookingInclude,
    }),
    // Team reservations (excl. me) — next 7 days only (AC-4)
    db.booking.findMany({
      where: { kind: "RESERVATION", status: "BOOKED", requesterUserId: { not: user.id }, startsAt: { gte: now, lte: sevenDaysFromNow } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: bookingInclude,
    }),
    // My checkouts (booking-level summaries)
    db.booking.findMany({
      where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: user.id },
      orderBy: { endsAt: "asc" },
      take: 5,
      include: bookingInclude,
    }),
    // Upcoming events (with shift assignment data)
    db.calendarEvent.findMany({
      where: {
        startsAt: { gte: now, lte: sevenDaysFromNow },
        status: "CONFIRMED",
        isHidden: false,
      },
      orderBy: { startsAt: "asc" },
      take: 20,
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
          take: 3,
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
            asset: { select: { id: true, assetTag: true, name: true, imageUrl: true } },
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
    // Recent damage/lost reports (last 30 days, staff/admin only)
    user.role !== "STUDENT"
      ? db.checkinItemReport.findMany({
          where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            asset: { select: { id: true, assetTag: true, name: true } },
            booking: { select: { title: true } },
            reportedBy: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    // Assets currently in maintenance
    user.role !== "STUDENT"
      ? db.asset.findMany({
          where: { status: "MAINTENANCE" },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: { id: true, assetTag: true, name: true, updatedAt: true },
        })
      : Promise.resolve([]),
    // Lost bulk units — admin only
    user.role === "ADMIN"
      ? db.bulkSkuUnit.groupBy({
          by: ["bulkSkuId"],
          where: { status: "LOST" },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  // Resolve lost bulk unit SKU names
  let lostBulkUnits: Array<{ skuName: string; count: number }> = [];
  if (lostBulkUnitsRaw.length > 0) {
    const skuIds = lostBulkUnitsRaw.map((r) => r.bulkSkuId);
    const skus = await db.bulkSku.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(skus.map((s) => [s.id, s.name]));
    lostBulkUnits = lostBulkUnitsRaw.map((r) => ({
      skuName: nameMap.get(r.bulkSkuId) ?? "Unknown",
      count: r._count.id,
    }));
  }

  const c = counts[0];
  const teamCheckoutsTotalCount = Number(c.team_checkouts);
  const teamCheckoutsOverdueCount = Number(c.team_checkouts_overdue);
  const teamReservationsTotalCount = Number(c.team_reservations);
  const myCheckoutsTotalCount = Number(c.my_checkouts);
  const myOverdueCount = Number(c.my_overdue);
  const totalCheckedOut = Number(c.total_checked_out);
  const totalOverdue = Number(c.total_overdue);
  const totalReserved = Number(c.total_reserved);
  const dueTodayCount = Number(c.due_today);

  const teamCheckouts = teamCheckoutsRaw.map((c) => toBookingSummary(c, now, true));
  teamCheckouts.sort(sortOverdueFirst);

  const teamReservations = teamReservationsRaw.map((r) => toBookingSummary(r, now, false));

  const myCheckouts = myCheckoutsRaw.map((c) => toBookingSummary(c, now, true));
  myCheckouts.sort(sortOverdueFirst);

  const events = upcomingEvents.map((e) => {
    // Collect assigned users across all shifts (include shift area for tooltip)
    const shifts = e.shiftGroup?.shifts ?? [];
    const totalShiftSlots = shifts.length;
    const filledShiftSlots = shifts.filter((s) => s.assignments.length > 0).length;
    const seenUserIds = new Set<string>();
    const assignedUsers: Array<{ id: string; name: string; initials: string; avatarUrl: string | null; area: string | null }> = [];
    for (const shift of shifts) {
      for (const a of shift.assignments) {
        if (!seenUserIds.has(a.user.id)) {
          seenUserIds.add(a.user.id);
          assignedUsers.push({
            id: a.user.id,
            name: a.user.name,
            initials: getInitials(a.user.name),
            avatarUrl: a.user.avatarUrl ?? null,
            area: shift.area,
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
      filledShiftSlots,
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
    items: b.serializedItems.map((si) => ({
      id: si.asset.id,
      name: si.asset.name,
      imageUrl: si.asset.imageUrl,
    })),
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
            take: 3,
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
      lostBulkUnits,
      flaggedItems: [
        ...recentReports.map((r) => ({
          id: r.id,
          assetId: r.asset.id,
          assetTag: r.asset.assetTag,
          assetName: r.asset.name,
          type: r.type as "DAMAGED" | "LOST",
          bookingTitle: r.booking.title,
          reportedBy: r.reportedBy.name,
          createdAt: r.createdAt.toISOString(),
        })),
        ...maintenanceAssets.map((a) => ({
          id: `maint-${a.id}`,
          assetId: a.id,
          assetTag: a.assetTag,
          assetName: a.name,
          type: "MAINTENANCE" as const,
          bookingTitle: null,
          reportedBy: null,
          createdAt: a.updatedAt.toISOString(),
        })),
      ],
    },
  });
});
