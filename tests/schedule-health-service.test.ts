import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus, ShiftAssignmentStatus } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  calendarEvent: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  shiftTrade: {
    count: vi.fn(),
  },
  booking: {
    findMany: vi.fn(),
  },
  shiftGroup: {
    findMany: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { getScheduleHealth } from "@/lib/services/schedule-health";

describe("getScheduleHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.calendarEvent.findMany.mockResolvedValue([]);
    dbMock.calendarEvent.count.mockResolvedValue(0);
    dbMock.shiftTrade.count.mockResolvedValue(0);
    dbMock.booking.findMany.mockResolvedValue([]);
    dbMock.shiftGroup.findMany.mockResolvedValue([]);
    dbMock.auditLog.findMany.mockResolvedValue([]);
  });

  it("summarizes staffing, requests, conflicts, trades, visibility, and gear gaps", async () => {
    dbMock.calendarEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        summary: "Women's Basketball",
        startsAt: new Date("2026-07-10T18:00:00Z"),
        endsAt: new Date("2026-07-10T21:00:00Z"),
        allDay: false,
        shiftGroup: {
          shifts: [
            {
              id: "shift-1",
              startsAt: new Date("2026-07-10T17:00:00Z"),
              callStartsAt: new Date("2026-07-10T16:30:00Z"),
              assignments: [
                {
                  id: "assignment-1",
                  userId: "user-1",
                  status: ShiftAssignmentStatus.DIRECT_ASSIGNED,
                  hasConflict: true,
                  callStartsAt: null,
                },
                {
                  id: "assignment-2",
                  userId: "user-2",
                  status: ShiftAssignmentStatus.REQUESTED,
                  hasConflict: false,
                  callStartsAt: null,
                },
              ],
            },
            {
              id: "shift-2",
              startsAt: new Date("2026-07-10T17:00:00Z"),
              callStartsAt: null,
              assignments: [],
            },
          ],
        },
      },
      {
        id: "event-2",
        summary: "Manual meeting",
        startsAt: new Date("2026-07-11T18:00:00Z"),
        endsAt: new Date("2026-07-11T21:00:00Z"),
        allDay: false,
        shiftGroup: null,
      },
    ]);
    dbMock.calendarEvent.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    dbMock.shiftTrade.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    dbMock.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        requesterUserId: "someone-else",
        shiftAssignmentId: null,
        eventId: "event-1",
        status: BookingStatus.BOOKED,
        events: [],
      },
    ]);

    const health = await getScheduleHealth({
      userId: "user-1",
      parsedStartDate: new Date("2026-07-01T00:00:00Z"),
      parsedEndDate: new Date("2026-07-31T23:59:59Z"),
      includePast: true,
      includeArchived: false,
      sportCode: null,
      now: new Date("2026-07-01T12:00:00Z"),
    });

    expect(health.queues.openSlots).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
    expect(health.queues.eventsWithoutCrew).toEqual({ count: 1, eventCount: 1, eventIds: ["event-2"] });
    expect(health.queues.pendingRequests).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
    expect(health.queues.conflicts).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
    expect(health.queues.myShifts).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
    expect(health.queues.openTrades).toEqual({ count: 3 });
    expect(health.queues.tradeApprovals).toEqual({ count: 1 });
    expect(health.queues.hiddenEvents).toEqual({ count: 2 });
    expect(health.queues.archivedEvents).toEqual({ count: 1 });
    expect(health.queues.gearGaps).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
    expect(health.gearReadiness.events["event-1"]).toEqual({
      eventId: "event-1",
      counts: {
        ready: 0,
        reserved: 0,
        awaitingPickup: 0,
        checkedOut: 0,
        missing: 1,
        notLinked: 0,
      },
      assignmentIds: ["assignment-1"],
    });
    expect(health.gearReadiness.assignments["assignment-1"]).toEqual({
      eventId: "event-1",
      assignmentId: "assignment-1",
      userId: "user-1",
      bookingId: null,
      status: "missing",
      linkType: "missing",
    });
    expect(health.gearReadiness.queues.missingGear).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
    expect(health.changeHistory.events["event-1"]).toEqual({
      eventId: "event-1",
      count: 0,
      latestAt: null,
      hasRecentChanges: false,
      needsReview: false,
      items: [],
    });
    expect(health.nextCall.eventId).toBe("event-1");
    expect(health.nextCall.startsAt).toBe("2026-07-10T16:30:00.000Z");
    expect(health.partialFailures).toEqual([]);
  });

  it("classifies assignment-linked gear and event-linked gear separately", async () => {
    dbMock.calendarEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        summary: "Volleyball",
        startsAt: new Date("2026-07-10T18:00:00Z"),
        endsAt: new Date("2026-07-10T21:00:00Z"),
        allDay: false,
        shiftGroup: {
          shifts: [
            {
              id: "shift-1",
              startsAt: new Date("2026-07-10T17:00:00Z"),
              callStartsAt: null,
              assignments: [
                {
                  id: "assignment-1",
                  userId: "user-1",
                  status: ShiftAssignmentStatus.DIRECT_ASSIGNED,
                  hasConflict: false,
                  callStartsAt: null,
                },
              ],
            },
            {
              id: "shift-2",
              startsAt: new Date("2026-07-10T17:00:00Z"),
              callStartsAt: null,
              assignments: [
                {
                  id: "assignment-2",
                  userId: "user-2",
                  status: ShiftAssignmentStatus.APPROVED,
                  hasConflict: false,
                  callStartsAt: null,
                },
              ],
            },
          ],
        },
      },
    ]);
    dbMock.booking.findMany.mockResolvedValue([
      {
        id: "booking-assignment",
        requesterUserId: "user-1",
        shiftAssignmentId: "assignment-1",
        eventId: null,
        status: BookingStatus.PENDING_PICKUP,
        events: [],
      },
      {
        id: "booking-event",
        requesterUserId: "user-2",
        shiftAssignmentId: null,
        eventId: null,
        status: BookingStatus.BOOKED,
        events: [{ eventId: "event-1" }],
      },
    ]);

    const health = await getScheduleHealth({
      userId: "user-1",
      parsedStartDate: null,
      parsedEndDate: null,
      includePast: false,
      includeArchived: false,
      sportCode: null,
      now: new Date("2026-07-01T12:00:00Z"),
    });

    expect(health.gearReadiness.assignments["assignment-1"]).toEqual({
      eventId: "event-1",
      assignmentId: "assignment-1",
      userId: "user-1",
      bookingId: "booking-assignment",
      status: "awaiting_pickup",
      linkType: "assignment",
    });
    expect(health.gearReadiness.assignments["assignment-2"]).toEqual({
      eventId: "event-1",
      assignmentId: "assignment-2",
      userId: "user-2",
      bookingId: "booking-event",
      status: "reserved",
      linkType: "event",
    });
    expect(health.gearReadiness.events["event-1"]?.counts).toEqual({
      ready: 2,
      reserved: 1,
      awaitingPickup: 1,
      checkedOut: 0,
      missing: 0,
      notLinked: 1,
    });
    expect(health.gearReadiness.queues.unlinkedAssignmentGear).toEqual({
      count: 1,
      eventCount: 1,
      eventIds: ["event-1"],
    });
  });

  it("does not query all bookings when there are no event or assignment ids", async () => {
    await getScheduleHealth({
      userId: "user-1",
      parsedStartDate: null,
      parsedEndDate: null,
      includePast: false,
      includeArchived: false,
      sportCode: null,
      now: new Date("2026-07-01T12:00:00Z"),
    });

    expect(dbMock.booking.findMany).not.toHaveBeenCalled();
  });

  it("keeps the core health snapshot available when a non-critical count fails", async () => {
    dbMock.calendarEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        summary: "Volleyball",
        startsAt: new Date("2026-07-10T18:00:00Z"),
        endsAt: new Date("2026-07-10T21:00:00Z"),
        allDay: false,
        shiftGroup: { shifts: [] },
      },
    ]);
    dbMock.shiftTrade.count
      .mockRejectedValueOnce(new Error("trade count down"))
      .mockResolvedValueOnce(0);

    const health = await getScheduleHealth({
      userId: "user-1",
      parsedStartDate: null,
      parsedEndDate: null,
      includePast: false,
      includeArchived: false,
      sportCode: null,
      now: new Date("2026-07-01T12:00:00Z"),
    });

    expect(health.queues.openTrades).toEqual({ count: 0 });
    expect(health.partialFailures).toContain("openTrades");
    expect(health.queues.eventsWithoutCrew).toEqual({ count: 1, eventCount: 1, eventIds: ["event-1"] });
  });

  it("uses the same overlap window filters as the schedule event list", async () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-08-07T23:59:59Z");

    await getScheduleHealth({
      userId: "user-1",
      parsedStartDate: start,
      parsedEndDate: end,
      includePast: true,
      includeArchived: true,
      sportCode: "VB",
      now: new Date("2026-07-01T12:00:00Z"),
    });

    expect(dbMock.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startsAt: { lte: end },
          endsAt: { gt: start },
          sportCode: "VB",
        }),
      }),
    );
  });
});
