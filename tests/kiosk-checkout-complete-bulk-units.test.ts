import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  bookingSerializedItemCreateMany: vi.fn(),
  assetAllocationCreateMany: vi.fn(),
  assetUpdateMany: vi.fn(),
  bulkSkuUnitFindMany: vi.fn(),
  bulkSkuUnitUpdateMany: vi.fn(),
  bookingBulkItemCreate: vi.fn(),
  bookingBulkUnitAllocationCreateMany: vi.fn(),
  createAuditEntry: vi.fn(),
  nextBookingRef: vi.fn(),
  upsertBulkBalancesAndMovements: vi.fn(),
  badgeOnCheckoutOpened: vi.fn(),
}));

type KioskTestHandler = (
  req: Request,
  ctx: {
    kiosk: {
      kioskId: string;
      locationId: string;
      locationName: string;
    };
  },
) => Promise<Response>;

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    user: { findFirst: mocks.userFindFirst },
  },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: (handler: KioskTestHandler) => (req: Request) =>
    handler(req, {
      kiosk: {
        kioskId: "kiosk-1",
        locationId: "loc-1",
        locationName: "Camp Randall",
      },
    }),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: mocks.createAuditEntry,
}));

vi.mock("@/lib/services/booking-ref", () => ({
  nextBookingRef: mocks.nextBookingRef,
}));

vi.mock("@/lib/services/bookings-helpers", () => ({
  upsertBulkBalancesAndMovements: mocks.upsertBulkBalancesAndMovements,
}));

vi.mock("@/lib/badges", () => ({
  badges: {
    onCheckoutOpened: mocks.badgeOnCheckoutOpened,
  },
}));

import { POST as completeKioskCheckout } from "@/app/api/kiosk/checkout/complete/route";
import { normalizeCheckoutCompleteItems } from "@/lib/services/kiosk-checkout-complete";

const runCompleteKioskCheckout = completeKioskCheckout as unknown as (req: Request) => Promise<Response>;

function completeRequest(items: Array<Record<string, unknown>>) {
  return new Request("http://test", {
    method: "POST",
    body: JSON.stringify({
      actorId: "user-1",
      locationId: "loc-1",
      items,
    }),
  });
}

function transactionClient() {
  return {
    booking: { create: mocks.bookingCreate },
    bookingSerializedItem: { createMany: mocks.bookingSerializedItemCreateMany },
    assetAllocation: { createMany: mocks.assetAllocationCreateMany },
    asset: { updateMany: mocks.assetUpdateMany },
    bulkSkuUnit: {
      findMany: mocks.bulkSkuUnitFindMany,
      updateMany: mocks.bulkSkuUnitUpdateMany,
    },
    bookingBulkItem: { create: mocks.bookingBulkItemCreate },
    bookingBulkUnitAllocation: { createMany: mocks.bookingBulkUnitAllocationCreateMany },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindFirst.mockResolvedValue({ id: "user-1", name: "Bucky Badger", role: "STUDENT" });
  mocks.nextBookingRef.mockResolvedValue("CO-1001");
  mocks.bookingCreate.mockResolvedValue({ id: "booking-1" });
  mocks.bulkSkuUnitFindMany.mockResolvedValue([
    {
      id: "unit-31",
      bulkSkuId: "sku-sony",
      unitNumber: 31,
      status: "AVAILABLE",
      bulkSku: { id: "sku-sony", name: "Sony Battery", active: true },
    },
  ]);
  mocks.bulkSkuUnitUpdateMany.mockResolvedValue({ count: 1 });
  mocks.bookingBulkItemCreate.mockResolvedValue({ id: "bulk-item-1" });
  mocks.transaction.mockImplementation((handler) => handler(transactionClient()));
});

describe("kiosk checkout complete bulk units", () => {
  it("normalizes old cart IDs and new typed battery unit items the same way", () => {
    expect(normalizeCheckoutCompleteItems([
      { assetId: "asset-1" },
      { assetId: "bulk:sku-sony:unit:31" },
      { bulkSkuId: "sku-sony", unitNumber: 32 },
    ])).toEqual({
      assetIds: ["asset-1"],
      bulkUnitItems: [
        { bulkSkuId: "sku-sony", unitNumber: 31 },
        { bulkSkuId: "sku-sony", unitNumber: 32 },
      ],
    });
  });

  it("persists a legacy battery cart item as a numbered bulk checkout", async () => {
    const res = await runCompleteKioskCheckout(completeRequest([
      { assetId: "bulk:sku-sony:unit:31" },
    ]));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.itemCount).toBe(1);
    expect(mocks.bookingSerializedItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.assetAllocationCreateMany).not.toHaveBeenCalled();
    expect(mocks.assetUpdateMany).not.toHaveBeenCalled();
    expect(mocks.bulkSkuUnitFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ bulkSkuId: "sku-sony", unitNumber: 31 }],
      },
      include: {
        bulkSku: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
    });
    expect(mocks.bookingBulkItemCreate).toHaveBeenCalledWith({
      data: {
        bookingId: "booking-1",
        bulkSkuId: "sku-sony",
        plannedQuantity: 1,
        checkedOutQuantity: 1,
      },
    });
    expect(mocks.bookingBulkUnitAllocationCreateMany).toHaveBeenCalledWith({
      data: [{
        bookingBulkItemId: "bulk-item-1",
        bulkSkuUnitId: "unit-31",
        checkedOutAt: expect.any(Date),
      }],
    });
    expect(mocks.upsertBulkBalancesAndMovements).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      locationId: "loc-1",
      bookingId: "booking-1",
      actorUserId: "user-1",
      items: [{ bulkSkuId: "sku-sony", quantity: 1 }],
    }));
    expect(mocks.createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "kiosk_checkout",
      after: expect.objectContaining({ itemCount: 1 }),
    }));
    expect(mocks.badgeOnCheckoutOpened).toHaveBeenCalledWith({
      userId: "user-1",
      bookingId: "booking-1",
      source: "kiosk_checkout",
      sourceKey: "booking-1",
    });
  });
});
