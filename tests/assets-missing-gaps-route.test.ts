import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  assetFindMany: vi.fn(),
  assetCount: vi.fn(),
  bulkSkuFindMany: vi.fn(),
  bulkSkuCount: vi.fn(),
  categoryFindMany: vi.fn(),
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
    bulkSku: {
      findMany: mocks.bulkSkuFindMany,
      count: mocks.bulkSkuCount,
    },
    category: {
      findMany: mocks.categoryFindMany,
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

function assetGap(id: string, assetTag: string) {
  return {
    id,
    assetTag,
    name: null,
    brand: "Sony",
    model: "FX6",
    categoryId: null,
    category: null,
    imageUrl: null,
  };
}

function bulkGap(id: string, name: string, category: string | null = null) {
  return {
    id,
    name,
    category,
    categoryId: null,
    imageUrl: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(authedUser);
  mocks.assetFindMany.mockResolvedValue([]);
  mocks.assetCount.mockResolvedValue(0);
  mocks.bulkSkuFindMany.mockResolvedValue([]);
  mocks.bulkSkuCount.mockResolvedValue(0);
  mocks.categoryFindMany.mockResolvedValue([]);
});

describe("GET /api/assets missing-field cleanup queue", () => {
  it("counts both sources and fetches only the requested standard-item page", async () => {
    mocks.assetCount.mockResolvedValue(3);
    mocks.bulkSkuCount.mockResolvedValue(2);
    mocks.assetFindMany
      .mockResolvedValueOnce([assetGap("asset-2", "A-2"), assetGap("asset-3", "A-3")])
      .mockResolvedValueOnce([]);
    mocks.bulkSkuFindMany.mockResolvedValueOnce([]);

    const res = await getAssets(request("/api/assets?missing=category&limit=2&offset=1"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.data.map((item: { id: string }) => item.id)).toEqual(["asset-2", "asset-3"]);
    expect(body.truncated).toBe(true);
    expect(body.suggestionsLimited).toBe(false);
    expect(mocks.assetFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      skip: 1,
      take: 2,
      select: expect.objectContaining({ assetTag: true }),
    }));
    expect(mocks.bulkSkuFindMany).not.toHaveBeenCalledWith(expect.objectContaining({
      skip: expect.any(Number),
      take: 0,
    }));
  });

  it("pages item-family gaps after the standard-item range without loading standard rows", async () => {
    mocks.assetCount.mockResolvedValue(1);
    mocks.bulkSkuCount.mockResolvedValue(4);
    mocks.bulkSkuFindMany.mockResolvedValueOnce([
      bulkGap("bulk-2", "Battery 2"),
      bulkGap("bulk-3", "Battery 3"),
    ]);

    const res = await getAssets(request("/api/assets?missing=department&limit=2&offset=2"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.data.map((item: { id: string }) => item.id)).toEqual(["bulk-2", "bulk-3"]);
    expect(mocks.assetFindMany).not.toHaveBeenCalled();
    expect(mocks.bulkSkuFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 1,
      take: 2,
      select: expect.objectContaining({ name: true }),
    }));
  });

  it("reports when category suggestion source sampling is capped", async () => {
    mocks.assetCount.mockResolvedValue(1);
    mocks.bulkSkuCount.mockResolvedValue(0);
    mocks.assetFindMany
      .mockResolvedValueOnce([assetGap("asset-1", "FX6-1")])
      .mockResolvedValueOnce(Array.from({ length: 5001 }, (_, index) => ({
        assetTag: `FX6-${index}`,
        name: null,
        brand: "Sony",
        model: "FX6",
        categoryId: "cat-camera",
      })));
    mocks.categoryFindMany.mockResolvedValue([{ id: "cat-camera", name: "Cameras" }]);
    mocks.bulkSkuFindMany.mockResolvedValueOnce([]);

    const res = await getAssets(request("/api/assets?missing=category&limit=1"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestionsLimited).toBe(true);
    expect(mocks.assetFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      take: 5001,
      select: expect.objectContaining({ categoryId: true }),
    }));
  });
});
