import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingKind, ShiftWorkerType } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  shiftGroup: {
    findMany: vi.fn(),
  },
  booking: {
    findMany: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { getScheduleChangeHistory } from "@/lib/services/schedule-change-history";

describe("getScheduleChangeHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.shiftGroup.findMany.mockResolvedValue([]);
    dbMock.booking.findMany.mockResolvedValue([]);
    dbMock.auditLog.findMany.mockResolvedValue([]);
  });

  it("summarizes assignment and call-window changes after publication as review work", async () => {
    const publishedAt = new Date("2026-07-01T12:00:00Z");
    dbMock.shiftGroup.findMany.mockResolvedValue([
      {
        id: "group-1",
        eventId: "event-1",
        publishedAt,
        shifts: [
          {
            id: "shift-1",
            area: "VIDEO",
            workerType: ShiftWorkerType.FT,
            assignments: [{ id: "assignment-1", user: { name: "Ada Lovelace" } }],
          },
        ],
      },
    ]);
    dbMock.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-1",
        actorUserId: "staff-1",
        entityType: "shift_assignment",
        entityId: "assignment-1",
        action: "shift_assignment_updated",
        beforeJson: { callStartsAt: "2026-07-10T15:00:00Z" },
        afterJson: { callStartsAt: "2026-07-10T16:00:00Z", _actorRole: "STAFF" },
        createdAt: new Date("2026-07-02T10:00:00Z"),
        actor: { id: "staff-1", name: "Sam Staff", role: "STAFF" },
      },
      {
        id: "audit-2",
        actorUserId: "staff-1",
        entityType: "shift_assignment",
        entityId: "assignment-1",
        action: "shift_assigned",
        beforeJson: null,
        afterJson: { _actorRole: "STAFF" },
        createdAt: new Date("2026-06-30T10:00:00Z"),
        actor: { id: "staff-1", name: "Sam Staff", role: "STAFF" },
      },
    ]);

    const history = await getScheduleChangeHistory({
      eventIds: ["event-1"],
      limitPerEvent: 5,
    });

    expect(history.events["event-1"]?.needsReview).toBe(true);
    expect(history.events["event-1"]?.items).toEqual([
      expect.objectContaining({
        id: "audit-1",
        kind: "assignment_updated",
        label: "Updated call time",
        detail: expect.stringContaining("callStartsAt"),
        actorName: "Sam Staff",
        afterPublication: true,
        needsReview: true,
        target: expect.objectContaining({
          type: "assignment",
          label: "Ada Lovelace · VIDEO Staff slot",
        }),
      }),
      expect.objectContaining({
        id: "audit-2",
        kind: "assignment_assigned",
        afterPublication: false,
        needsReview: false,
      }),
    ]);
  });

  it("maps reservation audit rows through event and assignment links", async () => {
    dbMock.shiftGroup.findMany.mockResolvedValue([
      {
        id: "group-1",
        eventId: "event-1",
        publishedAt: null,
        shifts: [
          {
            id: "shift-1",
            area: "PHOTO",
            workerType: ShiftWorkerType.ST,
            assignments: [{ id: "assignment-1", user: { name: "Grace Hopper" } }],
          },
        ],
      },
    ]);
    dbMock.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        kind: BookingKind.RESERVATION,
        title: "Grace gear prep",
        eventId: null,
        shiftAssignmentId: "assignment-1",
        events: [],
      },
    ]);
    dbMock.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-booking",
        actorUserId: "staff-1",
        entityType: "booking",
        entityId: "booking-1",
        action: "created",
        beforeJson: null,
        afterJson: { kind: "RESERVATION", _actorRole: "STAFF" },
        createdAt: new Date("2026-07-02T10:00:00Z"),
        actor: { id: "staff-1", name: "Sam Staff", role: "STAFF" },
      },
    ]);

    const history = await getScheduleChangeHistory({
      eventIds: ["event-1"],
      limitPerEvent: 5,
    });

    expect(history.events["event-1"]?.items[0]).toEqual(expect.objectContaining({
      kind: "reservation_linked",
      label: "Reserved gear",
      detail: "Grace gear prep",
      target: expect.objectContaining({
        type: "booking",
        label: "Grace gear prep",
      }),
    }));
  });

  it("keeps unknown booking audit rows out of the schedule timeline", async () => {
    dbMock.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        kind: BookingKind.CHECKOUT,
        title: "Checkout",
        eventId: "event-1",
        shiftAssignmentId: null,
        events: [],
      },
    ]);
    dbMock.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-booking",
        actorUserId: "staff-1",
        entityType: "booking",
        entityId: "booking-1",
        action: "created",
        beforeJson: null,
        afterJson: { kind: "CHECKOUT", _actorRole: "STAFF" },
        createdAt: new Date("2026-07-02T10:00:00Z"),
        actor: { id: "staff-1", name: "Sam Staff", role: "STAFF" },
      },
    ]);

    const history = await getScheduleChangeHistory({
      eventIds: ["event-1"],
      limitPerEvent: 5,
    });

    expect(history.events["event-1"]?.items).toEqual([]);
  });
});
