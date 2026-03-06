import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { resolveEventDefaults } from "@/lib/services/event-defaults";

const mockDb = db as unknown as {
  calendarEvent: { findFirst: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveEventDefaults", () => {
  it("returns empty defaults when no sportCode provided", async () => {
    const result = await resolveEventDefaults(undefined);
    expect(result.eventId).toBeNull();
    expect(result.title).toBeNull();
    expect(mockDb.calendarEvent.findFirst).not.toHaveBeenCalled();
  });

  it("returns empty defaults when no matching event found", async () => {
    mockDb.calendarEvent.findFirst.mockResolvedValue(null);

    const result = await resolveEventDefaults("MBB");
    expect(result.eventId).toBeNull();
    expect(result.title).toBeNull();
    expect(result.sportCode).toBe("MBB");
  });

  it("returns event defaults when matching event found", async () => {
    const futureDate = new Date(Date.now() + 86400_000);
    const futureEnd = new Date(Date.now() + 86400_000 * 2);

    mockDb.calendarEvent.findFirst.mockResolvedValue({
      id: "event-1",
      summary: "MBB vs Michigan",
      startsAt: futureDate,
      endsAt: futureEnd,
      locationId: "loc-1",
      sportCode: "MBB",
    });

    const result = await resolveEventDefaults("MBB");
    expect(result.eventId).toBe("event-1");
    expect(result.title).toBe("MBB vs Michigan");
    expect(result.startsAt).toEqual(futureDate);
    expect(result.endsAt).toEqual(futureEnd);
    expect(result.locationId).toBe("loc-1");
    expect(result.sportCode).toBe("MBB");
  });

  it("queries for CONFIRMED events within 30-day window", async () => {
    mockDb.calendarEvent.findFirst.mockResolvedValue(null);

    await resolveEventDefaults("WBB");

    expect(mockDb.calendarEvent.findFirst).toHaveBeenCalledTimes(1);
    const call = mockDb.calendarEvent.findFirst.mock.calls[0][0];
    expect(call.where.sportCode).toBe("WBB");
    expect(call.where.status).toBe("CONFIRMED");
    expect(call.where.startsAt.gte).toBeInstanceOf(Date);
    expect(call.where.startsAt.lte).toBeInstanceOf(Date);

    // Verify the window is approximately 30 days
    const windowMs = call.where.startsAt.lte.getTime() - call.where.startsAt.gte.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(windowMs).toBeGreaterThan(thirtyDaysMs - 60_000); // within 1 minute tolerance
    expect(windowMs).toBeLessThan(thirtyDaysMs + 60_000);

    expect(call.orderBy.startsAt).toBe("asc");
  });
});
