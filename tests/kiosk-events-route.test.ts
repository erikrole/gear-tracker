import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  withKiosk:
    (handler: (req: Request, ctx: { kiosk: { locationId: string } }) => Promise<Response>) =>
    (req: Request) =>
      handler(req, { kiosk: { locationId: "loc-1" } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/kiosk/events/route";

const mockDb = db as unknown as {
  calendarEvent: { findMany: ReturnType<typeof vi.fn> };
};

function request() {
  return new Request("https://app.example.com/api/kiosk/events");
}

describe("GET /api/kiosk/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns visible upcoming events within the kiosk checkout window", async () => {
    mockDb.calendarEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        summary: "Softball vs Iowa",
        subtitle: "Big Ten",
        rawLocationText: "Goodman Diamond",
        sportCode: "SB",
        startsAt: new Date("2026-06-16T18:00:00.000Z"),
        endsAt: new Date("2026-06-16T21:00:00.000Z"),
        allDay: false,
      },
    ]);

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: "event-1",
        title: "Softball vs Iowa",
        subtitle: "Big Ten",
        sportCode: "SB",
        locationName: "Goodman Diamond",
      }),
    ]);
    expect(mockDb.calendarEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { not: "CANCELLED" },
        isHidden: false,
        archivedAt: null,
      }),
      orderBy: { startsAt: "asc" },
      take: 80,
    }));
  });
});
