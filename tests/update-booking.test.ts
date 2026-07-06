import { describe, it, expect, vi, beforeEach } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

type MockFn = ReturnType<typeof vi.fn>;
type UpdateBookingTx = {
  booking: Record<"findUnique" | "findUniqueOrThrow" | "update", MockFn>;
  bookingSerializedItem: Record<"deleteMany" | "createMany", MockFn>;
  bookingBulkItem: Record<"deleteMany" | "createMany" | "update", MockFn>;
  assetAllocation: Record<"deleteMany" | "createMany" | "updateMany", MockFn>;
  auditLog: Record<"create" | "createMany", MockFn>;
  user: Record<"findUnique", MockFn>;
  bulkStockBalance: Record<"findMany" | "upsert", MockFn>;
  bulkStockMovement: Record<"createMany", MockFn>;
};

// ─── Transaction tracking ───────────────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ──────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    bookingSerializedItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    bookingBulkItem: { deleteMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
    assetAllocation: { deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN", active: true }) },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
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
    upcomingCommitments: [],
    turnaroundRisks: [],
    bulkTurnaroundRisks: [],
  }),
}));

import { db } from "@/lib/db";
import { checkAvailability } from "@/lib/services/availability";
import { updateReservation, updateCheckout } from "@/lib/services/bookings";

