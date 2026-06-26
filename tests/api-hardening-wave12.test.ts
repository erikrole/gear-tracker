import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetStatus, Role } from "@prisma/client";

declare global {
  var __wave12TransactionOptions: unknown;
}

type MockLoadedAsset = {
  computedStatus?: string | null;
  [key: string]: unknown;
};

const mockTx = {
  asset: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  bookingSerializedItem: {
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  assetAllocation: {
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  scanEvent: {
    deleteMany: vi.fn(),
  },
  checkinItemReport: {
    deleteMany: vi.fn(),
  },
  auditLog: {
    createMany: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
      globalThis.__wave12TransactionOptions = options;
      return fn(mockTx);
    }),
    asset: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    favoriteItem: {
      findMany: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    bulkSku: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/services/status", () => ({
  buildDerivedStatusWhere: vi.fn(() => []),
  enrichAssetsWithStatusFromLoaded: vi.fn(async (assets: MockLoadedAsset[]) =>
    assets.map((asset) => ({ ...asset, computedStatus: asset.computedStatus ?? "AVAILABLE" })),
  ),
}));

vi.mock("@/lib/equipment-section-filters", () => ({
  ALL_SECTION_KEYS: ["camera", "audio"],
  sectionWhere: vi.fn((key: string) => ({ type: key })),
}));

vi.mock("@/lib/equipment-sections", () => ({}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildDerivedStatusWhere } from "@/lib/services/status";
import { enforceRateLimit } from "@/lib/rate-limit";
import { GET as exportAssets } from "@/app/api/assets/export/route";
import { GET as pickerSearch } from "@/app/api/assets/picker-search/route";
import { POST as bulkAssets } from "@/app/api/assets/bulk/route";
import { GET as bulkActivity } from "@/app/api/bulk-skus/[id]/activity/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: Role.ADMIN,
  avatarUrl: null,
};

type DerivedStatusWhere = { status: AssetStatus; __derived: boolean };

function bulkSkuResult(value: { id: string }) {
  return value as unknown as Awaited<ReturnType<typeof db.bulkSku.findUnique>>;
}

function auditFindFirstResult(value: { id: string } | null) {
  return value as unknown as Awaited<ReturnType<typeof db.auditLog.findFirst>>;
}

function assetFindManyResult(rows: Array<Record<string, unknown>>) {
  return rows as unknown as Awaited<ReturnType<typeof db.asset.findMany>>;
}

function derivedStatusWhereResult(rows: DerivedStatusWhere[]) {
  return rows as unknown as ReturnType<typeof buildDerivedStatusWhere>;
}

function get(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function post(path: string, body: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__wave12TransactionOptions = undefined;
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
  vi.mocked(db.asset.findMany).mockResolvedValue([]);
  vi.mocked(db.asset.count).mockResolvedValue(0);
  vi.mocked(db.favoriteItem.findMany).mockResolvedValue([]);
  vi.mocked(db.bulkSku.findUnique).mockResolvedValue(bulkSkuResult({ id: "sku-1" }));
  vi.mocked(db.auditLog.findFirst).mockResolvedValue(auditFindFirstResult({ id: "cursor-1" }));
  vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
  mockTx.asset.findMany.mockResolvedValue([
    { id: "asset-1", status: "AVAILABLE" },
    { id: "asset-2", status: "MAINTENANCE" },
  ]);
  mockTx.asset.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 1 });
  mockTx.asset.deleteMany.mockResolvedValue({ count: 1 });
  mockTx.bookingSerializedItem.count.mockResolvedValue(0);
  mockTx.bookingSerializedItem.deleteMany.mockResolvedValue({ count: 0 });
  mockTx.assetAllocation.count.mockResolvedValue(0);
  mockTx.assetAllocation.deleteMany.mockResolvedValue({ count: 0 });
  mockTx.scanEvent.deleteMany.mockResolvedValue({ count: 0 });
  mockTx.checkinItemReport.deleteMany.mockResolvedValue({ count: 0 });
  mockTx.auditLog.createMany.mockResolvedValue({ count: 2 });
});

