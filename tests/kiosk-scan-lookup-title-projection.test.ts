import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allocationFindFirst: vi.fn(),
  findAsset: vi.fn(),
  findUnit: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { assetAllocation: { findFirst: mocks.allocationFindFirst } },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: (handler: (request: Request, context: { kiosk: { kioskId: string } }) => unknown) =>
    (request: Request) => handler(request, { kiosk: { kioskId: "kiosk-1" } }),
}));

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.rateLimit }));
vi.mock("@/lib/services/kiosk-scan", () => ({ findAssetByScanValue: mocks.findAsset }));
vi.mock("@/lib/services/bulk-unit-scans", () => ({ findBulkUnitByScanValue: mocks.findUnit }));

import { POST } from "@/app/api/kiosk/scan-lookup/route";

function request() {
  return new Request("http://test/api/kiosk/scan-lookup", {
    method: "POST",
    body: JSON.stringify({ scanValue: "CAM-1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue(undefined);
  mocks.findAsset.mockResolvedValue(null);
  mocks.findUnit.mockResolvedValue(null);
  mocks.allocationFindFirst.mockResolvedValue(null);
});

describe("POST /api/kiosk/scan-lookup title projection", () => {
  it("corrects legacy booking titles for serialized assets", async () => {
    mocks.findAsset.mockResolvedValue({
      id: "asset-1",
      assetTag: "CAM-1",
      name: "FX3",
      status: "AVAILABLE",
      category: { name: "Camera" },
    });
    mocks.allocationFindFirst.mockResolvedValue({
      endsAt: new Date("2026-08-14T12:00:00.000Z"),
      booking: {
        title: "Women's Soccer vs Tcu",
        requester: { name: "Bucky Badger" },
      },
    });

    const body = await (await POST(request(), { params: Promise.resolve({}) })).json();

    expect(body.item.bookingTitle).toBe("Women's Soccer vs TCU");
  });

  it("corrects legacy booking titles for numbered units", async () => {
    mocks.findUnit.mockResolvedValue({
      id: "unit-1",
      tagName: "#1",
      name: "Sony Battery #1",
      type: "Batteries",
      bulkSkuName: "Sony Battery",
      bulkSkuId: "sku-1",
      unitNumber: 1,
      status: "CHECKED_OUT",
      dueAt: null,
      holder: "Bucky Badger",
      bookingTitle: "Women's Soccer vs Usc",
    });

    const body = await (await POST(request(), { params: Promise.resolve({}) })).json();

    expect(body.item.bookingTitle).toBe("Women's Soccer vs USC");
  });
});
