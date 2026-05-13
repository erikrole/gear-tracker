import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { getInitials } from "@/lib/avatar";
import { checkRateLimit } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

const DASHBOARD_LIMIT = { max: 30, windowMs: 60_000 };

// Sort comparator: overdue first, then nearest due date
const sortOverdueFirst = (a: { isOverdue: boolean; endsAt: string }, b: { isOverdue: boolean; endsAt: string }) => {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
};

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  partialFailures: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[dashboard] ${label} failed`, result.reason);
  partialFailures.push(label);
  return fallback;
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
  requesterUserId: string;
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
    requesterUserId: c.requesterUserId,
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
  const { allowed } = checkRateLimit(`dashboard:full:${user.id}`, DASHBOARD_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

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
    pending_pickup: bigint;
    stale_reservations: bigint;
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
      COUNT(*) FILTER (WHERE kind = 'RESERVATION' AND status = 'BOOKED' AND requester_user_id != ${user.id} AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow}) AS team_reservations,
      COUNT(*) FILTER (WHERE status = 'PENDING_PICKUP') AS pending_pickup,
      COUNT(*) FILTER (WHERE kind = 'RESERVATION' AND status = 'BOOKED' AND ends_at < ${now}) AS stale_reservations
    FROM bookings
    WHERE (kind = 'CHECKOUT' AND status = 'OPEN')
       OR (kind = 'RESERVATION' AND status = 'BOOKED' AND starts_at >= ${now} AND starts_at <= ${sevenDaysFromNow})
       OR (kind = 'RESERVATION' AND status = 'BOOKED' AND ends_at < ${now})
       OR status = 'PENDING_PICKUP'
  `);

  const [
    countsResult,
    // Team: checkouts excluding current user
    teamCheckoutsRawResult,
    // Team: reservations excluding current user
    teamReservationsRawResult,
    // Stale reservations: booked reservations whose window has already ended
    staleReservationsRawResult,
    // My checkouts (booking-level)
    myCheckoutsRawResult,
    // Upcoming events (next 7 days)
    upcomingEventsResult,
    // Personal: my reservations
    myReservationsResult,
    // Overdue: top items for banner
    topOverdueResult,
    // Drafts: current user's in-progress work
    myDraftsResult,
    // Pending pickups (checkouts awaiting kiosk pickup)
    pendingPickupsRawResult,
    // My shift assignments
    myShiftsRawResult,
    // Flagged items: recent damage/lost reports + maintenance assets
    recentReportsResult,
    maintenanceAssetsResult,
    // Lost bulk units summary (admin only)
    lostBulkUnitsRawResult,
  ] = await Promise.allSettled([
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
    // Stale reservations — planning cleanup, not checkout custody overdue
    db.booking.findMany({
      where: { kind: "RESERVATION", status: "BOOKED", endsAt: { lt: now } },
      orderBy: { endsAt: "asc" },
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
    // Top overdue for banner — all roles see all overdue
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
    // Pending pickups (checkouts marked ready but not yet picked up)
    // Order: pickups whose start time has passed first (most urgent),
    // then by earliest start time. Cap at 5 for the dashboard preview.
    db.booking.findMany({
      where: { status: "PENDING_PICKUP" },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: bookingInclude,
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
  const partialFailures: string[] = [];
  const zeroCounts: CountRow[] = [{
    team_checkouts: 0n,
    team_checkouts_overdue: 0n,
    team_reservations: 0n,
    my_checkouts: 0n,
    my_overdue: 0n,
    total_checked_out: 0n,
    total_overdue: 0n,
    total_reserved: 0n,
    due_today: 0n,
    pending_pickup: 0n,
    stale_reservations: 0n,
  }];
  const bookingRowsFallback: Array<Parameters<typeof toBookingSummary>[0]> = [];
  const counts = settledValue(countsResult, zeroCounts, "counts", partialFailures);
  const teamCheckoutsRaw = settledValue(teamCheckoutsRawResult, bookingRowsFallback, "teamCheckouts", partialFailures);
  const teamReservationsRaw = settledValue(teamReservationsRawResult, bookingRowsFallback, "teamReservations", partialFailures);
  const staleReservationsRaw = settledValue(staleReservationsRawResult, bookingRowsFallback, "staleReservations", partialFailures);
  const myCheckoutsRaw = settledValue(myCheckoutsRawResult, bookingRowsFallback, "myCheckouts", partialFailures);
  const upcomingEvents = settledValue(upcomingEventsResult, [] as Array<{
    id: string;
    summary: string;
    sportCode: string | null;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    location: { id: string; name: string } | null;
    opponent: string | null;
    isHome: boolean | null;
    shiftGroup: {
      shifts: Array<{
        area: string;
        startsAt: Date;
        assignments: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>;
      }>;
    } | null;
  }>, "upcomingEvents", partialFailures);
  const myReservations = settledValue(myReservationsResult, bookingRowsFallback, "myReservations", partialFailures);
  const topOverdue = settledValue(topOverdueResult, [] as Array<{
    id: string;
    title: string;
    requesterUserId: string;
    requester: { name: string; avatarUrl: string | null };
    serializedItems: Array<{ asset: { id: string; assetTag: string; name: string | null; imageUrl: string | null } }>;
    endsAt: Date;
  }>, "topOverdue", partialFailures);
  const myDrafts = settledValue(myDraftsResult, [] as Array<{
    id: string;
    kind: string;
    title: string;
    updatedAt: Date;
    _count: { serializedItems: number; bulkItems: number };
  }>, "myDrafts", partialFailures);
  const pendingPickupsRaw = settledValue(pendingPickupsRawResult, bookingRowsFallback, "pendingPickups", partialFailures);
  const myShiftsRaw = settledValue(myShiftsRawResult, [] as Array<{
    id: string;
    shift: {
      area: string;
      workerType: string;
      startsAt: Date;
      endsAt: Date;
      shiftGroup: {
        event: {
          id: string;
          summary: string;
          startsAt: Date;
          endsAt: Date;
          sportCode: string | null;
          opponent: string | null;
          isHome: boolean | null;
          locationId: string | null;
          location: { id: string; name: string } | null;
        };
      };
    };
  }>, "myShifts", partialFailures);
  const recentReports = settledValue(recentReportsResult, [] as Array<{
    id: string;
    type: string;
    imageUrl: string | null;
    createdAt: Date;
    asset: { id: string; assetTag: string; name: string | null };
    booking: { title: string };
    reportedBy: { name: string };
  }>, "recentReports", partialFailures);
  const maintenanceAssets = settledValue(maintenanceAssetsResult, [] as Array<{
    id: string;
    assetTag: string;
    name: string | null;
    updatedAt: Date;
  }>, "maintenanceAssets", partialFailures);
  const lostBulkUnitsRaw = settledValue(lostBulkUnitsRawResult, [] as Array<{
    bulkSkuId: string;
    _count: { id: number };
  }>, "lostBulkUnits", partialFailures);

  const shiftEventIds = [...new Set(myShiftsRaw.map((a) => a.shift.shiftGroup.event.id))];
  const lostSkuIds = lostBulkUnitsRaw.map((r) => r.bulkSkuId);

  // Run the two post-parallel dependent queries concurrently
  const [shiftGearBookingsResult, lostBulkSkuNamesResult] = await Promise.allSettled([
    shiftEventIds.length > 0
      ? db.booking.findMany({
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
      : Promise.resolve([]),
    lostSkuIds.length > 0
      ? db.bulkSku.findMany({
          where: { id: { in: lostSkuIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const shiftGearBookings = settledValue(shiftGearBookingsResult, [] as Array<{
    eventId: string | null;
    status: string;
    serializedItems: Array<{ asset: { id: string; name: string | null; imageUrl: string | null; category: { name: string } | null } }>;
    _count: { serializedItems: number; bulkItems: number };
  }>, "shiftGearBookings", partialFailures);
  const lostBulkSkuNames = settledValue(lostBulkSkuNamesResult, [] as Array<{
    id: string;
    name: string;
  }>, "lostBulkSkuNames", partialFailures);

  // Resolve lost bulk unit SKU names
  let lostBulkUnits: Array<{ skuName: string; count: number }> = [];
  if (lostBulkUnitsRaw.length > 0) {
    const nameMap = new Map(lostBulkSkuNames.map((s) => [s.id, s.name]));
    lostBulkUnits = lostBulkUnitsRaw.map((r) => ({
      skuName: nameMap.get(r.bulkSkuId) ?? "Unknown",
      count: r._count.id,
    }));
  }

  const c = counts[0];
  if (!c) throw new HttpError(500, "Dashboard counts query returned no rows");
  const teamCheckoutsTotalCount = Number(c.team_checkouts);
  const teamCheckoutsOverdueCount = Number(c.team_checkouts_overdue);
  const teamReservationsTotalCount = Number(c.team_reservations);
  const myCheckoutsTotalCount = Number(c.my_checkouts);
  const myOverdueCount = Number(c.my_overdue);
  const totalCheckedOut = Number(c.total_checked_out);
  const totalOverdue = Number(c.total_overdue);
  const totalReserved = Number(c.total_reserved);
  const dueTodayCount = Number(c.due_today);
  const pendingPickupTotalCount = Number(c.pending_pickup);
  const staleReservationTotalCount = Number(c.stale_reservations);

  const teamCheckouts = teamCheckoutsRaw.map((c) => toBookingSummary(c, now, true));
  teamCheckouts.sort(sortOverdueFirst);

  const teamReservations = teamReservationsRaw.map((r) => toBookingSummary(r, now, false));

  const staleReservations = staleReservationsRaw.map((r) => toBookingSummary(r, now, true));
  staleReservations.sort(sortOverdueFirst);

  const myCheckouts = myCheckoutsRaw.map((c) => toBookingSummary(c, now, true));
  myCheckouts.sort(sortOverdueFirst);

  // Pending pickups: surface those whose start time has passed first (student
  // is late picking up), then upcoming pickups by earliest start.
  const pendingPickups = pendingPickupsRaw.map((p) => toBookingSummary(p, now, false));
  pendingPickups.sort((a, b) => {
    const aLate = new Date(a.startsAt) < now;
    const bLate = new Date(b.startsAt) < now;
    if (aLate !== bLate) return aLate ? -1 : 1;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });

  const events = upcomingEvents.map((e) => {
    // Collect assigned users across all shifts (include shift area for tooltip)
    const shifts = e.shiftGroup?.shifts ?? [];
    const totalShiftSlots = shifts.length;
    const filledShiftSlots = shifts.filter((s) => s.assignments.length > 0).length;
    const coverage = totalShiftSlots > 0
      ? {
          total: totalShiftSlots,
          filled: filledShiftSlots,
          percentage: Math.round((filledShiftSlots / totalShiftSlots) * 100),
        }
      : null;
    const earliestShift = shifts.reduce<Date | null>((earliest, shift) => {
      if (!earliest || shift.startsAt < earliest) return shift.startsAt;
      return earliest;
    }, null);
    const seenUserIds = new Set<string>();
    const assignedUsers: Array<{ id: string; name: string; avatarUrl: string | null; area: string | null }> = [];
    for (const shift of shifts) {
      for (const a of shift.assignments) {
        if (!seenUserIds.has(a.user.id)) {
          seenUserIds.add(a.user.id);
          assignedUsers.push({
            id: a.user.id,
            name: a.user.name,
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
      coverage,
      callTime: e.isHome === true && earliestShift ? earliestShift.toISOString() : null,
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
    requesterAvatarUrl: b.requester.avatarUrl ?? null,
    assetTags: b.serializedItems.map((si) => si.asset.assetTag),
    endsAt: b.endsAt.toISOString(),
    items: b.serializedItems.map((si) => ({
      id: si.asset.id,
      name: si.asset.name,
      imageUrl: si.asset.imageUrl,
    })),
  }));

  // Build my shifts with gear status
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
      pendingPickups: {
        total: pendingPickupTotalCount,
        items: pendingPickups,
      },
      staleReservations: {
        total: staleReservationTotalCount,
        items: staleReservations,
      },
      upcomingEvents: events,
      myReservations: myReservations.map((r) => {
        return toBookingSummary(r, now, false);
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
          imageUrl: r.imageUrl ?? null,
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
      partialFailures,
    },
  });
});
