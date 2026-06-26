import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  assetFindMany: vi.fn(),
  assetCount: vi.fn(),
  favoriteItemFindMany: vi.fn(),
  bulkSkuFindMany: vi.fn(),
  bookingBulkUnitAllocationFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    asset: {
      findMany: mocks.assetFindMany,
      count: mocks.assetCount,
    },
    favoriteItem: {
      findMany: mocks.favoriteItemFindMany,
    },
    bulkSku: {
      findMany: mocks.bulkSkuFindMany,
    },
    bookingBulkUnitAllocation: {
      findMany: mocks.bookingBulkUnitAllocationFindMany,
    },
    bookingSerializedItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/status", () => ({
  buildDerivedStatusWhere: vi.fn((statuses: string[]) => statuses.map((status) => ({ status }))),
  enrichAssetsWithStatusFromLoaded: vi.fn(async (assets: unknown[]) => assets),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { GET as getAssets } from "@/app/api/assets/route";

const authedUser = {
  id: "user-1",
  email: "staff@example.com",
  name: "Staff",
  role: "STAFF",
  avatarUrl: null,
  forcePasswordChange: false,
};

function request(path: string) {
  return new Request(`https://gear.test${path}`);
}

function numberedBatterySku(overrides: Record<string, unknown> = {}) {
  return {
    id: "sku-battery",
    name: "Sony Battery",
    category: "Batteries",
    unit: "each",
    trackByNumber: true,
    imageUrl: null,
    locationId: "loc-1",
    categoryId: "cat-1",
    categoryRel: { id: "cat-1", name: "Batteries" },
    departmentId: "dept-1",
    binQrCodeValue: "BAT",
    location: { name: "Cage" },
    department: { id: "dept-1", name: "Production" },
    balances: [{ onHandQuantity: 46 }],
    units: [
      ...Array.from({ length: 43 }, (_, index) => ({ id: `unit-${index + 1}`, unitNumber: index + 1, status: "AVAILABLE" })),
      { id: "unit-44", unitNumber: 44, status: "CHECKED_OUT" },
      { id: "unit-45", unitNumber: 45, status: "CHECKED_OUT" },
      { id: "unit-46", unitNumber: 46, status: "LOST" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(authedUser);
  mocks.assetFindMany.mockResolvedValue([]);
  mocks.assetCount.mockResolvedValue(0);
  mocks.favoriteItemFindMany.mockResolvedValue([]);
  mocks.bulkSkuFindMany.mockResolvedValue([]);
  mocks.bookingBulkUnitAllocationFindMany.mockResolvedValue([]);
});

describe("/api/assets item-family rows", () => {
  it("excludes retired serialized rows from the default list", async () => {
    const res = await getAssets(request("/api/assets?limit=25"), {
      params: Promise.resolve({}),
    });

    expect(res.status).toBe(200);
    expect(mocks.assetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { parentAssetId: null },
          { status: { not: "RETIRED" } },
        ],
      },
    }));
    expect(mocks.assetCount).toHaveBeenCalledWith({
      where: {
        AND: [
          { parentAssetId: null },
          { status: { not: "RETIRED" } },
        ],
      },
    });
  });

  it("keeps retired rows available through an explicit Retired status filter", async () => {
    const res = await getAssets(request("/api/assets?status=RETIRED&limit=25"), {
      params: Promise.resolve({}),
    });

    expect(res.status).toBe(200);
    expect(mocks.assetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { parentAssetId: null },
          { OR: [{ status: "RETIRED" }] },
        ],
      },
    }));
    expect(mocks.bulkSkuFindMany).not.toHaveBeenCalled();
  });

  it("returns one unit-tracked item-family row with availability counts for search", async () => {
    mocks.bulkSkuFindMany.mockResolvedValue([numberedBatterySku()]);

    const res = await getAssets(request("/api/assets?q=battery&limit=25"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.bulkItems).toMatchObject([
      {
        id: "sku-battery",
        kind: "bulk",
        name: "Sony Battery",
        category: "Batteries",
        trackByNumber: true,
        availableQuantity: 45,
        onHandQuantity: 46,
        checkedOutQuantity: 0,
        lostQuantity: 1,
        retiredQuantity: 0,
        locationName: "Cage",
        departmentName: "Production",
      },
    ]);
  });

  it("uses the canonical category relation for item-family display", async () => {
    mocks.bulkSkuFindMany.mockResolvedValue([
      numberedBatterySku({
        category: "Recording Equipment",
        categoryRel: { id: "cat-1", name: "Batteries" },
      }),
    ]);

    const res = await getAssets(request("/api/assets?q=battery&limit=25"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bulkItems[0]).toMatchObject({
      id: "sku-battery",
      category: "Batteries",
      categoryId: "cat-1",
    });
  });

  it("resolves a derived unit QR to the parent item family with unit status", async () => {
    mocks.bulkSkuFindMany
      .mockResolvedValueOnce([
        { id: "sku-battery", binQrCodeValue: "BAT", trackByNumber: true },
      ])
      .mockResolvedValueOnce([numberedBatterySku()]);

    const res = await getAssets(request("/api/assets?qr=BAT-44&limit=5"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.bulkItems).toHaveLength(1);
    expect(body.bulkItems[0]).toMatchObject({
      id: "sku-battery",
      name: "Sony Battery",
      trackByNumber: true,
      matchedUnitNumber: 44,
      matchedUnitStatus: "AVAILABLE",
      availableQuantity: 45,
      checkedOutQuantity: 0,
      onHandQuantity: 46,
    });
    expect(body.bulkItems[0].units).toEqual(expect.arrayContaining([
      { unitNumber: 44, status: "AVAILABLE" },
      { unitNumber: 45, status: "AVAILABLE" },
      { unitNumber: 46, status: "LOST" },
    ]));
    expect(mocks.bookingBulkUnitAllocationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        bulkSkuUnitId: { in: expect.arrayContaining(["unit-44"]) },
      }),
    }));
  });

  it("includes custody context when an exact unit QR is checked out", async () => {
    mocks.bulkSkuFindMany
      .mockResolvedValueOnce([
        { id: "sku-battery", binQrCodeValue: "BAT", trackByNumber: true },
      ])
      .mockResolvedValueOnce([numberedBatterySku()]);
    mocks.bookingBulkUnitAllocationFindMany.mockResolvedValue([{
      bulkSkuUnitId: "unit-44",
      bookingBulkItem: {
        booking: {
          id: "booking-1",
          title: "Minnesota travel kit",
          endsAt: new Date("2026-05-16T18:00:00.000Z"),
          requester: { name: "Taylor Student", avatarUrl: null },
        },
      },
    }]);

    const res = await getAssets(request("/api/assets?qr=BAT-44&limit=5"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bulkItems[0]).toMatchObject({
      id: "sku-battery",
      matchedUnitNumber: 44,
      matchedUnitStatus: "CHECKED_OUT",
      availableQuantity: 44,
      checkedOutQuantity: 1,
      matchedUnitHolder: "Taylor Student",
      matchedUnitDueAt: "2026-05-16T18:00:00.000Z",
      matchedUnitBookingTitle: "Minnesota travel kit",
      matchedUnitBookingId: "booking-1",
    });
    expect(body.bulkItems[0].units).toEqual(expect.arrayContaining([
      { unitNumber: 44, status: "CHECKED_OUT" },
      { unitNumber: 45, status: "AVAILABLE" },
    ]));
  });
});
