import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "@/app/(app)/schedule/_components/types";
import type { ScheduleHealthSnapshot } from "@/lib/schedule-health-types";
import {
  filterEntriesForScheduleQueue,
  parseScheduleQueue,
} from "@/lib/schedule-queues";

function entry(overrides: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: "event",
    summary: "Event",
    startsAt: "2026-07-10T15:00:00.000Z",
    endsAt: "2026-07-10T17:00:00.000Z",
    allDay: false,
    status: "CONFIRMED",
    rawLocationText: null,
    sportCode: null,
    opponent: null,
    isHome: null,
    subtitle: null,
    location: null,
    source: null,
    shiftGroupId: null,
    coverage: null,
    shifts: [],
    ...overrides,
  };
}

function health(eventIds: Partial<Record<keyof ScheduleHealthSnapshot["queues"], string[]>>): ScheduleHealthSnapshot {
  return {
    window: {
      startsAt: null,
      endsAt: null,
      includePast: false,
      includeArchived: false,
      sportCode: null,
    },
    nextCall: {
      eventId: null,
      summary: null,
      startsAt: null,
      label: "No upcoming calls",
    },
    queues: {
      openSlots: { count: 0, eventIds: eventIds.openSlots },
      eventsWithoutCrew: { count: 0, eventIds: eventIds.eventsWithoutCrew },
      coveredEvents: { count: 0, totalVisibleEvents: 0 },
      myShifts: { count: 0, eventIds: eventIds.myShifts },
      pendingRequests: { count: 0, eventIds: eventIds.pendingRequests },
      conflicts: { count: 0, eventIds: eventIds.conflicts },
      openTrades: { count: 0 },
      tradeApprovals: { count: 0 },
      gearGaps: { count: 0, eventIds: eventIds.gearGaps },
      dataQuality: { count: 0, eventIds: eventIds.dataQuality, issues: [] },
      hiddenEvents: { count: 0 },
      archivedEvents: { count: 0 },
    },
    gearReadiness: {
      events: {},
      assignments: {},
      queues: {
        missingGear: { count: 0 },
        unlinkedAssignmentGear: { count: 0 },
      },
    },
    changeHistory: { events: {} },
    partialFailures: [],
  };
}

describe("schedule queues", () => {
  it("parses only supported queue names", () => {
    expect(parseScheduleQueue("needs-staffing")).toBe("needs-staffing");
    expect(parseScheduleQueue("gear-gaps")).toBe("gear-gaps");
    expect(parseScheduleQueue("data-quality")).toBe("data-quality");
    expect(parseScheduleQueue("unknown")).toBeNull();
    expect(parseScheduleQueue(null)).toBeNull();
  });

  it("filters staffing queue by health event ids, including no-crew events", () => {
    const entries = [entry({ id: "covered" }), entry({ id: "open" }), entry({ id: "no-crew" })];

    const filtered = filterEntriesForScheduleQueue({
      entries,
      queue: "needs-staffing",
      health: health({
        openSlots: ["open"],
        eventsWithoutCrew: ["no-crew"],
      }),
    });

    expect(filtered.map((item) => item.id)).toEqual(["open", "no-crew"]);
  });

  it("filters risk queues by health event ids", () => {
    const entries = [entry({ id: "normal" }), entry({ id: "conflict" }), entry({ id: "gear" }), entry({ id: "quality" })];

    expect(filterEntriesForScheduleQueue({
      entries,
      queue: "conflicts",
      health: health({ conflicts: ["conflict"] }),
    }).map((item) => item.id)).toEqual(["conflict"]);

    expect(filterEntriesForScheduleQueue({
      entries,
      queue: "gear-gaps",
      health: health({ gearGaps: ["gear"] }),
    }).map((item) => item.id)).toEqual(["gear"]);

    expect(filterEntriesForScheduleQueue({
      entries,
      queue: "data-quality",
      health: health({ dataQuality: ["quality"] }),
    }).map((item) => item.id)).toEqual(["quality"]);
  });

  it("filters my calls today from active assignment call windows", () => {
    const entries = [
      entry({
        id: "mine-today",
        shifts: [{
          id: "shift-1",
          area: "VIDEO",
          workerType: "ST",
          startsAt: "2026-07-10T15:00:00.000Z",
          endsAt: "2026-07-10T17:00:00.000Z",
          callStartsAt: "2026-07-10T14:30:00.000Z",
          callEndsAt: null,
          notes: null,
          assignments: [{
            id: "assignment-1",
            status: "APPROVED",
            user: { id: "user-1", name: "A", role: "STUDENT", primaryArea: null },
          }],
        }],
      }),
      entry({
        id: "mine-tomorrow",
        shifts: [{
          id: "shift-2",
          area: "VIDEO",
          workerType: "ST",
          startsAt: "2026-07-11T15:00:00.000Z",
          endsAt: "2026-07-11T17:00:00.000Z",
          callStartsAt: "2026-07-11T14:30:00.000Z",
          callEndsAt: null,
          notes: null,
          assignments: [{
            id: "assignment-2",
            status: "APPROVED",
            user: { id: "user-1", name: "A", role: "STUDENT", primaryArea: null },
          }],
        }],
      }),
    ];

    const filtered = filterEntriesForScheduleQueue({
      entries,
      queue: "my-calls-today",
      currentUserId: "user-1",
      now: new Date("2026-07-10T12:00:00.000Z"),
    });

    expect(filtered.map((item) => item.id)).toEqual(["mine-today"]);
  });

  it("filters stale-source queue to entries from unhealthy sources", () => {
    const entries = [
      entry({ id: "healthy", source: { id: "source-1", name: "Good" } }),
      entry({ id: "stale", source: { id: "source-2", name: "Old" } }),
      entry({ id: "manual", source: null }),
    ];

    const filtered = filterEntriesForScheduleQueue({
      entries,
      queue: "stale-source",
      staleSourceIds: new Set(["source-2"]),
    });

    expect(filtered.map((item) => item.id)).toEqual(["stale"]);
  });
});
