import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftAssignmentStatus } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  calendarEvent: {
    findMany: vi.fn(),
  },
  calendarSource: {
    findMany: vi.fn(),
  },
  shiftTrade: {
    count: vi.fn(),
  },
}));

const healthMock = vi.hoisted(() => ({
  getScheduleHealth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/services/schedule-health", () => healthMock);

import { getScheduleAutomationDigest } from "@/lib/services/schedule-automation";

describe("getScheduleAutomationDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthMock.getScheduleHealth.mockResolvedValue({
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
        openSlots: { count: 2, eventCount: 1, eventIds: ["event-open"] },
        eventsWithoutCrew: { count: 1, eventCount: 1, eventIds: ["event-empty"] },
        coveredEvents: { count: 1, eventCount: 1, eventIds: ["event-ready"], totalVisibleEvents: 3 },
        myShifts: { count: 0, eventCount: 0, eventIds: [] },
        pendingRequests: { count: 1, eventCount: 1, eventIds: ["event-open"] },
        conflicts: { count: 1, eventCount: 1, eventIds: ["event-ready"] },
        openTrades: { count: 0 },
        tradeApprovals: { count: 0 },
        gearGaps: { count: 1, eventCount: 1, eventIds: ["event-ready"] },
        dataQuality: { count: 0, eventCount: 0, eventIds: [], issues: [] },
        hiddenEvents: { count: 0 },
        archivedEvents: { count: 0 },
      },
      partialFailures: ["gearGaps"],
    });
    dbMock.calendarSource.findMany.mockResolvedValue([
      {
        id: "source-stale",
        name: "Stale Feed",
        enabled: true,
        lastFetchedAt: new Date("2026-06-16T00:00:00.000Z"),
        lastError: null,
      },
      {
        id: "source-error",
        name: "Broken Feed",
        enabled: true,
        lastFetchedAt: new Date("2026-06-18T00:00:00.000Z"),
        lastError: "HTTP 500",
      },
    ]);
    dbMock.shiftTrade.count.mockResolvedValue(2);
    dbMock.calendarEvent.findMany.mockResolvedValue([
      {
        id: "event-ready",
        sourceId: "source-stale",
        startsAt: new Date("2026-06-20T18:00:00.000Z"),
        endsAt: new Date("2026-06-20T21:00:00.000Z"),
        shiftGroup: {
          publishedAt: null,
          publishedById: null,
          lastPublishedSnapshot: null,
          shifts: [
            {
              id: "shift-ready",
              area: "VIDEO",
              workerType: "ST",
              startsAt: new Date("2026-06-20T17:00:00.000Z"),
              endsAt: new Date("2026-06-20T21:30:00.000Z"),
              callStartsAt: null,
              callEndsAt: null,
              assignments: [
                {
                  id: "assignment-ready",
                  userId: "student-1",
                  status: ShiftAssignmentStatus.DIRECT_ASSIGNED,
                  callStartsAt: null,
                  callEndsAt: null,
                  callNote: null,
                  acknowledgedAt: null,
                  hasConflict: true,
                },
              ],
            },
          ],
        },
      },
      {
        id: "event-open",
        sourceId: "source-error",
        startsAt: new Date("2026-06-21T18:00:00.000Z"),
        endsAt: new Date("2026-06-21T21:00:00.000Z"),
        shiftGroup: {
          publishedAt: null,
          publishedById: null,
          lastPublishedSnapshot: null,
          shifts: [
            {
              id: "shift-open",
              area: "PHOTO",
              workerType: "ST",
              startsAt: new Date("2026-06-21T17:00:00.000Z"),
              endsAt: new Date("2026-06-21T21:30:00.000Z"),
              callStartsAt: null,
              callEndsAt: null,
              assignments: [],
            },
          ],
        },
      },
    ]);
  });

  it("summarizes review-first automation cards from schedule state", async () => {
    const digest = await getScheduleAutomationDigest({
      userId: "staff-1",
      includePast: false,
      includeArchived: false,
      sportCode: null,
      now: new Date("2026-06-18T12:00:00.000Z"),
      maintenance: {
        syncResults: [{ eventsAdded: 1, eventsUpdated: 2, groupsCreated: 1, shiftsCreated: 4 }],
        shiftGroupsArchived: 3,
        eventsArchived: 1,
        tradesExpired: 2,
        pendingPickupsExpired: 1,
      },
    });

    expect(digest.metrics).toMatchObject({
      openSlots: 2,
      eventsWithoutCrew: 1,
      pendingRequests: 1,
      conflicts: 1,
      gearGaps: 1,
      readyToPublish: 1,
      autoFillCandidates: 1,
      staleSources: 1,
      sourceErrors: 1,
      staleTrades: 2,
      syncEventsAdded: 1,
      syncEventsUpdated: 2,
      syncGroupsCreated: 1,
      syncShiftsCreated: 4,
      shiftGroupsArchived: 3,
      eventsArchived: 1,
      tradesExpired: 2,
      pendingPickupsExpired: 1,
    });
    expect(digest.cards.find((card) => card.id === "staffing")?.action).toEqual({
      label: "Open queue",
      queue: "needs-staffing",
    });
    expect(digest.cards.find((card) => card.id === "auto-fill")?.action).toEqual({
      label: "Open assign",
      href: "/schedule/assign",
    });
    expect(digest.cards.find((card) => card.id === "publish")?.action?.href).toBe("/events/event-ready");
    expect(digest.cards.find((card) => card.id === "sources")?.action?.href).toBe("/settings/calendar-sources");
    expect(digest.partialFailures).toEqual(["gearGaps"]);
  });
});
