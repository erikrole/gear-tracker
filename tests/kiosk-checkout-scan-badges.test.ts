import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assetAllocationFindFirst: vi.fn(),
  findAssetByScanValue: vi.fn(),
  findBulkUnitByScanValue: vi.fn(),
  badgeOnScanResult: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    assetAllocation: {
      findFirst: mocks.assetAllocationFindFirst,
    },
  },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: (handler: any) => (req: Request) =>
    handler(req, {
      kiosk: {
        kioskId: "kiosk-1",
        locationId: "loc-1",
        locationName: "Camp Randall",
      },
    }),
}));

vi.mock("@/lib/services/kiosk-scan", () => ({
  findAssetByScanValue: mocks.findAssetByScanValue,
}));

vi.mock("@/lib/services/bulk-unit-scans", () => ({
  findBulkUnitByScanValue: mocks.findBulkUnitByScanValue,
}));

vi.mock("@/lib/services/kiosk-location", () => ({
  assetLocationEvidence: vi.fn().mockResolvedValue({
    locationMismatch: false,
    expectedLocationId: "loc-1",
    actualLocationId: "loc-1",
    expectedLocationName: "Camp Randall",
    actualLocationName: "Camp Randall",
  }),
  reconcileAssetLocationToKiosk: vi.fn().mockResolvedValue(undefined),
  locationEvidencePayload: (evidence: unknown) => evidence,
}));

vi.mock("@/lib/badges", () => ({
  badges: {
    onScanResult: mocks.badgeOnScanResult,
  },
}));

import { POST as scanKioskCheckout } from "@/app/api/kiosk/checkout/scan/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findBulkUnitByScanValue.mockResolvedValue(null);
});

describe("kiosk checkout scan badge events", () => {
  it("emits a successful scan badge event when the kiosk passes an actor", async () => {
    mocks.findAssetByScanValue.mockResolvedValue({
      id: "asset-1",
      assetTag: "FX3 1",
      name: "FX3 1",
      status: "AVAILABLE",
      category: { name: "Camera" },
    });
    mocks.assetAllocationFindFirst.mockResolvedValue(null);

    const res = await (scanKioskCheckout as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1", scanValue: " FX3-001 " }),
    }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(mocks.badgeOnScanResult).toHaveBeenCalledWith({
      userId: "user-1",
      phase: "checkout",
      ok: true,
      sourceKey: "checkout:user-1:fx3-001:ok",
    });
  });

  it("does not emit a scan badge event for older clients without actorId", async () => {
    mocks.findAssetByScanValue.mockResolvedValue({
      id: "asset-1",
      assetTag: "FX3 1",
      name: "FX3 1",
      status: "AVAILABLE",
      category: { name: "Camera" },
    });
    mocks.assetAllocationFindFirst.mockResolvedValue(null);

    const res = await (scanKioskCheckout as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ scanValue: "FX3-001" }),
    }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(mocks.badgeOnScanResult).not.toHaveBeenCalled();
  });

  it("resolves available numbered battery unit scans before serialized lookup", async () => {
    mocks.findBulkUnitByScanValue.mockResolvedValue({
      id: "unit-31",
      name: "Sony Battery #31",
      tagName: "#31",
      type: "Batteries",
      status: "AVAILABLE",
      bulkSkuName: "Sony Battery",
      bulkSkuId: "sku-sony",
      unitNumber: 31,
    });

    const res = await (scanKioskCheckout as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1", scanValue: "94e068d1-31" }),
    }));
    const json = await res.json();

    expect(json).toEqual({
      success: true,
      item: {
        id: "bulk:sku-sony:unit:31",
        name: "Sony Battery #31",
        tagName: "#31",
        type: "Batteries",
        bulkSkuId: "sku-sony",
        unitNumber: 31,
      },
    });
    expect(mocks.findAssetByScanValue).not.toHaveBeenCalled();
    expect(mocks.badgeOnScanResult).toHaveBeenCalledWith({
      userId: "user-1",
      phase: "checkout",
      ok: true,
      sourceKey: "checkout:user-1:94e068d1-31:ok",
    });
  });
});
