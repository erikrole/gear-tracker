import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkUnitStatus, Role } from "@prisma/client";

const tx = {
  bulkSku: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  bulkSkuUnit: {
    findFirst: vi.fn(),
    createMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  bulkSkuProduct: {
    findFirst: vi.fn(),
  },
  bulkStockBalance: {
    upsert: vi.fn(),
    update: vi.fn(),
  },
  bulkStockMovement: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (callback: (innerTx: typeof tx) => Promise<unknown>) => callback(tx)),
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { POST as addBulkUnits } from "@/app/api/bulk-skus/[id]/units/route";
import { PATCH as updateBulkUnit } from "@/app/api/bulk-skus/[id]/units/[unitNumber]/route";

const routeParams = { params: Promise.resolve({ id: "sku-1", unitNumber: "7" }) };
const addRouteParams = { params: Promise.resolve({ id: "sku-1" }) };

function request(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method,
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
    name: "Staff One",
    email: "staff@example.com",
    role: Role.STAFF,
    avatarUrl: null,
  });
  tx.bulkSku.findUnique.mockResolvedValue({
    id: "sku-1",
    trackByNumber: true,
    locationId: "loc-1",
  });
  tx.bulkSku.findUniqueOrThrow.mockResolvedValue({
    id: "sku-1",
    locationId: "loc-1",
  });
  tx.bulkSkuUnit.findFirst.mockResolvedValue({ unitNumber: 12 });
  tx.bulkSkuUnit.createMany.mockResolvedValue({ count: 2 });
  tx.bulkSkuUnit.findUnique.mockResolvedValue({
    id: "unit-7",
    bulkSkuId: "sku-1",
    unitNumber: 7,
    status: BulkUnitStatus.AVAILABLE,
    notes: null,
    allocations: [],
  });
  tx.bulkSkuUnit.update.mockResolvedValue({
    id: "unit-7",
    bulkSkuId: "sku-1",
    unitNumber: 7,
    status: BulkUnitStatus.LOST,
    notes: null,
  });
  tx.bulkSkuProduct.findFirst.mockResolvedValue({
    id: "cmnrtqudd0005jp04hlg8vauz",
    name: "Watson NP-F550",
  });
  tx.bulkStockBalance.upsert.mockResolvedValue({});
  tx.bulkStockBalance.update.mockResolvedValue({});
  tx.bulkStockMovement.create.mockResolvedValue({});
  vi.mocked(createAuditEntry).mockResolvedValue(undefined);
});

