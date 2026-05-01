import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn() },
    scanEvent: { findFirst: vi.fn(), create: vi.fn() },
    bookingBulkItem: { findUnique: vi.fn(), update: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    scanSession: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    overrideEvent: { count: vi.fn(), create: vi.fn() },
    bookingSerializedItem: { updateMany: vi.fn() },
    assetAllocation: { updateMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      scanEvent: { create: vi.fn() },
      _mockTx: mockTx,
    },
  };
});

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntries: vi.fn(),
  createAuditEntryTx: vi.fn(),
  createAuditEntriesTx: vi.fn(),
  createSystemAuditEntry: vi.fn(),
  lookupActorRole: vi.fn().mockResolvedValue("ADMIN"),
  AUDIT_RETENTION_DAYS: 90,
}));

vi.mock("@/lib/services/bookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/bookings")>();
  return {
    ...actual,
    markCheckoutCompleted: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: vi.fn().mockResolvedValue({ conflicts: [] }),
}));

import { db } from "@/lib/db";
import { recordScan } from "@/lib/services/scans";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
});

// ═════════════════════════════════════════════════════════════════════════════
// REGRESSION: Non-numbered bulk scan quantity guard + increment must be atomic
// Previously the guard ran outside the transaction (TOCTOU gap). Now both the
// guard and increment run inside a single SERIALIZABLE transaction.
// ═════════════════════════════════════════════════════════════════════════════
describe("non-numbered bulk scan TOCTOU", () => {
  function setupBulkScan(checkedOut = 0, planned = 10) {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [{
        id: "bi-1",
        bulkSkuId: "sku-1",
        plannedQuantity: planned,
        checkedOutQuantity: checkedOut,
        checkedInQuantity: 0,
        bulkSku: { id: "sku-1", binQrCodeValue: "BIN-QR-1", trackByNumber: false },
      }],
    });
    // Mock the fresh re-read inside the guard transaction
    mockTx.bookingBulkItem.findUnique.mockResolvedValue({
      id: "bi-1",
      bulkSkuId: "sku-1",
      plannedQuantity: planned,
      checkedOutQuantity: checkedOut,
      checkedInQuantity: 0,
    });
    mockTx.scanEvent.create.mockResolvedValue({ id: "event-1" });
    mockTx.bookingBulkItem.update.mockResolvedValue({});
  }

  it("uses SERIALIZABLE on both transactions (guard + increment are atomic)", async () => {
    setupBulkScan(0, 10);

    await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
      scanType: "BULK_BIN" as any,
      scanValue: "BIN-QR-1",
      quantity: 5,
    });

    // Both transactions must use SERIALIZABLE isolation
    expect(transactionCalls.length).toBeGreaterThanOrEqual(2);
    expectSerializableIsolation(transactionCalls, 0); // dedup + booking lookup
    expectSerializableIsolation(transactionCalls, 1); // guard + increment
  });

  it("re-reads bulkItem inside transaction for fresh quantity", async () => {
    setupBulkScan(0, 10);

    await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
      scanType: "BULK_BIN" as any,
      scanValue: "BIN-QR-1",
      quantity: 5,
    });

    // The guard transaction re-reads the bulkItem to get fresh quantity
    expect(mockTx.bookingBulkItem.findUnique).toHaveBeenCalled();
  });

  it("creates scan event and increments quantity on success", async () => {
    setupBulkScan(3, 10);

    const result = await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: "CHECKOUT" as any,
      scanType: "BULK_BIN" as any,
      scanValue: "BIN-QR-1",
      quantity: 2,
    });

    expect(result.success).toBe(true);
    expect(mockTx.scanEvent.create).toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { checkedOutQuantity: { increment: 2 } },
      })
    );
  });

  it("rejects quantity exceeding planned", async () => {
    setupBulkScan(8, 10);

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "BULK_BIN" as any,
        scanValue: "BIN-QR-1",
        quantity: 5,
      })
    ).rejects.toThrow("Scan would exceed");
  });

  it("rejects bulk scan without quantity", async () => {
    setupBulkScan(0, 10);

    await expect(
      recordScan({
        bookingId: "b-1",
        actorUserId: "actor-1",
        phase: "CHECKOUT" as any,
        scanType: "BULK_BIN" as any,
        scanValue: "BIN-QR-1",
      })
    ).rejects.toThrow("Bulk scans require a positive quantity");
  });
});
