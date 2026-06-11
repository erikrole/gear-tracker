import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    asset: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    bulkSku: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
  downloadImageToBlob: vi.fn(),
}));

vi.mock("@/lib/cron", () => ({
  withCron: (handler: any) => handler,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/blob", () => ({
  downloadImageToBlob: mocks.downloadImageToBlob,
}));

import { GET } from "@/app/api/cron/rehost-images/route";

function cronRequest() {
  return new Request("https://app.example.com/api/cron/rehost-images");
}

function cronContext() {
  return { params: Promise.resolve({}) };
}

describe("rehost-images cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.asset.findMany.mockResolvedValue([]);
    mocks.db.bulkSku.findMany.mockResolvedValue([]);
    mocks.db.asset.count.mockResolvedValue(0);
    mocks.db.bulkSku.count.mockResolvedValue(0);
    mocks.db.asset.update.mockResolvedValue({});
    mocks.db.bulkSku.update.mockResolvedValue({});
    mocks.downloadImageToBlob.mockResolvedValue(null);
  });

  it("queries asset and BulkSku candidates while excluding Blob URLs", async () => {
    await GET(cronRequest(), cronContext());

    expect(mocks.db.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          imageUrl: { not: null },
          imageRehostAttempts: { lt: 3 },
          NOT: { imageUrl: { contains: ".public.blob.vercel-storage.com" } },
        }),
      }),
    );
    expect(mocks.db.bulkSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          imageUrl: { not: null },
          imageRehostAttempts: { lt: 3 },
          NOT: { imageUrl: { contains: ".public.blob.vercel-storage.com" } },
        }),
      }),
    );
  });

  it("rewrites successful asset images and increments failed BulkSku attempts", async () => {
    mocks.db.asset.findMany.mockResolvedValue([{ id: "asset-1", imageUrl: "https://cdn.example.com/asset.jpg" }]);
    mocks.db.bulkSku.findMany.mockResolvedValue([{ id: "sku-1", imageUrl: "https://cdn.example.com/sku.jpg" }]);
    mocks.db.asset.count.mockResolvedValue(1);
    mocks.db.bulkSku.count.mockResolvedValue(2);
    mocks.downloadImageToBlob.mockImplementation(async (url: string) =>
      url.includes("asset") ? "https://blob.public.blob.vercel-storage.com/asset.jpg" : null,
    );

    const res = await GET(cronRequest(), cronContext());
    const json = await res.json();

    expect(mocks.db.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { imageUrl: "https://blob.public.blob.vercel-storage.com/asset.jpg" },
    });
    expect(mocks.db.asset.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: { imageRehostAttempts: { increment: 1 } },
      }),
    );
    expect(mocks.db.bulkSku.update).toHaveBeenCalledWith({
      where: { id: "sku-1" },
      data: { imageRehostAttempts: { increment: 1 } },
    });
    expect(json).toMatchObject({
      ok: true,
      candidates: 1,
      processed: 1,
      rehosted: 1,
      failed: 0,
      remaining: 1,
      assets: { processed: 1, rehosted: 1, failed: 0, remaining: 1 },
      bulkSkus: { processed: 1, rehosted: 0, failed: 1, remaining: 2 },
    });
  });

  it("rewrites successful BulkSku images without incrementing attempts", async () => {
    mocks.db.bulkSku.findMany.mockResolvedValue([{ id: "sku-2", imageUrl: "https://cdn.example.com/sku-2.jpg" }]);
    mocks.downloadImageToBlob.mockResolvedValue("https://blob.public.blob.vercel-storage.com/sku-2.jpg");

    const res = await GET(cronRequest(), cronContext());
    const json = await res.json();

    expect(mocks.db.bulkSku.update).toHaveBeenCalledWith({
      where: { id: "sku-2" },
      data: { imageUrl: "https://blob.public.blob.vercel-storage.com/sku-2.jpg" },
    });
    expect(mocks.db.bulkSku.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: { imageRehostAttempts: { increment: 1 } },
      }),
    );
    expect(json.bulkSkus).toMatchObject({ processed: 1, rehosted: 1, failed: 0, remaining: 0 });
  });
});
