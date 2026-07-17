import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingKind, BookingStatus, CollaboratorProfile, Prisma, Role } from "@prisma/client";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

type MockFn = ReturnType<typeof vi.fn>;
type UpdateEventsTx = {
  booking: Record<"findUnique" | "findUniqueOrThrow" | "update", MockFn>;
  calendarEvent: Record<"findMany", MockFn>;
  bookingEvent: Record<"deleteMany" | "createMany", MockFn>;
  auditLog: Record<"create", MockFn>;
  user: Record<"findUnique", MockFn>;
};

const transactionCalls: Array<{ options: unknown }> = [];

vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    calendarEvent: { findMany: vi.fn() },
    bookingEvent: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

import { db } from "@/lib/db";
import { updateBookingEvents } from "@/lib/services/bookings";

const mockTx = (db as unknown as { _mockTx: UpdateEventsTx })._mockTx;

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: "reservation-1",
    kind: BookingKind.RESERVATION,
    status: BookingStatus.BOOKED,
    eventId: "event-old",
    events: [{ eventId: "event-old" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionCalls.length = 0;
  mockTx.booking.findUnique.mockResolvedValue(reservation());
  mockTx.booking.findUniqueOrThrow.mockResolvedValue({ id: "reservation-1" });
  mockTx.booking.update.mockResolvedValue({});
  mockTx.bookingEvent.deleteMany.mockResolvedValue({});
  mockTx.bookingEvent.createMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
  mockTx.user.findUnique.mockResolvedValue({ role: Role.STUDENT, collaboratorProfile: null });
  mockTx.calendarEvent.findMany.mockResolvedValue([
    { id: "event-late", startsAt: new Date("2026-07-11T20:00:00Z") },
    { id: "event-early", startsAt: new Date("2026-07-10T20:00:00Z") },
  ]);
});

describe("updateBookingEvents", () => {
  it("uses SERIALIZABLE isolation", async () => {
    await updateBookingEvents("reservation-1", "student-1", ["event-late", "event-early"]);
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("sorts event links chronologically and preserves primary event compatibility", async () => {
    await updateBookingEvents("reservation-1", "student-1", ["event-late", "event-early"]);

    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: { eventId: "event-early" },
    });
    expect(mockTx.bookingEvent.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "reservation-1" } });
    expect(mockTx.bookingEvent.createMany).toHaveBeenCalledWith({
      data: [
        { bookingId: "reservation-1", eventId: "event-early", ordinal: 0 },
        { bookingId: "reservation-1", eventId: "event-late", ordinal: 1 },
      ],
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "student-1",
          action: "events_updated",
          beforeJson: expect.objectContaining({ eventIds: ["event-old"] }),
          afterJson: expect.objectContaining({
            eventId: "event-early",
            eventIds: ["event-early", "event-late"],
            _actorRole: Role.STUDENT,
          }),
        }),
      }),
    );
  });

  it("clears linked events", async () => {
    await updateBookingEvents("reservation-1", "student-1", []);

    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: { eventId: null },
    });
    expect(mockTx.bookingEvent.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "reservation-1" } });
    expect(mockTx.bookingEvent.createMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate eventIds before opening a transaction", async () => {
    await expect(
      updateBookingEvents("reservation-1", "student-1", ["event-1", "event-1"]),
    ).rejects.toThrow("eventIds must be unique");

    expect(transactionCalls).toHaveLength(0);
  });

  it("rejects more than 3 eventIds before opening a transaction", async () => {
    await expect(
      updateBookingEvents("reservation-1", "student-1", ["event-1", "event-2", "event-3", "event-4"]),
    ).rejects.toThrow("A booking may link at most 3 events");

    expect(transactionCalls).toHaveLength(0);
  });

  it("rejects missing eventIds", async () => {
    mockTx.calendarEvent.findMany.mockResolvedValue([{ id: "event-late", startsAt: new Date("2026-07-11T20:00:00Z") }]);

    await expect(
      updateBookingEvents("reservation-1", "student-1", ["event-late", "event-missing"]),
    ).rejects.toThrow("One or more eventIds do not exist");
    expect(mockTx.booking.update).not.toHaveBeenCalled();
    expect(mockTx.bookingEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("limits collaborator relinking to published visible schedule events", async () => {
    mockTx.user.findUnique.mockResolvedValue({
      role: Role.COLLABORATOR,
      collaboratorProfile: CollaboratorProfile.BTN_STANDARD,
    });

    await updateBookingEvents("reservation-1", "collaborator-1", ["event-late", "event-early"]);

    expect(mockTx.calendarEvent.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["event-late", "event-early"] },
        isHidden: false,
        archivedAt: null,
        shiftGroup: {
          is: {
            publishedAt: { not: null },
            archivedAt: null,
            lastPublishedSnapshot: { not: Prisma.JsonNull },
          },
        },
      },
      select: { id: true, startsAt: true },
    });
  });

  it("allows active checkout bookings", async () => {
    mockTx.booking.findUnique.mockResolvedValue(reservation({
      kind: BookingKind.CHECKOUT,
      status: BookingStatus.OPEN,
    }));

    await updateBookingEvents("reservation-1", "student-1", ["event-late", "event-early"]);

    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: { eventId: "event-early" },
    });
  });

  it("keeps checkout relinking scoped to event context only", async () => {
    mockTx.booking.findUnique.mockResolvedValue(reservation({
      kind: BookingKind.CHECKOUT,
      status: BookingStatus.OPEN,
    }));

    await updateBookingEvents("reservation-1", "student-1", ["event-late", "event-early"]);

    expect(mockTx.booking.update).toHaveBeenCalledTimes(1);
    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: { eventId: "event-early" },
    });
    expect(mockTx.bookingEvent.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "reservation-1" } });
    expect(mockTx.bookingEvent.createMany).toHaveBeenCalledWith({
      data: [
        { bookingId: "reservation-1", eventId: "event-early", ordinal: 0 },
        { bookingId: "reservation-1", eventId: "event-late", ordinal: 1 },
      ],
    });
  });

  it("rejects terminal bookings", async () => {
    mockTx.booking.findUnique.mockResolvedValue(reservation({ status: BookingStatus.COMPLETED }));

    await expect(
      updateBookingEvents("reservation-1", "student-1", ["event-late", "event-early"]),
    ).rejects.toThrow("Cannot update linked events for a completed or cancelled booking");
  });
});
