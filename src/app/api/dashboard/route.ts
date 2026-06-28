import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { getInitials } from "@/lib/avatar";
import { checkRateLimit } from "@/lib/rate-limit";
import { shiftWorkerLabel } from "@/lib/shift-display";
import { readDashboardCounts, zeroDashboardCounts } from "@/lib/services/dashboard-counts";
import { startOfDayInAppTz } from "@/lib/app-time";

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
  eventId: string | null;
  sportCode: string | null;
  events?: Array<{ eventId: string }>;
  shiftAssignment?: { shift: { shiftGroup: { eventId: string } } } | null;
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
  const eventIds = bookingEventIds(c);
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    refNumber: c.refNumber,
    eventId: c.eventId ?? null,
    eventIds,
    linkedEventId: c.shiftAssignment?.shift.shiftGroup.eventId ?? c.eventId ?? eventIds[0] ?? null,
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

function bookingEventIds(c: {
  eventId: string | null;
  events?: Array<{ eventId: string }>;
  shiftAssignment?: { shift: { shiftGroup: { eventId: string } } } | null;
}) {
  const ids = new Set<string>();
  if (c.eventId) ids.add(c.eventId);
  for (const event of c.events ?? []) ids.add(event.eventId);
  const shiftEventId = c.shiftAssignment?.shift.shiftGroup.eventId;
  if (shiftEventId) ids.add(shiftEventId);
  return [...ids];
}

function gearStatusForBooking(status: string) {
  if (status === "OPEN") return "checked_out";
  if (status === "PENDING_PICKUP") return "pickup_ready";
  if (status === "BOOKED") return "reserved";
  return "draft";
}

function gearStatusPriority(status: string) {
  switch (status) {
    case "pickup_ready":
      return 4;
    case "checked_out":
      return 3;
    case "reserved":
      return 2;
    case "draft":
      return 1;
    default:
      return 0;
  }
}