const mockTx = (db as unknown as { _mockTx: UpdateBookingTx })._mockTx;

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
    serializedItems: [{ assetId: "a-1", allocationStatus: "active" }],
    bulkItems: [{
      id: "bbi-1",
      bulkSkuId: "sku-1",
      plannedQuantity: 5,
      checkedOutQuantity: null,
      checkedInQuantity: 0,
      unitAllocations: [],
    }],
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
  mockTx.assetAllocation.updateMany.mockResolvedValue({});
  mockTx.bookingBulkItem.update.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
  mockTx.auditLog.createMany.mockResolvedValue({});
  mockTx.bulkStockBalance.findMany.mockResolvedValue([{ bulkSkuId: "sku-1", onHandQuantity: 50 }]);
  mockTx.bulkStockBalance.upsert.mockResolvedValue({});
  mockTx.bulkStockMovement.createMany.mockResolvedValue({});
  vi.mocked(checkAvailability).mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
    upcomingCommitments: [],
    turnaroundRisks: [],
    bulkTurnaroundRisks: [],
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

  it("does not check availability or rebuild equipment when only reservation details change", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await updateReservation("r-1", "actor-1", { title: "Updated" });

    expect(checkAvailability).not.toHaveBeenCalled();
    expect(mockTx.bookingSerializedItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.updateMany).not.toHaveBeenCalled();
  });

  it("checks availability with excludeBookingId when reservation timing changes", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());
    const newEnd = new Date("2026-04-11T17:00:00Z");

    await updateReservation("r-1", "actor-1", { endsAt: newEnd });

    expect(checkAvailability).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ excludeBookingId: "r-1" })
    );
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "r-1" },
      data: {
        startsAt,
        endsAt: newEnd,
      },
    });
  });

  it("throws 409 on availability conflict", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [{ assetId: "a-1", conflictingBookingId: "b-other", startsAt: new Date(), endsAt: new Date() }],
      shortages: [],
      unavailableAssets: [],
      upcomingCommitments: [],
      turnaroundRisks: [],
      bulkTurnaroundRisks: [],
    });

    await expect(
      updateReservation("r-1", "actor-1", { endsAt: new Date("2026-04-11T17:00:00Z") })
    ).rejects.toThrow("Availability conflict");
  });

  it("maps commit-time allocation races to a booking conflict", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());
    mockTx.assetAllocation.createMany.mockRejectedValueOnce({ code: "23P01" });

    await expect(
      updateReservation("r-1", "actor-1", { serializedAssetIds: ["a-1", "a-2"] })
    ).rejects.toThrow("One or more items are no longer available");
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

  it("throws 400 when the new requester does not exist", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation({ requesterUserId: "u-old" }));
    mockTx.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateReservation("r-1", "actor-1", { requesterUserId: "u-ghost" })
    ).rejects.toThrow("Requester not found");
  });

  it("throws 400 when the new requester is inactive", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation({ requesterUserId: "u-old" }));
    mockTx.user.findUnique.mockResolvedValueOnce({ active: false });

    await expect(
      updateReservation("r-1", "actor-1", { requesterUserId: "u-inactive" })
    ).rejects.toThrow("inactive user as requester");
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

  it("rejects an invalid edit window before availability or allocation work", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingReservation());

    await expect(
      updateReservation("r-1", "actor-1", { endsAt: new Date("2026-04-10T07:00:00Z") })
    ).rejects.toThrow("endsAt must be later than startsAt");

    expect(checkAvailability).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.createMany).not.toHaveBeenCalled();
    expect(mockTx.bookingSerializedItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.bookingSerializedItem.createMany).not.toHaveBeenCalled();
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

  it("preserves checkout equipment rows when only details change", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { title: "New Title" });

    expect(mockTx.bookingSerializedItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.updateMany).not.toHaveBeenCalled();
  });

  it("checks availability with excludeBookingId when checkout due date changes", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());
    const newEnd = new Date("2026-04-11T17:00:00Z");

    await updateCheckout("c-1", "actor-1", { endsAt: newEnd });

    expect(checkAvailability).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ excludeBookingId: "c-1" })
    );
    expect(mockTx.assetAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "c-1" },
      data: {
        startsAt,
        endsAt: newEnd,
      },
    });
  });

  it("throws 409 on availability conflict", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [{ assetId: "a-1", conflictingBookingId: "b-other", startsAt: new Date(), endsAt: new Date() }],
      shortages: [],
      unavailableAssets: [],
      upcomingCommitments: [],
      turnaroundRisks: [],
      bulkTurnaroundRisks: [],
    });

    await expect(
      updateCheckout("c-1", "actor-1", { endsAt: new Date("2026-04-11T17:00:00Z") })
    ).rejects.toThrow("Conflicts");
  });

  it("maps checkout edit allocation races to a booking conflict", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());
    mockTx.assetAllocation.createMany.mockRejectedValueOnce({ code: "23P01" });

    await expect(
      updateCheckout("c-1", "actor-1", { serializedAssetIds: ["a-1", "a-3"] })
    ).rejects.toThrow("One or more items are no longer available");
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

  it("adds and removes only the changed serialized items", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout({
      serializedItems: [
        { assetId: "a-1", allocationStatus: "active" },
        { assetId: "a-2", allocationStatus: "active" },
      ],
    }));

    await updateCheckout("c-1", "actor-1", { serializedAssetIds: ["a-1", "a-3"] });

    // a-1 kept untouched, a-2 removed, a-3 added — no full rebuild
    expect(mockTx.bookingSerializedItem.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: "c-1", assetId: { in: ["a-2"] } },
    });
    expect(mockTx.assetAllocation.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: "c-1", assetId: { in: ["a-2"] } },
    });
    expect(mockTx.bookingSerializedItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ assetId: "a-3", allocationStatus: "active" })],
    });
  });

  it("blocks removing an already-returned item from a checkout", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout({
      serializedItems: [
        { assetId: "a-1", allocationStatus: "returned" },
        { assetId: "a-2", allocationStatus: "active" },
      ],
    }));

    await expect(
      updateCheckout("c-1", "actor-1", { serializedAssetIds: ["a-2"] })
    ).rejects.toThrow("returned item cannot be removed");

    expect(mockTx.bookingSerializedItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).not.toHaveBeenCalled();
  });

  it("dedupes serialized asset IDs", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { serializedAssetIds: ["a-1", "a-1", "a-2"] });

    // a-1 already on the checkout; deduped a-2 is the only new row
    const createCall = mockTx.bookingSerializedItem.createMany.mock.calls[0]![0];
    expect(createCall.data).toHaveLength(1);
    expect(createCall.data[0]).toEqual(expect.objectContaining({ assetId: "a-2" }));
  });

  it("writes ledger movement deltas when bulk quantities change", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", {
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 8 }],
    });

    expect(mockTx.bookingBulkItem.update).toHaveBeenCalledWith({
      where: { id: "bbi-1" },
      data: { plannedQuantity: 8 },
    });
    // +3 delta must hit the stock ledger as a CHECKOUT movement
    expect(mockTx.bulkStockMovement.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ bulkSkuId: "sku-1", kind: "CHECKOUT", quantity: 3 })],
    });
    expect(mockTx.bulkStockBalance.upsert).toHaveBeenCalled();
  });

  it("restocks the ledger when a bulk row is removed from a checkout", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await updateCheckout("c-1", "actor-1", { bulkItems: [] });

    expect(mockTx.bookingBulkItem.deleteMany).toHaveBeenCalledWith({ where: { id: "bbi-1" } });
    expect(mockTx.bulkStockMovement.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ bulkSkuId: "sku-1", kind: "CHECKIN", quantity: 5 })],
    });
  });

  it("blocks bulk edits when the SKU has kiosk custody activity", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout({
      bulkItems: [{
        id: "bbi-1",
        bulkSkuId: "sku-1",
        plannedQuantity: 5,
        checkedOutQuantity: 5,
        checkedInQuantity: 0,
        unitAllocations: [{ id: "alloc-1" }],
      }],
    }));

    await expect(
      updateCheckout("c-1", "actor-1", { bulkItems: [{ bulkSkuId: "sku-1", quantity: 2 }] })
    ).rejects.toThrow("kiosk custody activity");

    expect(mockTx.bookingBulkItem.update).not.toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.bulkStockMovement.createMany).not.toHaveBeenCalled();
  });

  it("leaves unchanged custody-touched bulk rows alone", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout({
      bulkItems: [{
        id: "bbi-1",
        bulkSkuId: "sku-1",
        plannedQuantity: 5,
        checkedOutQuantity: 5,
        checkedInQuantity: 2,
        unitAllocations: [{ id: "alloc-1" }],
      }],
    }));

    // Same quantity — the custody-touched row is not being edited
    await updateCheckout("c-1", "actor-1", {
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 5 }],
      serializedAssetIds: ["a-1", "a-3"],
    });

    expect(mockTx.bookingBulkItem.update).not.toHaveBeenCalled();
    expect(mockTx.bookingBulkItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.bulkStockMovement.createMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid edit window before availability or allocation work", async () => {
    mockTx.booking.findUnique.mockResolvedValue(makeExistingCheckout());

    await expect(
      updateCheckout("c-1", "actor-1", { endsAt: new Date("2026-04-10T07:00:00Z") })
    ).rejects.toThrow("endsAt must be later than startsAt");

    expect(checkAvailability).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.createMany).not.toHaveBeenCalled();
    expect(mockTx.bookingSerializedItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.bookingSerializedItem.createMany).not.toHaveBeenCalled();
  });
});
