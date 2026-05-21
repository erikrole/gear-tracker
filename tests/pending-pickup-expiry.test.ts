import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

const transactionCalls: Array<{ options: unknown }> = [];

vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    bookingBulkUnitAllocation: { updateMany: vi.fn() },
    bulkSkuUnit: { updateMany: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  return {
    db: {
      booking: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

vi.mock("@/lib/services/reservation-rules", () => ({
  loadReservationRules: vi.fn(async () => ({
    advanceWindowDays: null,
    noShowExpiryHours: 48,
    maxConcurrentReservations: null,
  })),
}));

import { db } from "@/lib/db";
import { expirePendingPickupCheckouts } from "@/lib/services/pending-pickup-expiry";

const mockDb = db as unknown as {
  booking: { findMany: ReturnType<typeof vi.fn> };
  _mockTx: {
    booking: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    bulkStockBalance: { findMany: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    bulkStockMovement: { createMany: ReturnType<typeof vi.fn> };
    bookingBulkUnitAllocation: { updateMany: ReturnType<typeof vi.fn> };
    bulkSkuUnit: { updateMany: ReturnType<typeof vi.fn> };
    assetAllocation: { updateMany: ReturnType<typeof vi.fn> };
    scanSession: { updateMany: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
  };
};

const mockTx = mockDb._mockTx;
const now = new Date("2026-05-13T12:00:00.000Z");
const staleStart = new Date(now.getTime() - 49 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  transactionCalls.length = 0;
  mockDb.booking.findMany.mockResolvedValue([{ id: "booking-1" }]);
  mockTx.booking.findUnique.mockResolvedValue({
    id: "booking-1",
    kind: "CHECKOUT",
    status: "PENDING_PICKUP",
    startsAt: staleStart,
    locationId: "loc-1",
    createdBy: "creator-1",
    bulkItems: [
      {
        id: "bulk-item-1",
        bulkSkuId: "bulk-1",
        plannedQuantity: 3,
        checkedInQuantity: 0,
        unitAllocations: [{ bulkSkuUnitId: "unit-1" }],
      },
    ],
  });
  mockTx.bulkStockBalance.findMany.mockResolvedValue([{ bulkSkuId: "bulk-1", onHandQuantity: 2 }]);
  mockTx.bulkStockBalance.upsert.mockResolvedValue({});
  mockTx.bulkStockMovement.createMany.mockResolvedValue({});
  mockTx.bookingBulkUnitAllocation.updateMany.mockResolvedValue({});
  mockTx.bulkSkuUnit.updateMany.mockResolvedValue({});
  mockTx.assetAllocation.updateMany.mockResolvedValue({});
  mockTx.scanSession.updateMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
});

describe("expirePendingPickupCheckouts", () => {
  it("expires stale pending pickups with inventory release and system audit", async () => {
    const result = await expirePendingPickupCheckouts(now);

    expect(result).toMatchObject({ scanned: 1, expired: 1, failed: 0, errors: {} });
    expectSerializableIsolation(transactionCalls, 0);
    expect(mockDb.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        kind: "CHECKOUT",
        status: "PENDING_PICKUP",
        startsAt: { lt: new Date("2026-05-11T12:00:00.000Z") },
      }),
      take: 50,
    }));
    expect(mockTx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { status: "CANCELLED" },
    });
    expect(mockTx.bulkStockBalance.upsert).toHaveBeenCalledWith({
      where: { bulkSkuId_locationId: { bulkSkuId: "bulk-1", locationId: "loc-1" } },
      create: { bulkSkuId: "bulk-1", locationId: "loc-1", onHandQuantity: 5 },
      update: { onHandQuantity: 5 },
    });
    expect(mockTx.bulkStockMovement.createMany).toHaveBeenCalledWith({
      data: [{
        bulkSkuId: "bulk-1",
        locationId: "loc-1",
        bookingId: "booking-1",
        actorUserId: "creator-1",
        kind: "CHECKIN",
        quantity: 3,
        reason: "pending_pickup_auto_expired",
      }],
    });
    expect(mockTx.bookingBulkUnitAllocation.updateMany).toHaveBeenCalledWith({
      where: {
        bookingBulkItemId: { in: ["bulk-item-1"] },
        bulkSkuUnitId: { in: ["unit-1"] },
        checkedOutAt: { not: null },
        checkedInAt: null,
      },
      data: { checkedInAt: now },
    });
    expect(mockTx.bulkSkuUnit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["unit-1"] } },
      data: { status: "AVAILABLE" },
    });
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "booking-1" },
      data: { active: false },
    });
    expect(mockTx.scanSession.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "booking-1", status: "OPEN" },
      data: { status: "CANCELLED" },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: undefined,
        entityType: "booking",
        entityId: "booking-1",
        action: "pending_pickup_expired",
      }),
    });
  });

  it("skips candidates that are no longer stale inside the transaction", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      kind: "CHECKOUT",
      status: "PENDING_PICKUP",
      startsAt: new Date("2026-05-12T12:30:00.000Z"),
      locationId: "loc-1",
      createdBy: "creator-1",
      bulkItems: [],
    });

    const result = await expirePendingPickupCheckouts(now);

    expect(result).toMatchObject({ scanned: 1, expired: 0, failed: 0, errors: {} });
    expect(mockTx.booking.update).not.toHaveBeenCalled();
  });
});
