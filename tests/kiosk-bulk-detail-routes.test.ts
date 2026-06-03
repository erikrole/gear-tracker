import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  bookingUpdateMany: vi.fn(),
  bookingSerializedItemFindUnique: vi.fn(),
  scanEventFindFirst: vi.fn(),
  scanEventCreate: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  createAuditEntryTx: vi.fn(),
  findAssetByScanValue: vi.fn(),
  scanKioskPickupBulkUnit: vi.fn(),
  badgeOnScanResult: vi.fn(),
  badgeOnCheckoutOpened: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      findUnique: mocks.bookingFindUnique,
      update: mocks.bookingUpdate,
      updateMany: mocks.bookingUpdateMany,
    },
    bookingSerializedItem: {
      findUnique: mocks.bookingSerializedItemFindUnique,
    },
    scanEvent: {
      findFirst: mocks.scanEventFindFirst,
      create: mocks.scanEventCreate,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: (handler: any) => (req: Request, ctx: { params: Record<string, string> }) =>
    handler(req, {
      params: ctx.params,
      kiosk: {
        kioskId: "kiosk-1",
        locationId: "loc-1",
        locationName: "Camp Randall",
      },
    }),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntryTx: mocks.createAuditEntryTx,
}));

vi.mock("@/lib/services/kiosk-scan", () => ({
  findAssetByScanValue: mocks.findAssetByScanValue,
}));

vi.mock("@/lib/services/bulk-unit-scans", () => ({
  scanKioskPickupBulkUnit: mocks.scanKioskPickupBulkUnit,
}));

vi.mock("@/lib/badges", () => ({
  badges: {
    onScanResult: mocks.badgeOnScanResult,
    onCheckoutOpened: mocks.badgeOnCheckoutOpened,
  },
}));

import { GET as getKioskCheckoutDetail } from "@/app/api/kiosk/checkout/[id]/route";
import { POST as scanKioskPickup } from "@/app/api/kiosk/pickup/[id]/scan/route";
import { POST as confirmKioskPickup } from "@/app/api/kiosk/pickup/[id]/confirm/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((handler) => handler({
    booking: {
      findUnique: mocks.bookingFindUnique,
      updateMany: mocks.bookingUpdateMany,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  }));
  mocks.bookingUpdateMany.mockResolvedValue({ count: 1 });
  mocks.scanEventFindFirst.mockResolvedValue(null);
});