describe("bulk unit adjustment routes", () => {
  it("adds numbered units with an operator reason in stock movement and audit", async () => {
    const res = await addBulkUnits(
      request("/api/bulk-skus/sku-1/units", "POST", { count: 2, reason: "New charger kit batteries" }),
      addRouteParams,
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toEqual({
      startNumber: 13,
      endNumber: 14,
      count: 2,
      reason: "Added units #13-#14: New charger kit batteries",
      productId: null,
      productName: null,
    });
    expect(tx.bulkStockBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { onHandQuantity: { increment: 2 } },
      create: expect.objectContaining({ onHandQuantity: 2 }),
    }));
    expect(tx.bulkStockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 2,
        reason: "Added units #13-#14: New charger kit batteries",
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "add_units",
      after: expect.objectContaining({ count: 2, reason: "Added units #13-#14: New charger kit batteries" }),
    }));
  });

  it("records status-change reasons and stock movement when availability changes", async () => {
    const res = await updateBulkUnit(
      request("/api/bulk-skus/sku-1/units/7", "PATCH", { status: "LOST", reason: "Missing after Saturday audit" }),
      routeParams,
    );

    expect(res.status).toBe(200);
    expect(tx.bulkStockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 1,
        reason: "Missing after Saturday audit",
      }),
    });
    expect(tx.bulkStockBalance.update).toHaveBeenCalledWith({
      where: { bulkSkuId_locationId: { bulkSkuId: "sku-1", locationId: "loc-1" } },
      data: { onHandQuantity: { decrement: 1 } },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_status",
      after: expect.objectContaining({ status: "LOST", reason: "Missing after Saturday audit" }),
    }));
  });

  it("assigns a selected product to every newly added unit", async () => {
    const productId = "cmnrtqudd0005jp04hlg8vauz";
    const res = await addBulkUnits(
      request("/api/bulk-skus/sku-1/units", "POST", { count: 2, productId }),
      addRouteParams,
    );

    expect(res.status).toBe(201);
    expect(tx.bulkSkuProduct.findFirst).toHaveBeenCalledWith({
      where: { id: productId, bulkSkuId: "sku-1", active: true },
      select: { id: true, name: true },
    });
    expect(tx.bulkSkuUnit.createMany).toHaveBeenCalledWith({
      data: [
        { bulkSkuId: "sku-1", productId, unitNumber: 13 },
        { bulkSkuId: "sku-1", productId, unitNumber: 14 },
      ],
    });
    expect((await res.json()).data).toEqual(expect.objectContaining({
      productId,
      productName: "Watson NP-F550",
    }));
  });

  it("does not clear printed-label fields when status changes", async () => {
    tx.bulkSkuUnit.findUnique.mockResolvedValueOnce({
      id: "unit-7",
      bulkSkuId: "sku-1",
      unitNumber: 7,
      status: BulkUnitStatus.AVAILABLE,
      notes: null,
      allocations: [],
      labelPrintedAt: new Date("2026-06-01T00:00:00.000Z"),
      labelPrintedById: "staff-1",
      labelPrintBatchId: "batch-1",
    });

    await updateBulkUnit(
      request("/api/bulk-skus/sku-1/units/7", "PATCH", { status: "LOST", reason: "Missing after Saturday audit" }),
      routeParams,
    );

    const updateCall = tx.bulkSkuUnit.update.mock.calls[0];
    expect(updateCall).toBeDefined();
    const updateArg = updateCall![0];
    expect(updateArg.data).not.toHaveProperty("labelPrintedAt");
    expect(updateArg.data).not.toHaveProperty("labelPrintedById");
    expect(updateArg.data).not.toHaveProperty("labelPrintBatchId");
    expect(updateArg.data).toEqual({ status: "LOST", notes: null });
  });

  it("blocks any status change while a unit has an active checkout allocation", async () => {
    tx.bulkSkuUnit.findUnique.mockResolvedValueOnce({
      id: "unit-7",
      bulkSkuId: "sku-1",
      unitNumber: 7,
      status: BulkUnitStatus.AVAILABLE,
      notes: null,
      allocations: [{ id: "alloc-1", bulkSkuUnitId: "unit-7" }],
    });

    const res = await updateBulkUnit(
      request("/api/bulk-skus/sku-1/units/7", "PATCH", { status: "AVAILABLE", reason: "Manual shelf count" }),
      routeParams,
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("checked-out unit");
    expect(tx.bulkSkuUnit.update).not.toHaveBeenCalled();
    expect(tx.bulkStockMovement.create).not.toHaveBeenCalled();
  });

  it("allows stale checked-out unit flags without active allocations to be corrected", async () => {
    tx.bulkSkuUnit.findUnique.mockResolvedValueOnce({
      id: "unit-7",
      bulkSkuId: "sku-1",
      unitNumber: 7,
      status: BulkUnitStatus.CHECKED_OUT,
      notes: null,
      allocations: [],
    });

    const res = await updateBulkUnit(
      request("/api/bulk-skus/sku-1/units/7", "PATCH", { status: "LOST", reason: "Shelf audit correction" }),
      routeParams,
    );

    expect(res.status).toBe(200);
    expect(tx.bulkStockBalance.update).toHaveBeenCalledWith({
      where: { bulkSkuId_locationId: { bulkSkuId: "sku-1", locationId: "loc-1" } },
      data: { onHandQuantity: { decrement: 1 } },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_status",
      before: expect.objectContaining({ status: "CHECKED_OUT" }),
      after: expect.objectContaining({ status: "LOST", reason: "Shelf audit correction" }),
    }));
  });
});
