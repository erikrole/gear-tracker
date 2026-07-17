import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingKind, CollaboratorProfile, Prisma, Role } from "@prisma/client";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

type MockFn = ReturnType<typeof vi.fn>;
type CreateBookingTx = {
  booking: Record<"findUnique" | "findUniqueOrThrow" | "create" | "update", MockFn>;
  calendarEvent: Record<"findMany", MockFn>;
  bookingEvent: Record<"createMany", MockFn>;
  scheduleEventFollow: Record<"createMany", MockFn>;
  bookingSerializedItem: Record<"createMany", MockFn>;
  bookingBulkItem: Record<"createMany", MockFn>;
  assetAllocation: Record<"createMany" | "updateMany", MockFn>;
  bulkStockBalance: Record<"findMany" | "upsert", MockFn>;
  bulkStockMovement: Record<"createMany", MockFn>;
  auditLog: Record<"create", MockFn>;
  scanSession: Record<"updateMany", MockFn>;
  user: Record<"findUnique", MockFn>;
  $queryRaw: MockFn;
};

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
    calendarEvent: { findMany: vi.fn() },
    bookingEvent: { createMany: vi.fn() },
    scheduleEventFollow: { createMany: vi.fn() },
    bookingSerializedItem: { createMany: vi.fn() },
    bookingBulkItem: { createMany: vi.fn() },
    assetAllocation: { createMany: vi.fn(), updateMany: vi.fn() },
    bulkStockBalance: { findMany: vi.fn(), upsert: vi.fn() },
    bulkStockMovement: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    scanSession: { updateMany: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN", active: true }) },
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
    upcomingCommitments: [],
    turnaroundRisks: [],
    bulkTurnaroundRisks: [],
  }),
}));

import { db } from "@/lib/db";
import { checkAvailability } from "@/lib/services/availability";
import { createBooking } from "@/lib/services/bookings";

const mockTx = (db as unknown as { _mockTx: CreateBookingTx })._mockTx;

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: BookingKind.CHECKOUT,
    custodySource: "KIOSK" as const,
    title: "Test Checkout",
    requesterUserId: "user-1",
    locationId: "loc-1",
    startsAt: new Date("2026-04-01T08:00:00Z"),
    endsAt: new Date("2026-04-01T17:00:00Z"),
    serializedAssetIds: ["a-base"] as string[],
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
  mockTx.calendarEvent.findMany.mockResolvedValue([]);
  mockTx.bookingEvent.createMany.mockResolvedValue({});
  mockTx.scheduleEventFollow.createMany.mockResolvedValue({});
  mockTx.bookingSerializedItem.createMany.mockResolvedValue({});
  mockTx.assetAllocation.createMany.mockResolvedValue({});
  mockTx.bookingBulkItem.createMany.mockResolvedValue({});
  mockTx.bulkStockBalance.findMany.mockResolvedValue([]);
  mockTx.bulkStockBalance.upsert.mockResolvedValue({});
  mockTx.bulkStockMovement.createMany.mockResolvedValue({});
  mockTx.auditLog.create.mockResolvedValue({});
  mockTx.user.findUnique.mockResolvedValue({
    active: true,
    role: Role.ADMIN,
    collaboratorProfile: null,
  });
  vi.mocked(checkAvailability).mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
    upcomingCommitments: [],
    turnaroundRisks: [],
    bulkTurnaroundRisks: [],
  });
});