describe("API hardening wave 12", () => {
  it("rate limits asset export and uses formula-safe CSV fields", async () => {
    vi.mocked(db.asset.findMany).mockResolvedValue(assetFindManyResult([
      {
        assetTag: "=CAM-1",
        name: "+Camera",
        brand: "Sony",
        model: "FX3",
        serialNumber: "-SERIAL",
        computedStatus: "AVAILABLE",
        category: { name: "Camera" },
        department: { name: "Photo" },
        location: { name: "Main" },
        purchaseDate: null,
        purchasePrice: null,
      },
    ]));
    vi.mocked(db.asset.count).mockResolvedValue(1);

    const res = await exportAssets(get("/api/assets/export"), { params: Promise.resolve({}) });
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith("asset:export:staff-1", { max: 10, windowMs: 60_000 });
    expect(body).toContain("'=CAM-1");
    expect(body).toContain("'+Camera");
    expect(body).toContain("'-SERIAL");
  });

  it("caps equipment picker page size at the route boundary", async () => {
    await pickerSearch(get("/api/assets/picker-search?limit=200"), { params: Promise.resolve({}) });

    expect(db.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it("filters equipment picker available-only by derived availability, not stored status", async () => {
    const derivedAvailable: DerivedStatusWhere[] = [{ status: AssetStatus.AVAILABLE, __derived: true }];
    vi.mocked(buildDerivedStatusWhere).mockReturnValue(derivedStatusWhereResult(derivedAvailable));

    await pickerSearch(
      get("/api/assets/picker-search?only_available=true"),
      { params: Promise.resolve({}) },
    );

    expect(buildDerivedStatusWhere).toHaveBeenCalledWith(["AVAILABLE"]);

    // Rows query must use the derived OR clause, never a bare stored status filter.
    const findManyWhere = vi.mocked(db.asset.findMany).mock.calls.at(0)?.[0]?.where as {
      AND: Array<Record<string, unknown>>;
    };
    expect(findManyWhere.AND).toContainEqual({ OR: derivedAvailable });
    expect(findManyWhere.AND).not.toContainEqual({ status: "AVAILABLE" });

    // Section counts must use the same derived OR clause for honest tab badges.
    const countWheres = vi
      .mocked(db.asset.count)
      .mock.calls.map((call) => call[0]?.where) as Array<{ AND?: Array<Record<string, unknown>> }>;
    const sectionCountWhere = countWheres.find((w) => Array.isArray(w?.AND));
    expect(sectionCountWhere?.AND).toContainEqual({ OR: derivedAvailable });
    expect(sectionCountWhere?.AND).not.toContainEqual({ status: "AVAILABLE" });
  });

  it("keeps ids hydration and qr lookup exempt from available-only filtering", async () => {
    const derivedAvailable: DerivedStatusWhere[] = [{ status: AssetStatus.AVAILABLE, __derived: true }];
    vi.mocked(buildDerivedStatusWhere).mockReturnValue(derivedStatusWhereResult(derivedAvailable));

    await pickerSearch(
      get("/api/assets/picker-search?only_available=true&ids=asset-stale"),
      { params: Promise.resolve({}) },
    );
    const idsWhere = vi.mocked(db.asset.findMany).mock.calls.at(0)?.[0]?.where as {
      AND: Array<Record<string, unknown>>;
    };
    expect(idsWhere.AND).not.toContainEqual({ OR: derivedAvailable });
    expect(idsWhere.AND).toContainEqual({ id: { in: ["asset-stale"] } });

    vi.mocked(db.asset.findMany).mockClear();

    await pickerSearch(
      get("/api/assets/picker-search?only_available=true&qr=CAM-1"),
      { params: Promise.resolve({}) },
    );
    const qrWhere = vi.mocked(db.asset.findMany).mock.calls.at(0)?.[0]?.where as {
      AND: Array<Record<string, unknown>>;
    };
    expect(qrWhere.AND).not.toContainEqual({ OR: derivedAvailable });
  });

  it("runs bulk maintenance toggles inside a Serializable transaction", async () => {
    vi.mocked(db.asset.findMany).mockResolvedValue(assetFindManyResult([
      { id: "asset-1", status: AssetStatus.AVAILABLE, locationId: "loc-1", categoryId: "cat-1" },
      { id: "asset-2", status: AssetStatus.MAINTENANCE, locationId: "loc-1", categoryId: "cat-1" },
    ]));

    const res = await bulkAssets(
      post("/api/assets/bulk", {
        ids: ["cm111111111111111111111111", "cm222222222222222222222222"],
        action: "maintenance",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(globalThis.__wave12TransactionOptions).toEqual({
      isolationLevel: "Serializable",
    });
    expect(mockTx.asset.updateMany).toHaveBeenCalledTimes(2);
    expect(mockTx.auditLog.createMany).toHaveBeenCalledOnce();
  });

  it("blocks bulk delete when selected assets have booking history", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.asset.findMany).mockResolvedValue(assetFindManyResult([
      { id: "cm111111111111111111111111", status: AssetStatus.AVAILABLE, locationId: "loc-1", categoryId: "cat-1" },
    ]));
    mockTx.bookingSerializedItem.count.mockResolvedValue(1);

    const res = await bulkAssets(
      post("/api/assets/bulk", {
        ids: ["cm111111111111111111111111"],
        action: "delete",
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("booking history");
    expect(globalThis.__wave12TransactionOptions).toEqual({
      isolationLevel: "Serializable",
    });
    expect(mockTx.bookingSerializedItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assetAllocation.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.asset.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects bulk activity cursors outside the current SKU activity scope", async () => {
    vi.mocked(db.auditLog.findFirst).mockResolvedValue(null);

    const res = await bulkActivity(
      get("/api/bulk-skus/sku-1/activity?cursor=other-log"),
      { params: Promise.resolve({ id: "sku-1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid activity cursor");
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });
});
