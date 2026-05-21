import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  asset: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
      (globalThis as any).__assetTransactionOptions = options;
      return fn(mockTx);
    }),
    asset: {
      findUnique: vi.fn(),
    },
    favoriteItem: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry, createAuditEntryTx } from "@/lib/audit";
import { POST as retireAsset } from "@/app/api/assets/[id]/retire/route";
import { POST as favoriteAsset } from "@/app/api/assets/[id]/favorite/route";
import { PATCH as moveAccessory } from "@/app/api/assets/[id]/accessories/route";

const assetParams = { params: Promise.resolve({ id: "asset-1" }) };

function post(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
  });
}

function patch(path: string, body: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method: "PATCH",
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
  (globalThis as any).__assetTransactionOptions = undefined;
  vi.mocked(requireAuth).mockResolvedValue({
    id: "staff-1",
    email: "staff@example.com",
    name: "Staff One",
    role: "STAFF" as any,
    avatarUrl: null,
  });
  mockTx.asset.findUnique.mockResolvedValue({ id: "asset-1", status: "AVAILABLE" });
  mockTx.asset.update.mockResolvedValue({ id: "asset-1", status: "RETIRED" });
  vi.mocked(db.asset.findUnique).mockResolvedValue({ id: "asset-1" } as any);
  vi.mocked(db.favoriteItem.findUnique).mockResolvedValue(null);
  vi.mocked(db.favoriteItem.create).mockResolvedValue({ id: "favorite-1" } as any);
});

describe("asset action hardening", () => {
  it("retires assets inside a Serializable transaction with audit in the same unit", async () => {
    const res = await retireAsset(post("/api/assets/asset-1/retire"), assetParams);

    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect((globalThis as any).__assetTransactionOptions).toEqual({
      isolationLevel: "Serializable",
    });
    expect(mockTx.asset.findUnique).toHaveBeenCalledWith({ where: { id: "asset-1" } });
    expect(mockTx.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { status: "RETIRED" },
      include: { location: true, category: true },
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        actorId: "staff-1",
        entityType: "asset",
        entityId: "asset-1",
        action: "retired",
      }),
    );
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("checks asset existence before creating a favorite", async () => {
    const res = await favoriteAsset(post("/api/assets/asset-1/favorite"), assetParams);

    expect(res.status).toBe(200);
    expect(db.asset.findUnique).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      select: { id: true },
    });
    expect(db.favoriteItem.create).toHaveBeenCalledWith({
      data: { userId: "staff-1", assetId: "asset-1" },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "staff-1",
        entityType: "asset",
        entityId: "asset-1",
        action: "favorite_added",
      }),
    );
  });

  it("returns 404 instead of relying on a favorite foreign-key failure", async () => {
    vi.mocked(db.asset.findUnique).mockResolvedValue(null);

    const res = await favoriteAsset(post("/api/assets/missing/favorite"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(res.status).toBe(404);
    expect(db.favoriteItem.findUnique).not.toHaveBeenCalled();
    expect(db.favoriteItem.create).not.toHaveBeenCalled();
  });

  it("moves an accessory to a new standalone parent and audits the previous parent", async () => {
    const newParentId = "ckm1ii0vw0000a01s6z6c3q8v";
    mockTx.asset.findUnique
      .mockResolvedValueOnce({ id: "child-1", parentAssetId: "old-parent" })
      .mockResolvedValueOnce({ id: newParentId, parentAssetId: null });
    mockTx.asset.update.mockResolvedValue({ id: "child-1", parentAssetId: newParentId });

    const res = await moveAccessory(
      patch("/api/assets/child-1/accessories", { newParentAssetId: newParentId }),
      { params: Promise.resolve({ id: "child-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockTx.asset.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: "child-1" },
      select: { id: true, parentAssetId: true },
    });
    expect(mockTx.asset.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: newParentId },
      select: { id: true, parentAssetId: true },
    });
    expect(mockTx.asset.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { parentAssetId: newParentId },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "staff-1",
        entityType: "asset",
        entityId: "child-1",
        action: "accessory_moved",
        before: { parentAssetId: "old-parent" },
        after: { parentAssetId: newParentId },
      }),
    );
  });
});
