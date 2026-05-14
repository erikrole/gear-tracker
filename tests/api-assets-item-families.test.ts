import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  assetFindMany: vi.fn(),
  assetCount: vi.fn(),
  favoriteItemFindMany: vi.fn(),
  bulkSkuFindMany: vi.fn(),
  bookingBulkUnitAllocationFindFirst: vi.fn(),
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
      findFirst: mocks.bookingBulkUnitAllocationFindFirst,
    },
    bookingSerializedItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/status", () => ({
  buildDerivedStatusWhere: vi.fn(() => [{}]),
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
  mocks.bookingBulkUnitAllocationFindFirst.mockResolvedValue(null);
});

describe("/api/assets item-family rows", () => {
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
        availableQuantity: 43,
        onHandQuantity: 46,
        checkedOutQuantity: 2,
        lostQuantity: 1,
        retiredQuantity: 0,
        locationName: "Cage",
        departmentName: "Production",
      },
    ]);
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
      matchedUnitStatus: "CHECKED_OUT",
      availableQuantity: 43,
      onHandQuantity: 46,
    });
    expect(mocks.bookingBulkUnitAllocationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bulkSkuUnitId: "unit-44" }),
    }));
  });

  it("includes custody context when an exact unit QR is checked out", async () => {
    mocks.bulkSkuFindMany
      .mockResolvedValueOnce([
        { id: "sku-battery", binQrCodeValue: "BAT", trackByNumber: true },
      ])
      .mockResolvedValueOnce([numberedBatterySku()]);
    mocks.bookingBulkUnitAllocationFindFirst.mockResolvedValue({
      bookingBulkItem: {
        booking: {
          title: "Minnesota travel kit",
          endsAt: new Date("2026-05-16T18:00:00.000Z"),
          requester: { name: "Taylor Student" },
        },
      },
    });

    const res = await getAssets(request("/api/assets?qr=BAT-44&limit=5"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bulkItems[0]).toMatchObject({
      id: "sku-battery",
      matchedUnitNumber: 44,
      matchedUnitStatus: "CHECKED_OUT",
      matchedUnitHolder: "Taylor Student",
      matchedUnitDueAt: "2026-05-16T18:00:00.000Z",
      matchedUnitBookingTitle: "Minnesota travel kit",
    });
  });
});
