import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    bulkSku: { findMany: vi.fn() },
    asset: { findMany: vi.fn() },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as getBatteryOps } from "@/app/api/bulk-skus/batteries/route";

const noParams = { params: Promise.resolve({}) };

function makeGetRequest(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
  } as any);
});

describe("battery ops live counts", () => {
  it("returns no-store battery metrics derived from numbered unit status", async () => {
    vi.mocked(db.bulkSku.findMany).mockResolvedValue([
      {
        id: "sku-battery",
        name: "Sony Battery",
        category: "Batteries",
        trackByNumber: true,
        minThreshold: 4,
        binQrCodeValue: "sony-battery",
        location: { id: "loc-1", name: "Camp Randall" },
        categoryRel: { id: "cat-1", name: "Batteries" },
        balances: [{ onHandQuantity: 99 }],
        units: [
          { id: "unit-1", unitNumber: 1, status: "AVAILABLE", notes: null, allocations: [] },
          {
            id: "unit-2",
            unitNumber: 2,
            status: "CHECKED_OUT",
            notes: null,
            allocations: [{
              checkedOutAt: new Date("2026-05-20T12:00:00.000Z"),
              createdAt: new Date("2026-05-20T12:00:00.000Z"),
              bookingBulkItem: {
                booking: {
                  id: "booking-1",
                  title: "Game day",
                  refNumber: "CO-1001",
                  endsAt: new Date("2026-05-31T18:00:00.000Z"),
                  requester: { name: "Bucky Badger" },
                },
              },
            }],
          },
          { id: "unit-3", unitNumber: 3, status: "LOST", notes: null, allocations: [] },
          { id: "unit-4", unitNumber: 4, status: "RETIRED", notes: null, allocations: [] },
        ],
      },
      {
        id: "sku-cable",
        name: "HDMI Cable",
        category: "Cables",
        trackByNumber: true,
        minThreshold: 0,
        binQrCodeValue: "hdmi",
        location: { id: "loc-1", name: "Camp Randall" },
        categoryRel: { id: "cat-2", name: "Cables" },
        balances: [{ onHandQuantity: 1 }],
        units: [{ id: "unit-cable", unitNumber: 1, status: "AVAILABLE", notes: null, allocations: [] }],
      },
    ] as any);
    vi.mocked(db.asset.findMany).mockResolvedValue([
      {
        brand: "Sony",
        model: "FX3",
        type: "Camera",
        category: { name: "Cameras" },
      },
    ] as any);

    const res = await getBatteryOps(makeGetRequest("/api/bulk-skus/batteries"), noParams);
    const body = await res.json();

    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body.data.totals).toEqual({
      total: 4,
      available: 1,
      checkedOut: 1,
      lost: 1,
      retired: 1,
      lowSkus: 1,
      agingCheckedOut: expect.any(Number),
    });
    expect(body.data.skus).toHaveLength(1);
    expect(body.data.skus[0]).toEqual(expect.objectContaining({
      id: "sku-battery",
      trackByNumber: true,
      counts: {
        total: 4,
        available: 1,
        checkedOut: 1,
        lost: 1,
        retired: 1,
      },
      isLow: true,
      threshold: 10,
    }));
    expect(body.data.compatibility[0]).toEqual(expect.objectContaining({
      ruleId: "sony-np-fz100",
      availableQuantity: 1,
      threshold: 10,
      isLow: true,
    }));
  });

  it("includes quantity-tracked battery families with stock-balance counts", async () => {
    vi.mocked(db.bulkSku.findMany).mockResolvedValue([
      {
        id: "sku-aa",
        name: "AA Batteries",
        category: "Batteries",
        trackByNumber: false,
        minThreshold: 4,
        binQrCodeValue: "aa-batteries",
        location: { id: "loc-1", name: "Camp Randall" },
        categoryRel: { id: "cat-1", name: "Batteries" },
        balances: [{ onHandQuantity: 7 }],
        units: [],
      },
    ] as any);
    vi.mocked(db.asset.findMany).mockResolvedValue([] as any);

    const res = await getBatteryOps(makeGetRequest("/api/bulk-skus/batteries"), noParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.totals).toEqual({
      total: 7,
      available: 7,
      checkedOut: 0,
      lost: 0,
      retired: 0,
      lowSkus: 1,
      agingCheckedOut: 0,
    });
    expect(body.data.skus[0]).toEqual(expect.objectContaining({
      id: "sku-aa",
      trackByNumber: false,
      counts: {
        total: 7,
        available: 7,
        checkedOut: 0,
        lost: 0,
        retired: 0,
      },
      units: [],
    }));
  });
});
