import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    booking: { findUnique: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getBookingDetail } from "@/lib/services/bookings-queries";

function booking(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "booking-1",
    kind: "RESERVATION",
    title: "Past reservation",
    status: "BOOKED",
    startsAt: new Date("2026-04-01T10:00:00Z"),
    endsAt: new Date("2026-04-01T12:00:00Z"),
    location: { id: "loc-1", name: "Equipment Room" },
    creator: { id: "staff-1", name: "Staff One", email: "staff@example.com", avatarUrl: null },
    serializedItems: [],
    bulkItems: [],
    event: null,
    events: [],
    sourceReservation: null,
    shiftAssignment: null,
    kit: null,
    photos: [],
    ...overrides,
  };
}

describe("getBookingDetail status read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
  });

  it("marks past-due booked reservations as overdue for detail badges", async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(booking() as never);

    const detail = await getBookingDetail("booking-1");

    expect(detail.isOverdue).toBe(true);
    expect(detail.isActive).toBe(true);
  });

  it("does not mark pending pickup as overdue from the return due date", async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(booking({
      kind: "CHECKOUT",
      status: "PENDING_PICKUP",
      title: "Pending pickup",
    }) as never);

    const detail = await getBookingDetail("booking-1");

    expect(detail.isOverdue).toBe(false);
  });
});
