import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    bookingSerializedItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    bookingBulkItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    assetAllocation: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
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
import { updateReservation, updateCheckout } from "@/lib/services/bookings";

const mockTx = (db as any)._mockTx;

const startsAt = new Date("2026-04-10T08:00:00Z");
const endsAt = new Date("2026-04-10T17:00:00Z");

function makeExistingReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    kind: "RESERVATION",
    status: "BOOKED",
    title: "Game Day Gear",
    locationId: "loc-1",
    startsAt,
    endsAt,
    notes: null,
    serializedItems: [{ assetId: "a-1" }],
    bulkItems: [{ bulkSkuId: "sku-1", plannedQuantity: 5 }],
    ...overrides,
  };
}

function makeExistingCheckout(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    kind: "CHECKOUT",
    status: "OPEN",
    title: "Practice Checkout",
    locationId: "loc-1",
    startsAt,
    endsAt,
    notes: null,
    serializedItems: [{ assetId: "a-1" }],
    bulkItems: [{ bulkSkuId: "sku-1", plannedQuantity: 5 }],
    ...overrides,
  };
}

const returnedBooking = { id: "r-1", kind: "RESERVATION", status: "BOOKED" };

beforeEach(() => {
  vi.clearAllMocks();
  transactionCalls.length = 0;
  mockTx.booking.update.mockResolvedValue({});
  mockTx.booking.findUniqueOrThrow.mockResolvedValue(returnedBooking);
  mockTx.bookingSerializedItem.deleteMany.mockResolvedValue({});
  mockTx.bookingSerializedItem.createMany.mockResolvedValue({});
  mockTx.bookingBulkItem.deleteMany.mockResolvedValue({});
  mockTx.bookingBulkItem.createMany.mockResolvedValue({});
  mockTx.assetAllocation.deleteMany.mockResolvedValue({});
  mockTx.assetAllocation.createMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
  mockTx.auditLog.createMany.mockResolvedValue({});
  vi.mocked(checkAvailability).mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateReservation
// ═══════════════════════════════════════════════════════════════════════════════
describe("updateReservation", () => {
  it("uses SERIALIZABLE isolation", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await updateReservation("r-1", "actor-1", { title: "Updated" });

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("updates title and creates audit log", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await updateReservation("r-1", "actor-1", { title: "New Title" });

    expect(mockTx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-1" },
        data: expect.objectContaining({ title: "New Title" }),
      })
    );
  });

  it("checks availability with excludeBookingId", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await updateReservation("r-1", "actor-1", { title: "Updated" });

    expect(checkAvailability).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ excludeBookingId: "r-1" })
    );
  });

  it("throws 409 on availability conflict", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [{ assetId: "a-1", conflictingBookingId: "b-other", startsAt: new Date(), endsAt: new Date() }],
      shortages: [],
      unavailableAssets: [],
    });

    await expect(
      updateReservation("r-1", "actor-1", { title: "Updated" })
    ).rejects.toThrow("Availability conflict");
  });

  it("rebuilds serialized items and allocations", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await updateReservation("r-1", "actor-1", { serializedAssetIds: ["a-1", "a-2"] });

    expect(mockTx.bookingSerializedItem.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "r-1" } });
    expect(mockTx.assetAllocation.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "r-1" } });
    expect(mockTx.bookingSerializedItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ bookingId: "r-1", assetId: "a-1" }),
        expect.objectContaining({ bookingId: "r-1", assetId: "a-2" }),
      ]),
    });
  });

  it("throws 404 when reservation not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(updateReservation("bad-id", "actor-1", {})).rejects.toThrow("Reservation not found");
  });

  it("throws 400 when booking is a CHECKOUT", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());
    await expect(updateReservation("c-1", "actor-1", {})).rejects.toThrow("Only reservations");
  });

  it("throws 400 when reservation is CANCELLED", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation({ status: "CANCELLED" }));
    await expect(updateReservation("r-1", "actor-1", {})).rejects.toThrow("cancelled or completed");
  });

  it("throws 400 when reservation is COMPLETED", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation({ status: "COMPLETED" }));
    await expect(updateReservation("r-1", "actor-1", {})).rejects.toThrow("cancelled or completed");
  });

  it("creates equipment audit entries when items change", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await updateReservation("r-1", "actor-1", { serializedAssetIds: ["a-1", "a-2"] });

    expect(mockTx.auditLog.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ action: "booking.items_added" }),
        ]),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateCheckout
// ═══════════════════════════════════════════════════════════════════════════════
describe("updateCheckout", () => {
  it("uses SERIALIZABLE isolation", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { title: "Updated" });

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("updates checkout fields", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());
    const newEnd = new Date("2026-04-11T17:00:00Z");

    await updateCheckout("c-1", "actor-1", { title: "New Title", endsAt: newEnd });

    expect(mockTx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ title: "New Title", endsAt: newEnd }),
      })
    );
  });

  it("checks availability with excludeBookingId", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { title: "Updated" });

    expect(checkAvailability).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ excludeBookingId: "c-1" })
    );
  });

  it("throws 409 on availability conflict", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [{ assetId: "a-1", conflictingBookingId: "b-other", startsAt: new Date(), endsAt: new Date() }],
      shortages: [],
      unavailableAssets: [],
    });

    await expect(
      updateCheckout("c-1", "actor-1", { title: "Updated" })
    ).rejects.toThrow("Conflicts");
  });

  it("throws 404 when checkout not found", async () => {
    mockTx.booking.findUnique.mockResolvedValue(null);
    await expect(updateCheckout("bad-id", "actor-1", {})).rejects.toThrow("Checkout not found");
  });

  it("throws 400 when booking is a RESERVATION", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());
    await expect(updateCheckout("r-1", "actor-1", {})).rejects.toThrow("Only checkouts");
  });

  it("throws 400 when checkout is CANCELLED", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout({ status: "CANCELLED" }));
    await expect(updateCheckout("c-1", "actor-1", {})).rejects.toThrow("cancelled or completed");
  });

  it("throws 400 when checkout is COMPLETED", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout({ status: "COMPLETED" }));
    await expect(updateCheckout("c-1", "actor-1", {})).rejects.toThrow("cancelled or completed");
  });

  it("rebuilds allocations with updated items", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { serializedAssetIds: ["a-1", "a-3"] });

    expect(mockTx.bookingSerializedItem.deleteMany).toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).toHaveBeenCalled();
    expect(mockTx.bookingSerializedItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ assetId: "a-1", allocationStatus: "active" }),
        expect.objectContaining({ assetId: "a-3", allocationStatus: "active" }),
      ]),
    });
  });

  it("dedupes serialized asset IDs", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { serializedAssetIds: ["a-1", "a-1", "a-2"] });

    const createCall = mockTx.bookingSerializedItem.createMany.mock.calls[0][0];
    expect(createCall.data).toHaveLength(2); // deduped from 3 to 2
  });
});
