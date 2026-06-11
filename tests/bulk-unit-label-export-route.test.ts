import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    bulkSku: { findUnique: vi.fn() },
    bulkSkuUnit: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/audit", () => ({ createAuditEntry: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";
import { GET as exportLabels, POST as markPrinted } from "@/app/api/bulk-skus/[id]/units/labels/route";

const tx = {
  bulkSku: { findUnique: vi.fn() },
  bulkSkuUnit: { findMany: vi.fn(), updateMany: vi.fn() },
};
const dbMock = db as unknown as {
  bulkSku: { findUnique: ReturnType<typeof vi.fn> };
  bulkSkuUnit: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const params = { params: Promise.resolve({ id: "sku-1" }) };

function getReq(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function postReq(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/bulk-skus/sku-1/units/labels", {
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
  vi.mocked(requireAuth).mockResolvedValue({
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
  } as any);
  dbMock.$transaction.mockImplementation(async (cb: (innerTx: typeof tx) => Promise<unknown>) => cb(tx));
  vi.mocked(createAuditEntry).mockResolvedValue(undefined as any);
});

describe("Brother label CSV export (GET)", () => {
  it("returns item_number,qr_code with unprinted, non-retired units sorted by unit number", async () => {
    dbMock.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1",
      name: "Sony Battery",
      trackByNumber: true,
      binQrCodeValue: "SONY-BATTERY",
    });
    dbMock.bulkSkuUnit.findMany.mockResolvedValue([
      { unitNumber: 1 },
      { unitNumber: 2 },
      { unitNumber: 3 },
    ]);

    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels"), params);
    const text = await res.text();

    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("brother-labels-sony-battery-");
    expect(text).toBe("item_number,qr_code\n1,SONY-BATTERY-1\n2,SONY-BATTERY-2\n3,SONY-BATTERY-3");

    expect(dbMock.bulkSkuUnit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { bulkSkuId: "sku-1", labelPrintedAt: null, status: { not: "RETIRED" } },
      orderBy: { unitNumber: "asc" },
    }));
  });

  it("scope=all includes every unit for reprints", async () => {
    dbMock.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1", name: "Sony Battery", trackByNumber: true, binQrCodeValue: "SONY-BATTERY",
    });
    dbMock.bulkSkuUnit.findMany.mockResolvedValue([{ unitNumber: 5 }]);

    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels?scope=all"), params);
    await res.text();

    expect(dbMock.bulkSkuUnit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { bulkSkuId: "sku-1" },
    }));
  });

  it("escapes formula-like bin QR values so spreadsheets stay safe", async () => {
    dbMock.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1", name: "Sony Battery", trackByNumber: true, binQrCodeValue: "=SONY",
    });
    dbMock.bulkSkuUnit.findMany.mockResolvedValue([{ unitNumber: 1 }]);

    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels"), params);
    const text = await res.text();

    expect(text).toBe("item_number,qr_code\n1,'=SONY-1");
  });

  it("rejects SKUs that do not track by number", async () => {
    dbMock.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1", name: "AA", trackByNumber: false, binQrCodeValue: "AA",
    });

    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels"), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("track by number");
  });

  it("rejects export when the bin QR code is missing", async () => {
    dbMock.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1", name: "Sony Battery", trackByNumber: true, binQrCodeValue: null,
    });

    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels"), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("bin QR code");
    expect(dbMock.bulkSkuUnit.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown SKU", async () => {
    dbMock.bulkSku.findUnique.mockResolvedValue(null);
    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels"), params);
    expect(res.status).toBe(404);
  });

  it("denies users without bulk_sku adjust permission", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "student-1", name: "Student", email: "s@example.com", role: "STUDENT",
    } as any);

    const res = await exportLabels(getReq("/api/bulk-skus/sku-1/units/labels"), params);
    expect(res.status).toBe(403);
  });
});

describe("mark labels printed (POST)", () => {
  it("marks only unprinted, non-retired units and reports counts plus audit", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({ id: "sku-1", trackByNumber: true });
    tx.bulkSkuUnit.findMany.mockResolvedValue([
      { id: "u1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null },
      { id: "u2", unitNumber: 2, status: "AVAILABLE", labelPrintedAt: new Date() },
      { id: "u3", unitNumber: 3, status: "RETIRED", labelPrintedAt: null },
    ]);
    tx.bulkSkuUnit.updateMany.mockResolvedValue({ count: 1 });

    const res = await markPrinted(postReq({ unitNumbers: [1, 2, 3], printed: true }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      updated: 1,
      alreadyPrinted: 1,
      skippedRetired: 1,
      markedUnitNumbers: [1],
    }));
    expect(tx.bulkSkuUnit.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["u1"] } },
      data: expect.objectContaining({ labelPrintedById: "staff-1" }),
    }));
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "mark_labels_printed",
      after: expect.objectContaining({ updated: 1, alreadyPrinted: 1, skippedRetired: 1 }),
    }));
  });

  it("rejects unit numbers that do not belong to the SKU", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({ id: "sku-1", trackByNumber: true });
    tx.bulkSkuUnit.findMany.mockResolvedValue([
      { id: "u1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null },
    ]);

    const res = await markPrinted(postReq({ unitNumbers: [1, 99], printed: true }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("99");
    expect(tx.bulkSkuUnit.updateMany).not.toHaveBeenCalled();
  });

  it("denies users without bulk_sku adjust permission", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "student-1", name: "Student", email: "s@example.com", role: "STUDENT",
    } as any);

    const res = await markPrinted(postReq({ unitNumbers: [1], printed: true }), params);
    expect(res.status).toBe(403);
  });
});
