import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  transaction: vi.fn(),
  bulkSkuFindUnique: vi.fn(),
  bulkSkuFindFirst: vi.fn(),
  assetFindFirst: vi.fn(),
  bulkSkuUpdate: vi.fn(),
  createAuditEntryTx: vi.fn(),
  generateAssetQrCode: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/db", () => ({
  db: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/audit", () => ({ createAuditEntryTx: mocks.createAuditEntryTx }));
vi.mock("@/lib/asset-qr-code", () => ({ generateAssetQrCode: mocks.generateAssetQrCode }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { POST } from "@/app/api/bulk-skus/[id]/qr-code/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN",
  avatarUrl: null,
  forcePasswordChange: false,
};

function request(body: Record<string, unknown>) {
  return new Request("https://gear.test/api/bulk-skus/sku-1/qr-code", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "gear.test",
      origin: "https://gear.test",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(adminUser);
  mocks.generateAssetQrCode.mockReturnValue("A1B2C3D4");
  mocks.bulkSkuFindUnique.mockResolvedValue({
    id: "sku-1",
    name: "Gold Mount Battery",
    binQrCodeValue: "BAD-CODE",
  });
  mocks.bulkSkuFindFirst.mockResolvedValue(null);
  mocks.assetFindFirst.mockResolvedValue(null);
  mocks.bulkSkuUpdate.mockImplementation(({ data }: { data: { binQrCodeValue: string } }) => Promise.resolve({
    id: "sku-1",
    name: "Gold Mount Battery",
    binQrCodeValue: data.binQrCodeValue,
  }));
  mocks.createAuditEntryTx.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    bulkSku: {
      findUnique: mocks.bulkSkuFindUnique,
      findFirst: mocks.bulkSkuFindFirst,
      update: mocks.bulkSkuUpdate,
    },
    asset: { findFirst: mocks.assetFindFirst },
  }));
});

describe("item-family QR replacement", () => {
  it("generates a replacement and audits the old and new codes atomically", async () => {
    const res = await POST(request({}), { params: Promise.resolve({ id: "sku-1" }) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { id: "sku-1", name: "Gold Mount Battery", binQrCodeValue: "A1B2C3D4" },
    });
    expect(mocks.bulkSkuUpdate).toHaveBeenCalledWith({
      where: { id: "sku-1" },
      data: { binQrCodeValue: "A1B2C3D4" },
      select: { id: true, name: true, binQrCodeValue: true },
    });
    expect(mocks.createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "qr_generated",
      before: { binQrCodeValue: "BAD-CODE" },
      after: { binQrCodeValue: "A1B2C3D4" },
    }));
  });

  it("retries generated values that collide in the shared scan namespace", async () => {
    mocks.generateAssetQrCode
      .mockReturnValueOnce("DUPLICATE")
      .mockReturnValueOnce("UNIQUE01");
    mocks.bulkSkuFindFirst
      .mockResolvedValueOnce({ id: "sku-2" })
      .mockResolvedValueOnce(null);

    const res = await POST(request({}), { params: Promise.resolve({ id: "sku-1" }) });

    expect(res.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.bulkSkuUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { binQrCodeValue: "UNIQUE01" },
    }));
  });

  it("trims and saves a manually scanned replacement code", async () => {
    const res = await POST(request({ value: "  GOLD-MOUNT-NEW  " }), {
      params: Promise.resolve({ id: "sku-1" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.bulkSkuUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { binQrCodeValue: "GOLD-MOUNT-NEW" },
    }));
    expect(mocks.createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "qr_changed",
    }));
  });

  it("rejects case-insensitive collisions with another item family", async () => {
    mocks.bulkSkuFindFirst.mockResolvedValueOnce({ id: "sku-2" });

    const res = await POST(request({ value: "duplicate" }), {
      params: Promise.resolve({ id: "sku-1" }),
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("QR code already belongs to another item");
    expect(mocks.bulkSkuUpdate).not.toHaveBeenCalled();
    expect(mocks.createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("rejects collisions with serialized QR, primary scan, and asset-tag identities", async () => {
    mocks.assetFindFirst.mockResolvedValueOnce({ id: "asset-1" });

    const res = await POST(request({ value: "serialized-code" }), {
      params: Promise.resolve({ id: "sku-1" }),
    });

    expect(res.status).toBe(409);
    expect(mocks.assetFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { qrCodeValue: { equals: "serialized-code", mode: "insensitive" } },
          { primaryScanCode: { equals: "serialized-code", mode: "insensitive" } },
          { assetTag: { equals: "serialized-code", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    expect(mocks.bulkSkuUpdate).not.toHaveBeenCalled();
  });
});
