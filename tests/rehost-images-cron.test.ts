import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
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
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/blob", () => ({
  downloadImageToBlob: vi.fn(),
}));

import { downloadImageToBlob } from "@/lib/blob";
import { GET } from "@/app/api/cron/rehost-images/route";

function cronRequest() {
  return new Request("https://app.example.com/api/cron/rehost-images", {
    method: "GET",
    headers: {
      authorization: "Bearer cron-secret",
      host: "app.example.com",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  dbMock.asset.findMany.mockResolvedValue([]);
  dbMock.bulkSku.findMany.mockResolvedValue([]);
  dbMock.asset.update.mockResolvedValue({});
  dbMock.bulkSku.update.mockResolvedValue({});
  dbMock.asset.count.mockResolvedValue(0);
  dbMock.bulkSku.count.mockResolvedValue(0);
  vi.mocked(downloadImageToBlob).mockResolvedValue(null);
});

describe("rehost-images cron", () => {
  it("drains both serialized asset and item-family external image candidates", async () => {
    dbMock.asset.findMany.mockResolvedValueOnce([
      { id: "asset-1", imageUrl: "https://cdn.example.com/camera.jpg" },
    ]);
    dbMock.bulkSku.findMany.mockResolvedValueOnce([
      { id: "bulk-1", imageUrl: "https://cdn.example.com/battery.jpg" },
    ]);
    vi.mocked(downloadImageToBlob).mockImplementation(async (_url, id) =>
      `https://gear.public.blob.vercel-storage.com/assets/${id}/image.jpg`,
    );

    const res = await GET(cronRequest(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(dbMock.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 16,
        where: expect.objectContaining({
          imageRehostAttempts: { lt: 3 },
          NOT: { imageUrl: { contains: ".public.blob.vercel-storage.com" } },
        }),
      }),
    );
    expect(dbMock.bulkSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 8,
        where: expect.objectContaining({
          active: true,
          imageUrl: { not: null },
          imageRehostAttempts: { lt: 3 },
          NOT: { imageUrl: { contains: ".public.blob.vercel-storage.com" } },
        }),
      }),
    );
    expect(dbMock.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { imageUrl: "https://gear.public.blob.vercel-storage.com/assets/asset-1/image.jpg" },
    });
    expect(dbMock.bulkSku.update).toHaveBeenCalledWith({
      where: { id: "bulk-1" },
      data: { imageUrl: "https://gear.public.blob.vercel-storage.com/assets/bulk-1/image.jpg" },
    });
    expect(body).toMatchObject({
      ok: true,
      candidates: 2,
      assetCandidates: 1,
      bulkSkuCandidates: 1,
      processed: 2,
      assetProcessed: 1,
      bulkSkuProcessed: 1,
      rehosted: 2,
      assetRehosted: 1,
      bulkSkuRehosted: 1,
      failed: 0,
      remaining: 0,
      assetRemaining: 0,
      bulkSkuRemaining: 0,
    });
  });

  it("increments retry attempts but preserves failed image URLs", async () => {
    dbMock.asset.findMany.mockResolvedValueOnce([
      { id: "asset-1", imageUrl: "https://cdn.example.com/missing-camera.jpg" },
    ]);
    dbMock.bulkSku.findMany.mockResolvedValueOnce([
      { id: "bulk-1", imageUrl: "https://cdn.example.com/missing-battery.jpg" },
    ]);
    dbMock.asset.count.mockResolvedValueOnce(1);
    dbMock.bulkSku.count.mockResolvedValueOnce(1);
    vi.mocked(downloadImageToBlob).mockResolvedValue(null);

    const res = await GET(cronRequest(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(dbMock.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { imageRehostAttempts: { increment: 1 } },
    });
    expect(dbMock.bulkSku.update).toHaveBeenCalledWith({
      where: { id: "bulk-1" },
      data: { imageRehostAttempts: { increment: 1 } },
    });
    expect(body).toMatchObject({
      processed: 2,
      rehosted: 0,
      failed: 2,
      assetFailed: 1,
      bulkSkuFailed: 1,
      remaining: 2,
      assetRemaining: 1,
      bulkSkuRemaining: 1,
    });
  });
});