describe("kiosk checkout detail bulk units", () => {
  it("includes pending pickup battery quantity as scan checklist slots", async () => {
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      title: "Pickup",
      refNumber: "CO-1001",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      endsAt: new Date("2026-05-06T12:00:00.000Z"),
      serializedItems: [],
      bulkItems: [{
        id: "bulk-item-1",
        plannedQuantity: 2,
        checkedOutQuantity: 0,
        checkedInQuantity: 0,
        bulkSku: {
          id: "sku-1",
          name: "Sony Battery",
          category: "Batteries",
          trackByNumber: true,
        },
        unitAllocations: [],
      }],
    });

    const res = await (getKioskCheckoutDetail as any)(new Request("http://test"), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json.items).toEqual([
      {
        id: "bulk-item-1:slot:1",
        tagName: "#1",
        name: "Sony Battery 1",
        returned: false,
        type: "numbered_bulk",
        bulkSkuId: "sku-1",
        bulkSkuName: "Sony Battery",
        unitNumber: null,
      },
      {
        id: "bulk-item-1:slot:2",
        tagName: "#2",
        name: "Sony Battery 2",
        returned: false,
        type: "numbered_bulk",
        bulkSkuId: "sku-1",
        bulkSkuName: "Sony Battery",
        unitNumber: null,
      },
    ]);
    expect(json.scanSummary).toEqual({
      serializedTotal: 0,
      numberedBulkTotal: 2,
      numberedBulkCompleted: 0,
    });
  });

  it("includes checked-out battery units in return detail", async () => {
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      title: "Return",
      refNumber: "CO-1001",
      status: "OPEN",
      kind: "CHECKOUT",
      endsAt: new Date("2026-05-06T12:00:00.000Z"),
      serializedItems: [],
      bulkItems: [{
        id: "bulk-item-1",
        plannedQuantity: 2,
        checkedOutQuantity: 2,
        checkedInQuantity: 1,
        bulkSku: {
          id: "sku-1",
          name: "Sony Battery",
          category: "Batteries",
          trackByNumber: true,
        },
        unitAllocations: [
          {
            checkedInAt: null,
            bulkSkuUnit: { id: "unit-7", unitNumber: 7 },
          },
          {
            checkedInAt: new Date("2026-05-05T12:00:00.000Z"),
            bulkSkuUnit: { id: "unit-11", unitNumber: 11 },
          },
        ],
      }],
    });

    const res = await (getKioskCheckoutDetail as any)(new Request("http://test"), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json.items).toEqual([
      {
        id: "unit-7",
        tagName: "#7",
        name: "Sony Battery #7",
        returned: false,
        type: "numbered_bulk",
        bulkSkuId: "sku-1",
        bulkSkuName: "Sony Battery",
        unitNumber: 7,
      },
      {
        id: "unit-11",
        tagName: "#11",
        name: "Sony Battery #11",
        returned: true,
        type: "numbered_bulk",
        bulkSkuId: "sku-1",
        bulkSkuName: "Sony Battery",
        unitNumber: 11,
      },
    ]);
    expect(json.scanSummary).toEqual({
      serializedTotal: 0,
      numberedBulkTotal: 2,
      numberedBulkCompleted: 1,
    });
  });
});

