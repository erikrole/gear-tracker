import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeBulkItem } from "./_helpers/factories";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: vi.fn().mockResolvedValue({ conflicts: [] }),
}));

import { db } from "@/lib/db";
import { markCheckoutCompleted } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
});

describe("markCheckoutCompleted", () => {
  function openCheckout(bulkItems: any[] = []) {
    return {
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      locationId: "loc-1",
      bulkItems,
    };
  }

  it("uses SERIALIZABLE isolation", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout());
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    await markCheckoutCompleted("b-1", "actor-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when checkout not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(markCheckoutCompleted("bad-id", "actor-1")).rejects.toThrow("Checkout not found");
  });

  it("throws 404 when booking is not a CHECKOUT", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "RESERVATION", status: "BOOKED", bulkItems: [],
    });
    await expect(markCheckoutCompleted("b-1", "actor-1")).rejects.toThrow("Checkout not found");
  });

  it("throws 400 when checkout is not OPEN", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "COMPLETED", bulkItems: [],
    });
    await expect(markCheckoutCompleted("b-1", "actor-1")).rejects.toThrow("not open");
  });

  it("sets status to COMPLETED and deactivates allocations", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout());
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    await markCheckoutCompleted("b-1", "actor-1");

    expect(mockTx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "COMPLETED" },
      })
    );
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b-1" },
        data: { active: false },
      })
    );
  });

  it("closes open checkin scan sessions", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout());
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    await markCheckoutCompleted("b-1", "actor-1");

    expect(mockTx.scanSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: "b-1",
          phase: "CHECKIN",
          status: "OPEN",
        }),
      })
    );
  });

  it("creates audit log entry", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout());
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    await markCheckoutCompleted("b-1", "actor-1");

    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "actor-1",
          action: "checkin_completed",
        }),
      })
    );
  });

  // ── REGRESSION: only return unreturned items to stock ──────────────────
  it("subtracts checkedInQuantity from return amount (no double-return)", async () => {
    const bulkItem = makeBulkItem({
      bulkSkuId: "sku-1",
      plannedQuantity: 10,
      checkedOutQuantity: 10,
      checkedInQuantity: 5, // 5 already returned via checkinBulkItem
      bulkSku: { trackByNumber: false },
      unitAllocations: [],
    });
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.bulkStockBalance.findMany.mockResolvedValue([]);
    mockTx.bulkStockBalance.upsert.mockResolvedValue({});
    mockTx.bulkStockMovement.createMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    await markCheckoutCompleted("b-1", "actor-1");

    // Only the unreturned quantity (10 - 5 = 5) should be returned to stock
    const movementCall = mockTx.bulkStockMovement.createMany.mock.calls[0]?.[0];
    expect(movementCall?.data?.[0]?.quantity).toBe(5);
  });

  it("skips stock return when all items already checked in", async () => {
    const bulkItem = makeBulkItem({
      bulkSkuId: "sku-1",
      plannedQuantity: 10,
      checkedOutQuantity: 10,
      checkedInQuantity: 10, // all already returned
      bulkSku: { trackByNumber: false },
      unitAllocations: [],
    });
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    await markCheckoutCompleted("b-1", "actor-1");

    // No stock movement should be created since all items were already returned
    expect(mockTx.bulkStockMovement.createMany).not.toHaveBeenCalled();
  });
});
