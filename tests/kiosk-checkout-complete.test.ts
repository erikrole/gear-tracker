import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  transaction: vi.fn(),
  assetFindMany: vi.fn(),
  bookingCreate: vi.fn(),
  bookingSerializedItemCreateMany: vi.fn(),
  assetAllocationCreateMany: vi.fn(),
  createAuditEntry: vi.fn(),
  nextBookingRef: vi.fn(),
  checkAvailability: vi.fn(),
  badgeOnCheckoutOpened: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: mocks.userFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: (handler: any) => async (req: Request) => {
    try {
      return await handler(req, {
        kiosk: {
          kioskId: "kiosk-1",
          locationId: "loc-1",
          locationName: "Camp Randall",
        },
      });
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error
        ? Number((error as { status: unknown }).status)
        : 500;
      const message = error instanceof Error ? error.message : "Internal server error";
      return Response.json({ error: message }, { status });
    }
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: mocks.createAuditEntry,
}));

vi.mock("@/lib/services/booking-ref", () => ({
  nextBookingRef: mocks.nextBookingRef,
}));

vi.mock("@/lib/services/availability", () => ({
  checkAvailability: mocks.checkAvailability,
}));

vi.mock("@/lib/services/bookings-lifecycle", () => ({
  isBookingAllocationConstraintError: (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const code = (error as { code?: unknown }).code;
    const message = error instanceof Error ? error.message : "";
    return code === "23P01" || message.includes("asset_allocations_no_overlap");
  },
}));

vi.mock("@/lib/badges", () => ({
  badges: {
    onCheckoutOpened: mocks.badgeOnCheckoutOpened,
  },
}));

import { POST as completeKioskCheckout } from "@/app/api/kiosk/checkout/complete/route";

function request(body: unknown) {
  return new Request("http://test/api/kiosk/checkout/complete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "user-1",
    locationId: "loc-2",
    items: [{ assetId: "asset-1" }, { assetId: "asset-2" }],
    ...overrides,
  };
}

const tx = {
  asset: {
    findMany: mocks.assetFindMany,
  },
  booking: {
    create: mocks.bookingCreate,
  },
  bookingSerializedItem: {
    createMany: mocks.bookingSerializedItemCreateMany,
  },
  assetAllocation: {
    createMany: mocks.assetAllocationCreateMany,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-11T15:00:00.000Z"));

  mocks.userFindFirst.mockResolvedValue({
    id: "user-1",
    name: "Bucky Badger",
    role: "STUDENT",
  });
  mocks.transaction.mockImplementation((handler) => handler(tx));
  mocks.assetFindMany.mockResolvedValue([
    { id: "asset-1", assetTag: "CAM-1", name: "Camera", status: "AVAILABLE" },
    { id: "asset-2", assetTag: "LENS-1", name: "Lens", status: "AVAILABLE" },
  ]);
  mocks.nextBookingRef.mockResolvedValue("CO-1001");
  mocks.bookingCreate.mockResolvedValue({ id: "booking-1" });
  mocks.bookingSerializedItemCreateMany.mockResolvedValue({ count: 2 });
  mocks.assetAllocationCreateMany.mockResolvedValue({ count: 2 });
  mocks.checkAvailability.mockResolvedValue({
    conflicts: [],
    shortages: [],
    unavailableAssets: [],
  });
  mocks.createAuditEntry.mockResolvedValue(undefined);
  mocks.badgeOnCheckoutOpened.mockResolvedValue(undefined);
});

describe("kiosk checkout completion", () => {
  it("creates a checkout booking and allocations for available assets", async () => {
    const res = await (completeKioskCheckout as any)(request(checkoutBody()));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      bookingId: "booking-1",
      refNumber: "CO-1001",
      itemCount: 2,
    });
    expect(mocks.checkAvailability).toHaveBeenCalledWith(tx, {
      locationId: "loc-2",
      startsAt: new Date("2026-06-11T15:00:00.000Z"),
      endsAt: new Date("2026-06-12T15:00:00.000Z"),
      serializedAssetIds: ["asset-1", "asset-2"],
      bulkItems: [],
      bookingKind: "CHECKOUT",
    });
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "CHECKOUT",
        status: "OPEN",
        requesterUserId: "user-1",
        locationId: "loc-2",
        refNumber: "CO-1001",
      }),
    });
    expect(mocks.assetAllocationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ assetId: "asset-1", kind: "CHECKOUT" }),
        expect.objectContaining({ assetId: "asset-2", kind: "CHECKOUT" }),
      ],
    });
  });

  it("returns 409 when a scanned asset no longer exists", async () => {
    mocks.assetFindMany.mockResolvedValue([
      { id: "asset-1", assetTag: "CAM-1", name: "Camera", status: "AVAILABLE" },
    ]);

    const res = await (completeKioskCheckout as any)(request(checkoutBody()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("An item in your cart no longer exists. Remove it and rescan.");
    expect(mocks.bookingCreate).not.toHaveBeenCalled();
  });

  it("returns 409 naming a maintenance asset", async () => {
    mocks.assetFindMany.mockResolvedValue([
      { id: "asset-1", assetTag: "CAM-1", name: "Camera", status: "MAINTENANCE" },
      { id: "asset-2", assetTag: "LENS-1", name: "Lens", status: "AVAILABLE" },
    ]);

    const res = await (completeKioskCheckout as any)(request(checkoutBody()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("CAM-1 is unavailable (maintenance). Remove it to continue.");
    expect(mocks.bookingCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when availability reports an overlapping conflict", async () => {
    mocks.checkAvailability.mockResolvedValue({
      conflicts: [{ assetId: "asset-2", conflictingBookingId: "booking-2" }],
      shortages: [],
      unavailableAssets: [],
    });

    const res = await (completeKioskCheckout as any)(request(checkoutBody()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("LENS-1 was just taken by someone else. Remove it and try again.");
    expect(mocks.bookingCreate).not.toHaveBeenCalled();
  });

  it("maps residual allocation exclusion errors to a friendly 409", async () => {
    mocks.assetAllocationCreateMany.mockRejectedValue(
      Object.assign(new Error("violates exclusion constraint asset_allocations_no_overlap"), {
        code: "23P01",
      }),
    );

    const res = await (completeKioskCheckout as any)(request(checkoutBody()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("One or more items were just taken by someone else. Remove them and rescan.");
  });

  it("uses the kiosk location when the body omits locationId", async () => {
    const res = await (completeKioskCheckout as any)(request(checkoutBody({ locationId: undefined })));

    expect(res.status).toBe(200);
    expect(mocks.checkAvailability).toHaveBeenCalledWith(tx, expect.objectContaining({
      locationId: "loc-1",
    }));
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locationId: "loc-1",
      }),
    });
  });
});
