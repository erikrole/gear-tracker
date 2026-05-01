import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bookingSerializedItem: { createMany: vi.fn() },
    bookingBulkItem: { createMany: vi.fn() },
    assetAllocation: { createMany: vi.fn(), updateMany: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
    $queryRaw: vi.fn(),
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
  checkAvailability: vi.fn().mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
  }),
}));

import { db } from "@/lib/db";
import { checkAvailability } from "@/lib/services/availability";
import { createBooking } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "CHECKOUT" as any,
    title: "Test Checkout",
    requesterUserId: "user-1",
    locationId: "loc-1",
    startsAt: new Date("2026-04-01T08:00:00Z"),
    endsAt: new Date("2026-04-01T17:00:00Z"),
    serializedAssetIds: [] as string[],
    bulkItems: [] as Array<{ bulkSkuId: string; quantity: number }>,
    createdBy: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  transactionCalls.length = 0;
  mockTx.booking.create.mockResolvedValue({ id: "b-new" });
  mockTx.$queryRaw.mockResolvedValue([{ nextval: 1n }]);
  mockTx.booking.update.mockResolvedValue({});
  mockTx.booking.findUniqueOrThrow.mockResolvedValue({ id: "b-new", refNumber: "CO-0001" });
  mockTx.bookingSerializedItem.createMany.mockResolvedValue({});
  mockTx.assetAllocation.createMany.mockResolvedValue({});
  mockTx.bookingBulkItem.createMany.mockResolvedValue({});
  mockTx.bulkStockBalance.findMany.mockResolvedValue([]);
  mockTx.bulkStockBalance.upsert.mockResolvedValue({});
  mockTx.bulkStockMovement.createMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
});

describe("createBooking", () => {
  it("uses SERIALIZABLE isolation", async () => {
    await createBooking(baseInput());
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("creates a CHECKOUT with OPEN status", async () => {
    await createBooking(baseInput({ kind: "CHECKOUT" }));
    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "CHECKOUT", status: "OPEN" }),
      })
    );
  });

  it("creates a RESERVATION with BOOKED status", async () => {
    await createBooking(baseInput({ kind: "RESERVATION" }));
    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "RESERVATION", status: "BOOKED" }),
      })
    );
  });

  it("generates ref number with CO- prefix for checkout", async () => {
    await createBooking(baseInput({ kind: "CHECKOUT" }));
    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refNumber: "CO-0001" }),
      })
    );
  });

  it("generates ref number with RV- prefix for reservation", async () => {
    await createBooking(baseInput({ kind: "RESERVATION" }));
    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refNumber: "RV-0001" }),
      })
    );
  });

  it("throws 409 on availability conflicts", async () => {
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [{ assetId: "a-1", conflictingBookingId: "b-other", startsAt: new Date(), endsAt: new Date() }],
      shortages: [],
      unavailableAssets: [],
    });

    await expect(createBooking(baseInput({ serializedAssetIds: ["a-1"] }))).rejects.toThrow("Availability conflict");
  });

  it("throws 409 on bulk shortages", async () => {
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [],
      shortages: [{ bulkSkuId: "sku-1", requested: 10, available: 2 }],
      unavailableAssets: [],
    });

    await expect(createBooking(baseInput({
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 10 }],
    }))).rejects.toThrow("Availability conflict");
  });

  it("creates serialized items and allocations", async () => {
    await createBooking(baseInput({ serializedAssetIds: ["a-1", "a-2"] }));

    expect(mockTx.bookingSerializedItem.createMany).toHaveBeenCalled();
    expect(mockTx.assetAllocation.createMany).toHaveBeenCalled();
  });

  it("creates bulk items and stock movements for CHECKOUT", async () => {
    // Need sufficient stock for upsertBulkBalancesAndMovements
    mockTx.bulkStockBalance.findMany.mockResolvedValue([
      { bulkSkuId: "sku-1", onHandQuantity: 100 },
    ]);

    await createBooking(baseInput({
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 5 }],
    }));

    expect(mockTx.bookingBulkItem.createMany).toHaveBeenCalled();
    expect(mockTx.bulkStockMovement.createMany).toHaveBeenCalled();
  });

  it("creates bulk items but NO stock movements for RESERVATION", async () => {
    await createBooking(baseInput({
      kind: "RESERVATION",
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 5 }],
    }));

    expect(mockTx.bookingBulkItem.createMany).toHaveBeenCalled();
    expect(mockTx.bulkStockMovement.createMany).not.toHaveBeenCalled();
  });

  it("creates audit log", async () => {
    await createBooking(baseInput());
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "created",
          entityType: "booking",
        }),
      })
    );
  });

  // Source reservation tests
  it("resolves items from source reservation", async () => {
    const sourceRes = {
      id: "rv-1",
      kind: "RESERVATION",
      status: "BOOKED",
      locationId: "loc-1",
      serializedItems: [{ assetId: "a-1" }],
      bulkItems: [{ bulkSkuId: "sku-1", plannedQuantity: 5 }],
    };
    mockTx.booking.findUnique.mockResolvedValue(sourceRes);
    mockTx.scanSession.updateMany.mockResolvedValue({});
    mockTx.assetAllocation.updateMany.mockResolvedValue({});
    // Need sufficient stock for checkout bulk movements
    mockTx.bulkStockBalance.findMany.mockResolvedValue([
      { bulkSkuId: "sku-1", onHandQuantity: 100 },
    ]);

    await createBooking(baseInput({ sourceReservationId: "rv-1" }));

    // Should cancel the source reservation
    expect(mockTx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rv-1" },
        data: { status: "CANCELLED" },
      })
    );
  });

  it("throws 404 when source reservation not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(createBooking(baseInput({ sourceReservationId: "rv-bad" }))).rejects.toThrow("Source reservation not found");
  });

  it("throws 400 when source is not a RESERVATION", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "rv-1", kind: "CHECKOUT", status: "OPEN", locationId: "loc-1",
      serializedItems: [], bulkItems: [],
    });
    await expect(createBooking(baseInput({ sourceReservationId: "rv-1" }))).rejects.toThrow("does not refer to a reservation");
  });

  it("throws 400 when source reservation is not BOOKED", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "rv-1", kind: "RESERVATION", status: "CANCELLED", locationId: "loc-1",
      serializedItems: [], bulkItems: [],
    });
    await expect(createBooking(baseInput({ sourceReservationId: "rv-1" }))).rejects.toThrow("not in BOOKED status");
  });

  it("throws 400 when source reservation has different location", async () => {
    mockTx.booking.findUnique.mockResolvedValue({
      id: "rv-1", kind: "RESERVATION", status: "BOOKED", locationId: "loc-other",
      serializedItems: [], bulkItems: [],
    });
    await expect(createBooking(baseInput({ sourceReservationId: "rv-1" }))).rejects.toThrow("different location");
  });
});
