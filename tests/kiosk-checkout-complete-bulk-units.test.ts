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
  calendarEventFindFirst: vi.fn(),
  bookingEventCreate: vi.fn(),
  createAuditEntry: vi.fn(),
  nextBookingRef: vi.fn(),
  upsertBulkBalancesAndMovements: vi.fn(),
  badgeOnCheckoutOpened: vi.fn(),
  checkAvailability: vi.fn(),
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

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: mocks.checkAvailability,
}));

vi.mock("@/lib/badges", () => ({
  badges: {
    onCheckoutOpened: mocks.badgeOnCheckoutOpened,
  },
}));

import { POST as completeKioskCheckout } from "@/app/api/kiosk/checkout/complete/route";
import { normalizeCheckoutCompleteItems } from "@/lib/services/kiosk-checkout-complete";

const runCompleteKioskCheckout = completeKioskCheckout as unknown as (req: Request) => Promise<Response>;

function completeRequest(items: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return new Request("http://test", {
    method: "POST",
    body: JSON.stringify({
      actorId: "user-1",
      locationId: "loc-1",
      items,
      endsAt: tomorrow,
      customPurpose: "Practice checkout",
      ...extra,
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
    calendarEvent: { findFirst: mocks.calendarEventFindFirst },
    bookingEvent: { create: mocks.bookingEventCreate },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindFirst.mockResolvedValue({ id: "user-1", name: "Bucky Badger", role: "STUDENT" });
  mocks.nextBookingRef.mockResolvedValue("CO-1001");
  mocks.bookingCreate.mockImplementation(({ data }) => Promise.resolve({
    id: "booking-1",
    title: data.title,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
  }));
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
  mocks.calendarEventFindFirst.mockResolvedValue(null);
  mocks.checkAvailability.mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
    upcomingCommitments: [],
    turnaroundRisks: [],
    bulkTurnaroundRisks: [],
  });
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
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Practice checkout",
        eventId: undefined,
      }),
    });
    expect(mocks.bookingEventCreate).not.toHaveBeenCalled();
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

  it("links a selected event and uses the event summary as the booking title", async () => {
    mocks.calendarEventFindFirst.mockResolvedValue({
      id: "event-1",
      summary: "Volleyball vs Iowa",
      sportCode: "VB",
      endsAt: new Date("2026-06-16T21:00:00.000Z"),
    });

    const res = await runCompleteKioskCheckout(completeRequest(
      [{ assetId: "asset-1" }],
      { eventId: "event-1", customPurpose: "Broadcast camera" },
    ));

    expect(res.status).toBe(200);
    expect(mocks.calendarEventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "event-1",
        isHidden: false,
        archivedAt: null,
      }),
      select: { id: true, summary: true, sportCode: true, endsAt: true },
    }));
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Volleyball vs Iowa",
        eventId: "event-1",
        sportCode: "VB",
        notes: expect.stringContaining("Purpose: Broadcast camera"),
      }),
    });
    expect(mocks.bookingEventCreate).toHaveBeenCalledWith({
      data: {
        bookingId: "booking-1",
        eventId: "event-1",
        ordinal: 0,
      },
    });
  });

  it("requires an event or custom purpose", async () => {
    await expect(runCompleteKioskCheckout(completeRequest(
      [{ assetId: "asset-1" }],
      { customPurpose: undefined },
    ))).rejects.toThrow("Select an event or enter what this checkout is for");
  });

  it("uses the selected return time for checkout allocations and conflict checks", async () => {
    const endsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const res = await runCompleteKioskCheckout(completeRequest(
      [{ assetId: "asset-1" }],
      { endsAt },
    ));

    expect(res.status).toBe(200);
    expect(mocks.checkAvailability).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      locationId: "loc-1",
      serializedAssetIds: ["asset-1"],
      bulkItems: [],
      bookingKind: "CHECKOUT",
      startsAt: expect.any(Date),
      endsAt: new Date(endsAt),
    }));
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startsAt: expect.any(Date),
        endsAt: new Date(endsAt),
      }),
    });
    expect(mocks.assetAllocationCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        assetId: "asset-1",
        startsAt: expect.any(Date),
        endsAt: new Date(endsAt),
      })],
    });
  });

  it("ignores client-supplied location and records the authenticated kiosk location", async () => {
    const res = await runCompleteKioskCheckout(completeRequest(
      [{ assetId: "asset-1" }],
      { locationId: "client-supplied-location" },
    ));

    expect(res.status).toBe(200);
    expect(mocks.checkAvailability).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      locationId: "loc-1",
    }));
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locationId: "loc-1",
        pickupKioskDeviceId: "kiosk-1",
      }),
    });
    expect(mocks.assetUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["asset-1"] } },
      data: { locationId: "loc-1" },
    });
  });

  it("uses the kiosk location when the request omits a location", async () => {
    const res = await runCompleteKioskCheckout(completeRequest(
      [{ assetId: "asset-1" }],
      { locationId: undefined },
    ));

    expect(res.status).toBe(200);
    expect(mocks.checkAvailability).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      locationId: "loc-1",
      serializedAssetIds: ["asset-1"],
    }));
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locationId: "loc-1",
      }),
    });
  });

  it("rejects checkout completion when availability finds a blocking conflict", async () => {
    const endsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    mocks.checkAvailability.mockResolvedValue({
      conflicts: [{
        assetId: "asset-1",
        conflictingBookingId: "booking-2",
        conflictingBookingTitle: "Practice",
        startsAt: new Date("2026-06-16T20:00:00.000Z"),
        endsAt: new Date("2026-06-16T22:00:00.000Z"),
      }],
      shortages: [],
      unavailableAssets: [],
      upcomingCommitments: [],
      turnaroundRisks: [],
      bulkTurnaroundRisks: [],
    });

    await expect(runCompleteKioskCheckout(completeRequest(
      [{ assetId: "asset-1" }],
      { endsAt },
    ))).rejects.toThrow("One or more items are not available for the selected return time");
    expect(mocks.bookingCreate).not.toHaveBeenCalled();
  });

  it("maps a last-second allocation constraint race to a friendly conflict", async () => {
    mocks.assetAllocationCreateMany.mockRejectedValue({
      code: "23P01",
      message: "violates exclusion constraint asset_allocations_no_overlap",
    });

    await expect(runCompleteKioskCheckout(completeRequest([
      { assetId: "asset-1" },
    ]))).rejects.toThrow("One or more items are no longer available");
    expect(mocks.createAuditEntry).not.toHaveBeenCalled();
    expect(mocks.badgeOnCheckoutOpened).not.toHaveBeenCalled();
  });
});
