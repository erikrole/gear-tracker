import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeBulkItem } from "./_helpers/factories";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    bookingBulkItem: { update: vi.fn(), findMany: vi.fn() },
    bookingSerializedItem: { count: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
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
import { checkinBulkItem } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

function openCheckout(bulkItems: any[] = []) {
  return {
    id: "b-1",
    kind: "CHECKOUT",
    status: "OPEN",
    locationId: "loc-1",
    serializedItems: [],
    bulkItems,
  };
}

beforeEach(() => {
  transactionCalls.length = 0;
  mockTx.bookingBulkItem.update.mockResolvedValue({});
  mockTx.bulkStockBalance.findMany.mockResolvedValue([]);
  mockTx.bulkStockBalance.upsert.mockResolvedValue({});
  mockTx.bulkStockMovement.createMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
  // Default: not auto-completing (active items remain)
  mockTx.bookingSerializedItem.count.mockResolvedValue(0);
  mockTx.bookingBulkItem.findMany.mockResolvedValue([
    { checkedInQuantity: 3, checkedOutQuantity: 10, plannedQuantity: 10 },
  ]);
});

describe("checkinBulkItem", () => {
  const bulkItem = makeBulkItem({
    id: "bi-1",
    bookingId: "b-1",
    bulkSkuId: "sku-1",
    plannedQuantity: 10,
    checkedOutQuantity: 10,
    checkedInQuantity: 3,
  });

  it("uses SERIALIZABLE isolation", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    await checkinBulkItem("b-1", "actor-1", "bi-1", 2);
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("increments checkedInQuantity", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));

    const result = await checkinBulkItem("b-1", "actor-1", "bi-1", 2);

    expect(result.success).toBe(true);
    expect(result.checkedInQuantity).toBe(5); // 3 + 2
    expect(mockTx.bookingBulkItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bi-1" },
        data: { checkedInQuantity: 5 },
      })
    );
  });

  it("returns stock to location balance", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    await checkinBulkItem("b-1", "actor-1", "bi-1", 2);

    expect(mockTx.bulkStockMovement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            bulkSkuId: "sku-1",
            quantity: 2,
            kind: "CHECKIN",
          }),
        ]),
      })
    );
  });

  it("throws 404 when checkout not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(checkinBulkItem("bad", "actor-1", "bi-1", 1)).rejects.toThrow("Checkout not found");
  });

  it("throws 404 when booking is RESERVATION", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "RESERVATION", status: "BOOKED", serializedItems: [], bulkItems: [],
    });
    await expect(checkinBulkItem("b-1", "actor-1", "bi-1", 1)).rejects.toThrow("Checkout not found");
  });

  it("throws 400 when checkout is not OPEN", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1", kind: "CHECKOUT", status: "COMPLETED", serializedItems: [], bulkItems: [bulkItem],
    });
    await expect(checkinBulkItem("b-1", "actor-1", "bi-1", 1)).rejects.toThrow("only check in items from an open");
  });

  it("throws 400 when bulk item not in checkout", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    await expect(checkinBulkItem("b-1", "actor-1", "wrong-id", 1)).rejects.toThrow("Bulk item not in this checkout");
  });

  it("throws 400 for zero quantity", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    await expect(checkinBulkItem("b-1", "actor-1", "bi-1", 0)).rejects.toThrow("Invalid quantity");
  });

  it("throws 400 for quantity exceeding remaining", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    // remaining = 10 - 3 = 7, trying to return 8
    await expect(checkinBulkItem("b-1", "actor-1", "bi-1", 8)).rejects.toThrow("Invalid quantity");
  });

  it("auto-completes when all items returned", async () => {
    const fullyReturned = makeBulkItem({
      id: "bi-1",
      bookingId: "b-1",
      bulkSkuId: "sku-1",
      plannedQuantity: 5,
      checkedOutQuantity: 5,
      checkedInQuantity: 4, // returning 1 more = complete
    });
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([fullyReturned]));
    // After update, all bulk items are fully returned
    mockTx.bookingBulkItem.findMany.mockResolvedValue([
      { checkedInQuantity: 5, checkedOutQuantity: 5, plannedQuantity: 5 },
    ]);
    mockTx.bookingSerializedItem.count.mockResolvedValue(0);
    mockTx.booking.update.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    mockTx.scanSession.updateMany.mockResolvedValue({});

    const result = await checkinBulkItem("b-1", "actor-1", "bi-1", 1);

    expect(result.autoCompleted).toBe(true);
  });

  it("creates audit log", async () => {
    mockTx.booking.findUnique.mockResolvedValue(openCheckout([bulkItem]));
    await checkinBulkItem("b-1", "actor-1", "bi-1", 2);

    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "partial_bulk_checkin",
        }),
      })
    );
  });
});
