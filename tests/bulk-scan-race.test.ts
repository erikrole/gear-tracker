import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScanPhase, ScanType } from "@prisma/client";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn() },
    scanEvent: { findFirst: vi.fn(), create: vi.fn() },
    bookingBulkItem: { findUnique: vi.fn(), update: vi.fn() },
    bulkSkuUnit: { findMany: vi.fn(), updateMany: vi.fn() },
    bookingBulkUnitAllocation: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
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

type BulkScanMockTx = {
  booking: { findUnique: ReturnType<typeof vi.fn> };
  scanEvent: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  bookingBulkItem: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  bulkSkuUnit: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  bookingBulkUnitAllocation: { createMany: ReturnType<typeof vi.fn> };
};

const mockTx = (db as unknown as { _mockTx: BulkScanMockTx })._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
  vi.clearAllMocks();
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
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
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
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
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
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
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
        phase: ScanPhase.CHECKOUT,
        scanType: ScanType.BULK_BIN,
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
        phase: ScanPhase.CHECKOUT,
        scanType: ScanType.BULK_BIN,
        scanValue: "BIN-QR-1",
      })
    ).rejects.toThrow("Bulk scans require a positive quantity");
  });
});

describe("numbered bulk derived unit QR scans", () => {
  function setupNumberedBulkScan() {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [{
        id: "bi-1",
        bulkSkuId: "sku-1",
        plannedQuantity: 16,
        checkedOutQuantity: 0,
        checkedInQuantity: 0,
        bulkSku: { id: "sku-1", binQrCodeValue: "94e068d1", trackByNumber: true },
      }],
    });
    mockTx.bulkSkuUnit.findMany.mockResolvedValue([
      { id: "unit-7", bulkSkuId: "sku-1", unitNumber: 7, status: "AVAILABLE" },
    ]);
    mockTx.scanEvent.create.mockResolvedValue({ id: "event-1" });
    mockTx.bulkSkuUnit.updateMany.mockResolvedValue({ count: 1 });
    mockTx.bookingBulkUnitAllocation.createMany.mockResolvedValue({ count: 1 });
    mockTx.bookingBulkItem.update.mockResolvedValue({});
  }

  it("treats binQr-unitNumber as a one-unit checkout scan", async () => {
    setupNumberedBulkScan();

    const result = await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
      scanValue: "94e068d1-7",
    });

    expect(result.success).toBe(true);
    expect(mockTx.bulkSkuUnit.findMany).toHaveBeenCalledWith({
      where: {
        bulkSkuId: "sku-1",
        unitNumber: { in: [7] },
      },
    });
    expect(mockTx.scanEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scanValue: "94e068d1-7",
        bulkSkuId: "sku-1",
        quantity: 1,
        success: true,
      }),
    });
    expect(mockTx.bookingBulkItem.update).toHaveBeenCalledWith({
      where: { id: "bi-1" },
      data: { checkedOutQuantity: { increment: 1 } },
    });
  });

  it("still rejects derived unit QR values for SKUs outside the checkout", async () => {
    setupNumberedBulkScan();

    await expect(recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
      scanValue: "not-this-bin-7",
    })).rejects.toThrow("Scanned bulk bin QR does not belong to this checkout");
  });

  it("rejects a derived unit QR when that unit is unavailable", async () => {
    setupNumberedBulkScan();
    mockTx.bulkSkuUnit.findMany.mockResolvedValue([
      { id: "unit-7", bulkSkuId: "sku-1", unitNumber: 7, status: "CHECKED_OUT" },
    ]);

    await expect(recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
      scanValue: "94e068d1-7",
    })).rejects.toThrow("Units not available");
  });

  it("keeps exact bin QR matches ahead of derived unit parsing", async () => {
    mockTx.scanEvent.findFirst.mockResolvedValue(null);
    mockTx.booking.findUnique.mockResolvedValue({
      id: "b-1",
      kind: "CHECKOUT",
      status: "OPEN",
      serializedItems: [],
      bulkItems: [
        {
          id: "numbered-bi",
          bulkSkuId: "numbered-sku",
          plannedQuantity: 16,
          checkedOutQuantity: 0,
          checkedInQuantity: 0,
          bulkSku: { id: "numbered-sku", binQrCodeValue: "94e068d1", trackByNumber: true },
        },
        {
          id: "quantity-bi",
          bulkSkuId: "quantity-sku",
          plannedQuantity: 10,
          checkedOutQuantity: 0,
          checkedInQuantity: 0,
          bulkSku: { id: "quantity-sku", binQrCodeValue: "94e068d1-7", trackByNumber: false },
        },
      ],
    });
    mockTx.bookingBulkItem.findUnique.mockResolvedValue({
      id: "quantity-bi",
      bulkSkuId: "quantity-sku",
      plannedQuantity: 10,
      checkedOutQuantity: 0,
      checkedInQuantity: 0,
    });
    mockTx.scanEvent.create.mockResolvedValue({ id: "event-1" });
    mockTx.bookingBulkItem.update.mockResolvedValue({});

    await recordScan({
      bookingId: "b-1",
      actorUserId: "actor-1",
      phase: ScanPhase.CHECKOUT,
      scanType: ScanType.BULK_BIN,
      scanValue: "94e068d1-7",
      quantity: 2,
    });

    expect(mockTx.bulkSkuUnit.findMany).not.toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.update).toHaveBeenCalledWith({
      where: {
        bookingId_bulkSkuId: {
          bookingId: "b-1",
          bulkSkuId: "quantity-sku",
        },
      },
      data: { checkedOutQuantity: { increment: 2 } },
    });
  });
});
