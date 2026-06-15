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
    calendarEvent: { count: vi.fn(), findMany: vi.fn() },
    booking: { count: vi.fn(), findMany: vi.fn() },
    bookingSerializedItem: { findMany: vi.fn() },
    bookingBulkUnitAllocation: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/kiosk/dashboard/route";

const mockDb = db as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
  calendarEvent: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  booking: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  bookingSerializedItem: { findMany: ReturnType<typeof vi.fn> };
  bookingBulkUnitAllocation: { findMany: ReturnType<typeof vi.fn> };
};

function request() {
  return new Request("https://app.example.com/api/kiosk/dashboard");
}

describe("kiosk dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.calendarEvent.count.mockResolvedValue(0);
    mockDb.booking.count.mockResolvedValue(0);
    mockDb.bookingSerializedItem.findMany.mockResolvedValue([]);
    mockDb.bookingBulkUnitAllocation.findMany.mockResolvedValue([]);
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
    mockDb.bookingSerializedItem.findMany.mockResolvedValue([
      {
        asset: { id: "asset-1", assetTag: "CAM-1", name: "FX3", imageUrl: null },
        booking: {
          id: "booking-1",
          title: "Camera Kit",
          endsAt: new Date("2026-05-13T12:00:00.000Z"),
          requester: { name: "Bucky Badger" },
        },
      },
    ]);
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        title: "Camera Kit",
        endsAt: new Date("2026-05-13T12:00:00.000Z"),
        requester: { id: "user-1", name: "Bucky Badger", avatarUrl: null },
        serializedItems: [{ asset: { assetTag: "CAM-1", name: "FX3" } }],
        bulkItems: [],
        _count: { serializedItems: 1 },
      },
    ]);

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toEqual({ itemsOut: 4, checkouts: 2, overdue: 1 });
    expect(body.events).toHaveLength(1);
    expect(body.activeItems).toEqual([
      expect.objectContaining({
        id: "asset-1",
        name: "FX3",
        tagName: "CAM-1",
      }),
    ]);
    expect(body.checkouts).toHaveLength(1);
    expect(body.partialFailures).toEqual([]);
  });

  it("counts and displays active numbered bulk units on the kiosk dashboard", async () => {
    mockDb.$queryRaw.mockResolvedValue([{ items_out: 1n, checkouts: 1n, overdue: 0n }]);
    mockDb.calendarEvent.findMany.mockResolvedValue([]);
    mockDb.bookingBulkUnitAllocation.findMany.mockResolvedValue([
      {
        bulkSkuUnit: {
          id: "unit-31",
          unitNumber: 31,
          bulkSku: { name: "Sony Battery", imageUrl: null },
        },
        bookingBulkItem: {
          booking: {
            id: "booking-1",
            title: "Kiosk Checkout",
            endsAt: new Date("2026-05-13T12:00:00.000Z"),
            requester: { name: "Bucky Badger" },
          },
        },
      },
    ]);
    mockDb.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        title: "Kiosk Checkout",
        endsAt: new Date("2026-05-13T12:00:00.000Z"),
        requester: { id: "user-1", name: "Bucky Badger", avatarUrl: null },
        serializedItems: [],
        bulkItems: [{
          checkedOutQuantity: 1,
          checkedInQuantity: 0,
          bulkSku: { name: "Sony Battery" },
          unitAllocations: [{ bulkSkuUnit: { unitNumber: 31 } }],
        }],
        _count: { serializedItems: 0 },
      },
    ]);

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toEqual({ itemsOut: 1, checkouts: 1, overdue: 0 });
    expect(body.activeItems).toEqual([
      expect.objectContaining({
        id: "unit-31",
        name: "Sony Battery #31",
        tagName: "#31",
        checkoutId: "booking-1",
      }),
    ]);
    expect(body.checkouts).toEqual([
      expect.objectContaining({
        id: "booking-1",
        itemCount: 1,
        items: [{ name: "Sony Battery #31" }],
      }),
    ]);
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
