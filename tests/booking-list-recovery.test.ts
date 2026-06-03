import { describe, expect, it } from "vitest";
import { applyBookingItemsUpdate } from "@/components/booking-list/list-recovery";
import type { BookingItem, ListResponse } from "@/components/booking-list/types";

function booking(id: string, status = "OPEN"): BookingItem {
  return {
    id,
    title: `Booking ${id}`,
    startsAt: "2026-06-01T15:00:00.000Z",
    endsAt: "2026-06-01T17:00:00.000Z",
    status,
    kind: "CHECKOUT",
    sportCode: null,
    requester: { id: "user-1", name: "User One" },
    location: { id: "loc-1", name: "Camp Randall" },
    serializedItems: [],
    bulkItems: [],
  };
}

describe("booking list recovery helpers", () => {
  it("decrements the visible total when a successful action removes a row", () => {
    const prev: ListResponse = {
      data: [booking("booking-1"), booking("booking-2")],
      total: 7,
      limit: 20,
      offset: 0,
    };

    const next = applyBookingItemsUpdate(prev, (items) =>
      items.filter((item) => item.id !== "booking-1"),
    );

    expect(next?.data.map((item) => item.id)).toEqual(["booking-2"]);
    expect(next?.total).toBe(6);
  });

  it("preserves the total when a failed optimistic action restores row data", () => {
    const prev: ListResponse = {
      data: [booking("booking-1", "CANCELLED")],
      total: 1,
      limit: 20,
      offset: 0,
    };

    const next = applyBookingItemsUpdate(prev, () => [booking("booking-1", "OPEN")]);

    expect(next?.data[0]?.status).toBe("OPEN");
    expect(next?.total).toBe(1);
  });
});
