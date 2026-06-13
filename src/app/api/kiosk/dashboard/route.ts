import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { getInitials } from "@/lib/avatar";
import { env } from "@/lib/env";
import { BookingKind, BookingStatus, ShiftAssignmentStatus } from "@prisma/client";

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  partialFailures: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[kiosk/dashboard] ${label} failed`, result.reason);
  partialFailures.push(label);
  return fallback;
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  return new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));
}

function dayWindowInTimeZone(now: Date, days: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const start = zonedDateTimeToUtc(value("year"), value("month"), value("day"), 0, 0, 0, 0, timeZone);
  const endLocal = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + days, 0, 0, 0, 0));
  const end = zonedDateTimeToUtc(
    endLocal.getUTCFullYear(),
    endLocal.getUTCMonth() + 1,
    endLocal.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone,
  );
  return { start, end };
}

/** Kiosk idle screen data: stats, nearby events, active items, and active checkouts. */
export const GET = withKiosk(async (_req, { kiosk }) => {
  const now = new Date();
  const nearPast = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const nearFuture = new Date(now.getTime() + 90 * 60 * 1000);
  const eventsWindow = dayWindowInTimeZone(now, 2, env.appTimezone);
  const nightHours = now.getHours() >= 22 || now.getHours() < 6;

  const [statsResult, eventsResult, activeItemsResult, checkoutsResult, operationalWindowsResult] = await Promise.allSettled([
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

    // Today and tomorrow in the institution timezone for the counter display.
    db.calendarEvent.findMany({
      where: {
        startsAt: { lt: eventsWindow.end },
        endsAt: { gte: eventsWindow.start },
        isHidden: false,
      },
      orderBy: { startsAt: "asc" },
      take: 8,
      select: {
        id: true,
        summary: true,
        sportCode: true,
        startsAt: true,
        endsAt: true,
        shiftGroup: {
          select: {
            shifts: {
              select: {
                area: true,
                callStartsAt: true,
                callEndsAt: true,
                startsAt: true,
                endsAt: true,
                assignments: {
                  where: {
                    status: {
                      in: [
                        ShiftAssignmentStatus.DIRECT_ASSIGNED,
                        ShiftAssignmentStatus.APPROVED,
                        ShiftAssignmentStatus.REQUESTED,
                      ],
                    },
                  },
                  select: {
                    user: { select: { id: true, name: true, avatarUrl: true } },
                  },
                },
              },
            },
            _count: {
              select: { shifts: true },
            },
          },
        },
      },
    }),

    // Active serialized items at this kiosk's location for the Items Out card.
    db.bookingSerializedItem.findMany({
      where: {
        allocationStatus: "active",
        booking: {
          kind: BookingKind.CHECKOUT,
          status: BookingStatus.OPEN,
          locationId: kiosk.locationId,
        },
      },
      orderBy: { booking: { endsAt: "asc" } },
      take: 24,
      select: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            imageUrl: true,
          },
        },
        booking: {
          select: {
            id: true,
            title: true,
            endsAt: true,
            requester: { select: { name: true } },
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

    Promise.all([
      db.calendarEvent.count({
        where: {
          startsAt: { lte: nearFuture },
          endsAt: { gte: nearPast },
          isHidden: false,
        },
      }),
      db.booking.count({
        where: {
          kind: BookingKind.CHECKOUT,
          status: { in: [BookingStatus.BOOKED, BookingStatus.PENDING_PICKUP] },
          locationId: kiosk.locationId,
          startsAt: { lte: nearFuture },
          endsAt: { gte: nearPast },
        },
      }),
    ]),
  ]);

  const partialFailures: string[] = [];
  const statsRows = settledValue(
    statsResult,
    [] as Array<{ checkouts: bigint; items_out: bigint; overdue: bigint }>,
    "stats",
    partialFailures,
  );
  const events = settledValue(
    eventsResult,
    [] as Array<{
      id: string;
      summary: string;
      sportCode: string | null;
      startsAt: Date;
      endsAt: Date;
      shiftGroup: {
        shifts: Array<{
          area: string;
          callStartsAt: Date | null;
          callEndsAt: Date | null;
          startsAt: Date;
          endsAt: Date;
          assignments: Array<{
            user: { id: string; name: string; avatarUrl: string | null };
          }>;
        }>;
        _count: { shifts: number };
      } | null;
    }>,
    "events",
    partialFailures,
  );
  const checkouts = settledValue(
    checkoutsResult,
    [] as Array<{
      id: string;
      title: string;
      endsAt: Date;
      requester: { id: string; name: string; avatarUrl: string | null };
      serializedItems: Array<{ asset: { assetTag: string; name: string | null } }>;
      _count: { serializedItems: number };
    }>,
    "checkouts",
    partialFailures,
  );
  const activeItems = settledValue(
    activeItemsResult,
    [] as Array<{
      asset: { id: string; assetTag: string; name: string | null; imageUrl: string | null };
      booking: { id: string; title: string; endsAt: Date; requester: { name: string } };
    }>,
    "active items",
    partialFailures,
  );
  const [nearbyEventCount, nearbyBookingWindowCount] = settledValue(
    operationalWindowsResult,
    [0, 0] as [number, number],
    "operational windows",
    partialFailures,
  );

  const stats = {
    itemsOut: Number(statsRows[0]?.items_out ?? 0),
    checkouts: Number(statsRows[0]?.checkouts ?? 0),
    overdue: Number(statsRows[0]?.overdue ?? 0),
  };
  const noActiveWork =
    stats.checkouts === 0 &&
    stats.itemsOut === 0 &&
    nearbyEventCount === 0 &&
    nearbyBookingWindowCount === 0;
  const sleepMode = nightHours || noActiveWork;

  return ok({
    stats,
    capabilities: {
      eventWorkerDetails: true,
      eventCallTimes: true,
    },
    standby: {
      sleepMode,
      reason: nightHours ? "night_hours" : noActiveWork ? "idle_window" : "active_window",
      nightHours,
      nearbyEventCount,
      nearbyBookingWindowCount,
    },
    events: events.map((e) => {
      const seenUserIds = new Set<string>();
      const shifts = e.shiftGroup?.shifts ?? [];
      const callStartsAt = shifts.reduce<Date | null>((earliest, shift) => {
        const value = shift.callStartsAt ?? shift.startsAt;
        if (!earliest || value < earliest) return value;
        return earliest;
      }, null);
      const callEndsAt = shifts.reduce<Date | null>((latest, shift) => {
        const value = shift.callEndsAt ?? shift.endsAt;
        if (!latest || value > latest) return value;
        return latest;
      }, null);
      const assignedUsers: Array<{
        id: string;
        name: string;
        initials: string;
        avatarUrl: string | null;
        area: string | null;
        callStartsAt: Date | null;
        callEndsAt: Date | null;
      }> = [];
      for (const shift of shifts) {
        for (const assignment of shift.assignments) {
          if (seenUserIds.has(assignment.user.id)) continue;
          seenUserIds.add(assignment.user.id);
          assignedUsers.push({
            id: assignment.user.id,
            name: assignment.user.name,
            initials: getInitials(assignment.user.name),
            avatarUrl: assignment.user.avatarUrl,
            area: shift.area,
            callStartsAt: shift.callStartsAt ?? shift.startsAt,
            callEndsAt: shift.callEndsAt ?? shift.endsAt,
          });
        }
      }
      return {
        id: e.id,
        title: e.summary,
        sportCode: e.sportCode,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        callStartsAt,
        callEndsAt,
        shiftCount: e.shiftGroup?._count.shifts ?? 0,
        assignedUsers,
        assignedUserCount: assignedUsers.length,
      };
    }),
    activeItems: activeItems.map((entry) => ({
      id: entry.asset.id,
      name: entry.asset.name || entry.asset.assetTag,
      tagName: entry.asset.assetTag,
      imageUrl: entry.asset.imageUrl,
      checkoutId: entry.booking.id,
      checkoutTitle: entry.booking.title,
      requesterName: entry.booking.requester.name,
      endsAt: entry.booking.endsAt,
      isOverdue: entry.booking.endsAt < now,
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
    partialFailures,
  });
});