describe("createBooking", () => {
  it("uses SERIALIZABLE isolation", async () => {
    await createBooking(baseInput());
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("rejects checkout creation without kiosk custody source before opening a transaction", async () => {
    await expect(createBooking(baseInput({ custodySource: undefined }))).rejects.toMatchObject({
      status: 403,
      message: "Direct checkout custody can only be created at a kiosk",
    });

    expect(transactionCalls).toHaveLength(0);
    expect(mockTx.booking.create).not.toHaveBeenCalled();
  });

  it("creates a CHECKOUT with PENDING_PICKUP status", async () => {
    await createBooking(baseInput({ kind: "CHECKOUT" }));
    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "CHECKOUT", status: "PENDING_PICKUP" }),
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

  it("normalizes the stored title while preserving sport codes", async () => {
    await createBooking(baseInput({ title: "mbb PRACTICE" }));

    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "MBB Practice" }),
      }),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          afterJson: expect.objectContaining({ title: "MBB Practice" }),
        }),
      }),
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
      upcomingCommitments: [],
      turnaroundRisks: [],
      bulkTurnaroundRisks: [],
    });

    await expect(createBooking(baseInput({ serializedAssetIds: ["a-1"] }))).rejects.toThrow("Availability conflict");
  });

  it("throws 409 on bulk shortages", async () => {
    vi.mocked(checkAvailability).mockResolvedValueOnce({
      conflicts: [],
      shortages: [{ bulkSkuId: "sku-1", requested: 10, available: 2 }],
      unavailableAssets: [],
      upcomingCommitments: [],
      turnaroundRisks: [],
      bulkTurnaroundRisks: [],
    });

    await expect(createBooking(baseInput({
      serializedAssetIds: [],
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
      serializedAssetIds: [],
      bulkItems: [{ bulkSkuId: "sku-1", quantity: 5 }],
    }));

    expect(mockTx.bookingBulkItem.createMany).toHaveBeenCalled();
    expect(mockTx.bulkStockMovement.createMany).toHaveBeenCalled();
  });

  it("creates bulk items but NO stock movements for RESERVATION", async () => {
    await createBooking(baseInput({
      kind: "RESERVATION",
      serializedAssetIds: [],
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

  it("rejects empty non-draft bookings at the shared service boundary", async () => {
    await expect(createBooking(baseInput({
      serializedAssetIds: [],
      bulkItems: [],
    }))).rejects.toThrow("Add at least one piece of equipment");

    expect(checkAvailability).not.toHaveBeenCalled();
    expect(mockTx.booking.create).not.toHaveBeenCalled();
  });

  it("rejects invalid booking windows before opening a transaction", async () => {
    await expect(createBooking(baseInput({
      startsAt: new Date("2026-04-01T17:00:00Z"),
      endsAt: new Date("2026-04-01T08:00:00Z"),
    }))).rejects.toThrow("endsAt must be later than startsAt");

    expect(transactionCalls).toHaveLength(0);
  });

  it("rejects duplicate eventIds instead of silently deduping", async () => {
    await expect(createBooking(baseInput({
      eventIds: ["event-1", "event-1"],
    }))).rejects.toThrow("eventIds must be unique");

    expect(mockTx.calendarEvent.findMany).not.toHaveBeenCalled();
    expect(mockTx.booking.create).not.toHaveBeenCalled();
  });

  it("sorts event links chronologically and writes junction rows", async () => {
    mockTx.calendarEvent.findMany.mockResolvedValue([
      { id: "event-late", startsAt: new Date("2026-04-03T20:00:00Z") },
      { id: "event-early", startsAt: new Date("2026-04-01T20:00:00Z") },
    ]);

    await createBooking(baseInput({ eventIds: ["event-late", "event-early"] }));

    expect(mockTx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: "event-early" }),
      }),
    );
    expect(mockTx.bookingEvent.createMany).toHaveBeenCalledWith({
      data: [
        { bookingId: "b-new", eventId: "event-early", ordinal: 0 },
        { bookingId: "b-new", eventId: "event-late", ordinal: 1 },
      ],
    });
  });

  it("limits collaborator event links to published visible schedule events", async () => {
    mockTx.user.findUnique.mockResolvedValue({
      active: true,
      role: Role.COLLABORATOR,
      collaboratorProfile: CollaboratorProfile.BTN_STANDARD,
    });
    mockTx.calendarEvent.findMany.mockResolvedValue([
      { id: "event-published", startsAt: new Date("2026-04-01T20:00:00Z") },
    ]);

    await createBooking(baseInput({
      kind: BookingKind.RESERVATION,
      custodySource: undefined,
      eventIds: ["event-published"],
    }));

    expect(mockTx.calendarEvent.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["event-published"] },
        isHidden: false,
        archivedAt: null,
        shiftGroup: {
          is: {
            publishedAt: { not: null },
            archivedAt: null,
            lastPublishedSnapshot: { not: Prisma.JsonNull },
          },
        },
      },
      select: { id: true, startsAt: true },
    });
  });

  it("does not reveal whether an inaccessible collaborator event ID exists", async () => {
    mockTx.user.findUnique.mockResolvedValue({
      active: true,
      role: Role.COLLABORATOR,
      collaboratorProfile: CollaboratorProfile.BTN_STANDARD,
    });

    await expect(createBooking(baseInput({
      kind: BookingKind.RESERVATION,
      custodySource: undefined,
      eventIds: ["event-hidden-or-missing"],
    }))).rejects.toMatchObject({
      status: 400,
      message: "One or more eventIds do not exist",
    });
  });

  it("maps DB overlap constraint races to availability conflicts", async () => {
    mockTx.assetAllocation.createMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Exclusion constraint failed on asset_allocations_no_overlap", {
        code: "P2004",
        clientVersion: "test",
        meta: { constraint: "asset_allocations_no_overlap" },
      }),
    );

    await expect(createBooking(baseInput({ serializedAssetIds: ["a-race"] }))).rejects.toMatchObject({
      status: 409,
      message: "One or more items are no longer available",
    });
  });

  it("maps serializable transaction races to retryable conflicts", async () => {
    vi.mocked(db.$transaction).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Serializable conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );

    await expect(createBooking(baseInput())).rejects.toMatchObject({
      status: 409,
      message: "Someone else submitted at the same time; please try again.",
    });
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

    await createBooking(baseInput({ sourceReservationId: "rv-1", serializedAssetIds: [], bulkItems: [] }));

    // Should complete the source reservation as fulfilled
    expect(mockTx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rv-1" },
        data: { status: "COMPLETED", completedAt: expect.any(Date) },
      })
    );
  });

  it("throws 400 when the requester does not exist", async () => {
    mockTx.user.findUnique.mockResolvedValueOnce(null);
    await expect(createBooking(baseInput())).rejects.toThrow("Requester not found");
    expect(mockTx.booking.create).not.toHaveBeenCalled();
  });

  it("throws 400 when the requester is inactive", async () => {
    mockTx.user.findUnique.mockResolvedValueOnce({ active: false });
    await expect(createBooking(baseInput())).rejects.toThrow("inactive user");
    expect(mockTx.booking.create).not.toHaveBeenCalled();
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