describe("kiosk pickup serialized scan guard", () => {
  it("records successful serialized pickup scans before confirmation", async () => {
    mocks.scanKioskPickupBulkUnit.mockResolvedValue({ handled: false });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      requesterUserId: "user-1",
    });
    mocks.findAssetByScanValue.mockResolvedValue({
      id: "asset-1",
      assetTag: "FX3 1",
      name: "FX3 1",
    });
    mocks.bookingSerializedItemFindUnique.mockResolvedValue({
      id: "serialized-1",
      bookingId: "booking-1",
      assetId: "asset-1",
    });
    mocks.scanEventCreate.mockResolvedValue({ id: "scan-1" });

    const res = await (scanKioskPickup as any)(new Request("http://test", {
      method: "POST",
      headers: { "user-agent": "vitest-kiosk" },
      body: JSON.stringify({ scanValue: "23723854" }),
    }), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(mocks.findAssetByScanValue).toHaveBeenCalledWith("23723854", {
      id: true,
      assetTag: true,
      name: true,
    });
    expect(mocks.scanEventCreate).toHaveBeenCalledWith({
      data: {
        bookingId: "booking-1",
        actorUserId: "user-1",
        scanType: "SERIALIZED",
        scanValue: "23723854",
        success: true,
        phase: "CHECKOUT",
        assetId: "asset-1",
        deviceContext: "vitest-kiosk",
      },
    });
    expect(mocks.badgeOnScanResult).toHaveBeenCalledWith({
      userId: "user-1",
      bookingId: "booking-1",
      phase: "pickup",
      ok: true,
      sourceKey: "scan-1",
    });
  });

  it("returns duplicate feedback for repeated serialized pickup scans", async () => {
    mocks.scanKioskPickupBulkUnit.mockResolvedValue({ handled: false });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      requesterUserId: "user-1",
    });
    mocks.findAssetByScanValue.mockResolvedValue({
      id: "asset-1",
      assetTag: "FX3 1",
      name: "FX3 1",
    });
    mocks.bookingSerializedItemFindUnique.mockResolvedValue({
      id: "serialized-1",
      bookingId: "booking-1",
      assetId: "asset-1",
    });
    mocks.scanEventFindFirst.mockResolvedValue({ id: "scan-1" });

    const res = await (scanKioskPickup as any)(new Request("http://test", {
      method: "POST",
      headers: { "user-agent": "vitest-kiosk" },
      body: JSON.stringify({ scanValue: "23723854" }),
    }), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json).toEqual({
      success: false,
      error: "FX3 1 already scanned",
      errorCode: "duplicate",
    });
    expect(mocks.scanEventCreate).not.toHaveBeenCalled();
    expect(mocks.badgeOnScanResult).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      bookingId: "booking-1",
      phase: "pickup",
      ok: false,
      errorCode: "duplicate",
    }));
  });

  it("blocks pickup confirmation until all serialized items are scanned", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", role: "STUDENT" });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      title: "Pickup",
      serializedItems: [{
        assetId: "asset-1",
        asset: { assetTag: "FX3 1", name: "FX3 1" },
      }],
      scanEvents: [],
      bulkItems: [],
    });

    await expect((confirmKioskPickup as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1" }),
    }), {
      params: { id: "booking-1" },
    })).rejects.toThrow("Scan FX3 1 before confirming pickup");

    expect(mocks.bookingUpdateMany).not.toHaveBeenCalled();
  });

  it("allows pickup confirmation after serialized items are scanned", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", role: "STUDENT" });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      title: "Pickup",
      serializedItems: [{
        assetId: "asset-1",
        asset: { assetTag: "FX3 1", name: "FX3 1" },
      }],
      scanEvents: [{ assetId: "asset-1", phase: "CHECKOUT" }],
      bulkItems: [],
    });
    mocks.createAuditEntryTx.mockResolvedValue({});

    const res = await (confirmKioskPickup as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1" }),
    }), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(mocks.bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: "booking-1", status: "PENDING_PICKUP" },
      data: { status: "OPEN" },
    });
    expect(mocks.createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: "user-1",
      action: "kiosk_pickup",
      after: expect.objectContaining({
        status: "OPEN",
        source: "KIOSK",
        kioskDeviceId: "kiosk-1",
      }),
    }));
    expect(mocks.badgeOnCheckoutOpened).toHaveBeenCalledWith({
      userId: "user-1",
      bookingId: "booking-1",
      source: "kiosk_pickup",
      sourceKey: "booking-1",
    });
  });

  it("blocks stale repeated pickup confirmation after another request opens it", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", role: "STUDENT" });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      title: "Pickup",
      serializedItems: [{
        assetId: "asset-1",
        asset: { assetTag: "FX3 1", name: "FX3 1" },
      }],
      scanEvents: [{ assetId: "asset-1", phase: "CHECKOUT" }],
      bulkItems: [],
    });
    mocks.bookingUpdateMany.mockResolvedValue({ count: 0 });

    await expect((confirmKioskPickup as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1" }),
    }), {
      params: { id: "booking-1" },
    })).rejects.toThrow("Pickup was already confirmed. Refresh this checkout.");

    expect(mocks.createAuditEntryTx).not.toHaveBeenCalled();
    expect(mocks.badgeOnCheckoutOpened).not.toHaveBeenCalled();
  });
});

describe("kiosk pickup confirm bulk guard", () => {
  it("blocks pickup confirmation until all planned battery units are scanned", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", role: "STUDENT" });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      title: "Pickup",
      serializedItems: [],
      scanEvents: [],
      bulkItems: [{
        plannedQuantity: 3,
        checkedOutQuantity: 2,
        bulkSku: { name: "Sony Battery" },
      }],
    });

    await expect((confirmKioskPickup as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1" }),
    }), {
      params: { id: "booking-1" },
    })).rejects.toThrow("Scan all Sony Battery units before confirming pickup");

    expect(mocks.bookingUpdateMany).not.toHaveBeenCalled();
  });
});
