import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkUnitStatus, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  bulkSkuFindMany: vi.fn(),
  bulkSkuCount: vi.fn(),
  bulkSkuFindUnique: vi.fn(),
  bookingBulkUnitAllocationFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    bulkSku: {
      findMany: mocks.bulkSkuFindMany,
      count: mocks.bulkSkuCount,
      findUnique: mocks.bulkSkuFindUnique,
    },
    bookingBulkUnitAllocation: {
      findMany: mocks.bookingBulkUnitAllocationFindMany,
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { GET as listBulkSkus } from "@/app/api/bulk-skus/route";
import { GET as getBulkSku } from "@/app/api/bulk-skus/[id]/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

function get(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function numberedSku() {
  return {
    id: "sku-1",
    name: "Sony NP-FZ100 Battery",
    category: "Batteries",
    unit: "each",
    locationId: "loc-1",
    minThreshold: 2,
    trackByNumber: true,
    location: { id: "loc-1", name: "Camp Randall" },
    categoryRel: { id: "cat-1", name: "Batteries" },
    department: { id: "dep-1", name: "Video" },
    balances: [{ onHandQuantity: 3 }],
    units: [
      { id: "unit-orphan", unitNumber: 1, status: BulkUnitStatus.CHECKED_OUT, allocations: [] },
      { id: "unit-active", unitNumber: 2, status: BulkUnitStatus.AVAILABLE, allocations: [] },
      { id: "unit-lost", unitNumber: 3, status: BulkUnitStatus.LOST, allocations: [] },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(staffUser);
  mocks.bulkSkuCount.mockResolvedValue(1);
  mocks.bookingBulkUnitAllocationFindMany.mockResolvedValue([
    { bulkSkuUnitId: "unit-active" },
  ]);
});

describe("bulk SKU effective unit status routes", () => {
  it("uses effective numbered-unit status in the bulk SKU list", async () => {
    mocks.bulkSkuFindMany.mockResolvedValue([numberedSku()]);

    const res = await listBulkSkus(get("/api/bulk-skus"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].availableQuantity).toBe(1);
    expect(body.data[0].units).toEqual([
      expect.objectContaining({ id: "unit-orphan", status: BulkUnitStatus.AVAILABLE }),
      expect.objectContaining({ id: "unit-active", status: BulkUnitStatus.CHECKED_OUT }),
      expect.objectContaining({ id: "unit-lost", status: BulkUnitStatus.LOST }),
    ]);
  });

  it("uses effective numbered-unit status in bulk SKU detail", async () => {
    mocks.bulkSkuFindUnique.mockResolvedValue(numberedSku());

    const res = await getBulkSku(get("/api/bulk-skus/sku-1"), { params: Promise.resolve({ id: "sku-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.onHand).toBe(3);
    expect(body.data.availableQuantity).toBe(1);
    expect(body.data.units).toEqual([
      expect.objectContaining({ id: "unit-orphan", status: BulkUnitStatus.AVAILABLE }),
      expect.objectContaining({ id: "unit-active", status: BulkUnitStatus.CHECKED_OUT }),
      expect.objectContaining({ id: "unit-lost", status: BulkUnitStatus.LOST }),
    ]);
  });
});
