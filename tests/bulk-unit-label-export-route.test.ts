import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  bulkSku: {
    findUnique: vi.fn(),
  },
  bulkSkuUnit: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    bulkSku: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (innerTx: typeof tx) => Promise<unknown>) => callback(tx)),
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/bulk-skus/[id]/units/labels/route";

const routeParams = { params: Promise.resolve({ id: "sku-1" }) };

function getRequest(path = "/api/bulk-skus/sku-1/units/labels") {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function postRequest(body: Record<string, unknown>) {
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

const skuForExport = {
  id: "sku-1",
  name: "Sony Battery",
  trackByNumber: true,
  binQrCodeValue: "SONY-BATTERY",
  units: [
    { id: "unit-2", unitNumber: 2, status: "AVAILABLE", labelPrintedAt: null },
    { id: "unit-1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({
    id: "staff-1",
    name: "Staff One",
    email: "staff@example.com",
    role: "STAFF",
  } as any);
  vi.mocked(db.bulkSku.findUnique).mockResolvedValue(skuForExport as any);
  tx.bulkSku.findUnique.mockResolvedValue({ id: "sku-1", name: "Sony Battery", trackByNumber: true });
  tx.bulkSkuUnit.findMany.mockResolvedValue([
    { id: "unit-1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null },
    { id: "unit-2", unitNumber: 2, status: "AVAILABLE", labelPrintedAt: new Date("2026-06-10T12:00:00.000Z") },
    { id: "unit-3", unitNumber: 3, status: "RETIRED", labelPrintedAt: null },
  ] as any);
  tx.bulkSkuUnit.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(createAuditEntryTx).mockResolvedValue(undefined as any);
});

describe("bulk unit label export route", () => {
  it("exports Brother CSV headers and rows sorted by unit number", async () => {
    await GET(getRequest(), routeParams);

    expect(db.bulkSku.findUnique).toHaveBeenCalledWith({
      where: { id: "sku-1" },
      include: {
        units: {
          where: { labelPrintedAt: null, status: { not: "RETIRED" } },
          orderBy: { unitNumber: "asc" },
        },
      },
    });
  });

  it("returns Brother CSV with unit numbers and derived QR values", async () => {
    vi.mocked(db.bulkSku.findUnique).mockResolvedValue({
      ...skuForExport,
      units: [
        { id: "unit-1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null },
        { id: "unit-2", unitNumber: 2, status: "AVAILABLE", labelPrintedAt: null },
      ],
    } as any);

    const res = await GET(getRequest(), routeParams);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("brother-labels-sony-battery-");
    expect(res.headers.get("x-label-unit-numbers")).toBe("1,2");
    expect(await res.text()).toBe("item_number,qr_code\n1,SONY-BATTERY-1\n2,SONY-BATTERY-2\n");
  });

  it("supports all scope for reprints without unprinted filtering", async () => {
    const res = await GET(getRequest("/api/bulk-skus/sku-1/units/labels?scope=all"), routeParams);

    expect(res.status).toBe(200);
    expect(db.bulkSku.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        units: {
          where: undefined,
          orderBy: { unitNumber: "asc" },
        },
      },
    }));
  });

  it("denies users without bulk SKU adjustment permission", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: "student-1",
      name: "Student One",
      email: "student@example.com",
      role: "STUDENT",
    } as any);

    const res = await GET(getRequest(), routeParams);

    expect(res.status).toBe(403);
    expect(db.bulkSku.findUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid, non-numbered, and missing-bin-QR SKUs", async () => {
    vi.mocked(db.bulkSku.findUnique).mockResolvedValueOnce(null);
    expect((await GET(getRequest(), routeParams)).status).toBe(404);

    vi.mocked(db.bulkSku.findUnique).mockResolvedValueOnce({ ...skuForExport, trackByNumber: false } as any);
    expect((await GET(getRequest(), routeParams)).status).toBe(400);

    vi.mocked(db.bulkSku.findUnique).mockResolvedValueOnce({ ...skuForExport, binQrCodeValue: " " } as any);
    const missingBinRes = await GET(getRequest(), routeParams);
    expect(missingBinRes.status).toBe(400);
    expect((await missingBinRes.json()).error).toContain("bin QR code");
  });

  it("uses CSV escaping and formula protection for QR values", async () => {
    vi.mocked(db.bulkSku.findUnique).mockResolvedValueOnce({
      ...skuForExport,
      binQrCodeValue: "=SONY",
      units: [{ id: "unit-1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null }],
    } as any);

    const res = await GET(getRequest(), routeParams);

    expect(await res.text()).toBe("item_number,qr_code\n1,'=SONY-1\n");
  });

  it("marks exported labels printed in a batch and writes one audit entry", async () => {
    const res = await POST(postRequest({ unitNumbers: [1, 2, 3], printed: true }), routeParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(tx.bulkSkuUnit.findMany).toHaveBeenCalledWith({
      where: {
        bulkSkuId: "sku-1",
        unitNumber: { in: [1, 2, 3] },
      },
      select: {
        id: true,
        unitNumber: true,
        status: true,
        labelPrintedAt: true,
      },
      orderBy: { unitNumber: "asc" },
    });
    expect(tx.bulkSkuUnit.updateMany).toHaveBeenCalledWith({
      where: {
        bulkSkuId: "sku-1",
        unitNumber: { in: [1] },
        status: { not: "RETIRED" },
        labelPrintedAt: null,
      },
      data: {
        labelPrintedAt: expect.any(Date),
        labelPrintedById: "staff-1",
        labelPrintBatchId: expect.any(String),
      },
    });
    expect(body.data).toEqual({
      batchId: expect.any(String),
      unitNumbers: [1, 2, 3],
      updated: 1,
      alreadyPrinted: 1,
      skippedRetired: 1,
    });
    expect(createAuditEntryTx).toHaveBeenCalledTimes(1);
    expect(createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "mark_unit_labels_printed",
      after: expect.objectContaining({
        skuId: "sku-1",
        unitNumbers: [1, 2, 3],
        counts: { updated: 1, alreadyPrinted: 1, skippedRetired: 1 },
      }),
    }));
  });

  it("rejects mark-printed requests when any unit number is outside the SKU", async () => {
    tx.bulkSkuUnit.findMany.mockResolvedValueOnce([
      { id: "unit-1", unitNumber: 1, status: "AVAILABLE", labelPrintedAt: null },
    ] as any);

    const res = await POST(postRequest({ unitNumbers: [1, 99], printed: true }), routeParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Every unit number");
    expect(tx.bulkSkuUnit.updateMany).not.toHaveBeenCalled();
  });
});
