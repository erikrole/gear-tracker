import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  withKiosk:
    (handler: (req: Request, ctx: { kiosk: { locationId: string } }) => Promise<Response>) =>
    (req: Request) =>
      handler(req, { kiosk: { locationId: "loc-1" } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    calendarEvent: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/kiosk/dashboard/route";

const mockDb = db as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
  calendarEvent: { findMany: ReturnType<typeof vi.fn> };
  booking: { findMany: ReturnType<typeof vi.fn> };
};

function request() {
  return new Request("https://app.example.com/api/kiosk/dashboard");
}

describe("kiosk dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns kiosk dashboard data when every section succeeds", async () => {
    mockDb.$queryRaw.mockResolvedValue([{ items_out: 4n, checkouts: 2n, overdue: 1n }]);
    mockDb.calendarEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        summary: "Softball vs Iowa",
        sportCode: "SB",
        startsAt: new Date("2026-05-13T18:00:00.000Z"),
        shiftGroup: { _count: { shifts: 3 } },
      },
    ]);
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        title: "Camera Kit",
        endsAt: new Date("2026-05-13T12:00:00.000Z"),
        requester: { id: "user-1", name: "Bucky Badger", avatarUrl: null },
        serializedItems: [{ asset: { assetTag: "CAM-1", name: "FX3" } }],
        _count: { serializedItems: 1 },
      },
    ]);

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toEqual({ itemsOut: 4, checkouts: 2, overdue: 1 });
    expect(body.events).toHaveLength(1);
    expect(body.checkouts).toHaveLength(1);
    expect(body.partialFailures).toEqual([]);
  });

  it("returns safe fallback sections when one dashboard query fails", async () => {
    mockDb.$queryRaw.mockRejectedValue(new Error("stats failed"));
    mockDb.calendarEvent.findMany.mockResolvedValue([]);
    mockDb.booking.findMany.mockResolvedValue([]);

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toEqual({ itemsOut: 0, checkouts: 0, overdue: 0 });
    expect(body.events).toEqual([]);
    expect(body.checkouts).toEqual([]);
    expect(body.partialFailures).toEqual(["stats"]);
  });
});