export const GET = withAuth(async (req, { user }) => {
  const { allowed } = await checkRateLimit(`dashboard:full:${user.id}`, DASHBOARD_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");

  const scope = new URL(req.url).searchParams.get("scope");
  const isIosHomeScope = scope === "ios-home";
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Day bounds in the institution timezone, not the server's UTC. Drives the
  // "due today" count and the "today's events" lower bound — events stay listed
  // until local midnight (a 7pm game is still shown at 9pm) and all-day events
  // (which start at midnight) don't vanish the instant the day begins.
  const startOfToday = startOfDayInAppTz(now, 0);
  const startOfTomorrow = startOfDayInAppTz(now, 1);

  const bookingInclude = {
    requester: { select: { id: true, name: true, avatarUrl: true } },
    location: { select: { id: true, name: true } },
    events: { select: { eventId: true } },
    shiftAssignment: {
      select: {
        shift: {
          select: {
            shiftGroup: { select: { eventId: true } },
          },
        },
      },
    },
    _count: { select: { serializedItems: true, bulkItems: true } },
    serializedItems: {
      take: 3,
      include: { asset: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } } },
    },
  } as const;

  // Shared bounded count aggregate — same reader the lightweight stats endpoint
  // uses, so transient-lane totals can never drift between the two routes.
  const countsPromise = readDashboardCounts({
    userId: user.id,
    now,
    sevenDaysFromNow,
    startOfToday,
    startOfTomorrow,
  });

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
    isIosHomeScope
      ? Promise.resolve([])
      : db.booking.findMany({
          where: { kind: "CHECKOUT", status: "OPEN", requesterUserId: { not: user.id } },
          orderBy: { endsAt: "asc" },
          take: 5,
          include: bookingInclude,
        }),
    // Team reservations (excl. me) — next 7 days only (AC-4)
    isIosHomeScope
      ? Promise.resolve([])
      : db.booking.findMany({
          where: { kind: "RESERVATION", status: "BOOKED", requesterUserId: { not: user.id }, startsAt: { gte: now, lte: sevenDaysFromNow } },
          orderBy: { startsAt: "asc" },
          take: 5,
          include: bookingInclude,
        }),
    // Stale reservations — planning cleanup, not checkout custody overdue
    isIosHomeScope
      ? Promise.resolve([])
      : db.booking.findMany({
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
    // Upcoming events (with shift assignment data). Keep any event that occurs
    // today visible until local midnight (endsAt > start of today), so an
    // all-day event doesn't vanish at 12:00am and a 7pm game isn't hidden the
    // moment it ends. Encoding-independent for all-day events.
    isIosHomeScope
      ? Promise.resolve([])
      : db.calendarEvent.findMany({
          where: {
            startsAt: { lte: sevenDaysFromNow },
            endsAt: { gt: startOfToday },
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
      include: bookingInclude,
    }),
    // Top overdue for banner — all roles see all overdue
    isIosHomeScope
      ? Promise.resolve([])
      : db.booking.findMany({
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
    isIosHomeScope && user.role === "STUDENT"
      ? Promise.resolve([])
      : db.booking.findMany({
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
            // Keep a shift on today's events listed until local midnight.
            event: { endsAt: { gt: startOfToday }, status: "CONFIRMED" },
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
                    allDay: true,
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
  const bookingRowsFallback: Array<Parameters<typeof toBookingSummary>[0]> = [];
  const counts = settledValue(countsResult, zeroDashboardCounts, "counts", partialFailures);
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
    callStartsAt: Date | null;
    callEndsAt: Date | null;
    callNote: string | null;
    shift: {
      area: string;
      workerType: string;
      startsAt: Date;
      endsAt: Date;
      callStartsAt: Date | null;
      callEndsAt: Date | null;
      shiftGroup: {
        event: {
          id: string;
          summary: string;
          startsAt: Date;
          endsAt: Date;
          allDay: boolean;
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
            status: { in: ["DRAFT", "BOOKED", "PENDING_PICKUP", "OPEN"] },
            OR: [
              { eventId: { in: shiftEventIds } },
              { events: { some: { eventId: { in: shiftEventIds } } } },
              { shiftAssignmentId: { in: myShiftsRaw.map((a) => a.id) } },
              { shiftAssignment: { shift: { shiftGroup: { eventId: { in: shiftEventIds } } } } },
            ],
          },
          orderBy: [{ startsAt: "asc" }],
          include: bookingInclude,
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
    id: string;
    kind: string;
    title: string;
    refNumber: string | null;
    eventId: string | null;
    sportCode: string | null;
    events?: Array<{ eventId: string }>;
    shiftAssignment?: { shift: { shiftGroup: { eventId: string } } } | null;
    requester: { name: string; avatarUrl: string | null };
    requesterUserId: string;
    location?: { name: string } | null;
    startsAt: Date;
    endsAt: Date;
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

  const teamCheckoutsTotalCount = counts.teamCheckoutsTotal;
  const teamCheckoutsOverdueCount = counts.teamCheckoutsOverdue;
  const teamReservationsTotalCount = counts.teamReservationsTotal;
  const myCheckoutsTotalCount = counts.myCheckoutsTotal;
  const myOverdueCount = counts.myOverdue;
  const totalCheckedOut = counts.totalCheckedOut;
  const totalOverdue = counts.totalOverdue;
  const totalReserved = counts.totalReserved;
  const dueTodayCount = counts.dueToday;
  const pendingPickupTotalCount = counts.pendingPickupTotal;
  const staleReservationTotalCount = counts.staleReservationTotal;

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

  const shiftEventIdSet = new Set(shiftEventIds);
  const shiftGearSummaries = shiftGearBookings.map((b) => toBookingSummary(b, now, false));

  // Build event-linked gear from every durable relationship path. Home should
  // receive one event work item, not infer "same event" from row titles.
  const gearByEvent = new Map<string, ReturnType<typeof toBookingSummary>[]>();
  for (const b of shiftGearBookings) {
    const summary = shiftGearSummaries.find((candidate) => candidate.id === b.id);
    if (!summary) continue;
    for (const eventId of bookingEventIds(b)) {
      if (!shiftEventIdSet.has(eventId)) continue;
      const rows = gearByEvent.get(eventId) ?? [];
      rows.push(summary);
      rows.sort((a, b) => {
        const statusDelta = gearStatusPriority(gearStatusForBooking(b.status)) - gearStatusPriority(gearStatusForBooking(a.status));
        if (statusDelta !== 0) return statusDelta;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
      gearByEvent.set(eventId, rows);
    }
  }

  const myShifts = myShiftsRaw.map((a) => {
    const ev = a.shift.shiftGroup.event;
    const primaryGear = gearByEvent.get(ev.id)?.[0] ?? null;
    const primaryGearStatus = primaryGear ? gearStatusForBooking(primaryGear.status) : "none";
    return {
      id: a.id,
      area: a.shift.area,
      workerType: a.shift.workerType,
      workerLabel: shiftWorkerLabel(a.shift.workerType),
      startsAt: a.shift.startsAt.toISOString(),
      endsAt: a.shift.endsAt.toISOString(),
      callStartsAt: (a.callStartsAt ?? a.shift.callStartsAt ?? a.shift.startsAt).toISOString(),
      callEndsAt: (a.callEndsAt ?? a.shift.callEndsAt ?? a.shift.endsAt).toISOString(),
      callNote: a.callNote,
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
      gearStatus: primaryGearStatus,
      gearItems: primaryGear?.items ?? [],
      gearItemCount: primaryGear?.itemCount ?? 0,
    };
  });

  const assignmentByEvent = new Map<string, (typeof myShiftsRaw)[number]>();
  for (const assignment of myShiftsRaw) {
    const eventId = assignment.shift.shiftGroup.event.id;
    const current = assignmentByEvent.get(eventId);
    if (!current || assignment.shift.startsAt < current.shift.startsAt) {
      assignmentByEvent.set(eventId, assignment);
    }
  }

  const myEventWork = [...assignmentByEvent.values()].map((a) => {
    const ev = a.shift.shiftGroup.event;
    const gearBookings = gearByEvent.get(ev.id) ?? [];
    const primaryGear = gearBookings[0] ?? null;
    return {
      id: ev.id,
          event: {
            id: ev.id,
            summary: ev.summary,
            startsAt: ev.startsAt.toISOString(),
            endsAt: ev.endsAt.toISOString(),
            allDay: ev.allDay,
            sportCode: ev.sportCode,
            opponent: ev.opponent,
            isHome: ev.isHome,
        locationId: ev.locationId,
        locationName: ev.location?.name ?? null,
      },
      shift: {
        id: a.id,
        area: a.shift.area,
        workerType: a.shift.workerType,
        workerLabel: shiftWorkerLabel(a.shift.workerType),
        startsAt: a.shift.startsAt.toISOString(),
        endsAt: a.shift.endsAt.toISOString(),
        callStartsAt: (a.callStartsAt ?? a.shift.callStartsAt ?? a.shift.startsAt).toISOString(),
        callEndsAt: (a.callEndsAt ?? a.shift.callEndsAt ?? a.shift.endsAt).toISOString(),
        callNote: a.callNote,
      },
      gearStatus: primaryGear ? gearStatusForBooking(primaryGear.status) : "none",
      gearBookings,
      needsGear: gearBookings.every((booking) => (
        booking.status !== "BOOKED"
        && booking.status !== "PENDING_PICKUP"
        && booking.status !== "OPEN"
      )),
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
      myEventWork,
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
