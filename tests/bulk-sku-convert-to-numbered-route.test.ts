import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { MAX_NUMBERED_UNITS_PER_CREATE } from "@/lib/request-limits";

const tx = {
  bulkSku: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  bulkSkuUnit: {
    createMany: vi.fn(),
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
import { POST as convertToNumbered } from "@/app/api/bulk-skus/[id]/convert-to-numbered/route";

const routeParams = { params: Promise.resolve({ id: "sku-1" }) };

function request() {
  return new Request("https://app.example.com/api/bulk-skus/sku-1/convert-to-numbered", {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
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
  tx.bulkSku.update.mockResolvedValue({});
  tx.bulkSkuUnit.createMany.mockResolvedValue({ count: MAX_NUMBERED_UNITS_PER_CREATE });
  vi.mocked(createAuditEntry).mockResolvedValue(undefined);
});

describe("convert bulk SKU to numbered tracking", () => {
  it("materializes the exact numbered-unit ceiling", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1",
      trackByNumber: false,
      locationId: "loc-1",
      balances: [{ locationId: "loc-1", onHandQuantity: MAX_NUMBERED_UNITS_PER_CREATE }],
    });

    const res = await convertToNumbered(request(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(tx.bulkSku.update).toHaveBeenCalledWith({
      where: { id: "sku-1" },
      data: { trackByNumber: true },
    });
    const createArgs = tx.bulkSkuUnit.createMany.mock.calls[0]![0];
    expect(createArgs.data).toHaveLength(MAX_NUMBERED_UNITS_PER_CREATE);
    expect(createArgs.data[0]).toEqual({ bulkSkuId: "sku-1", unitNumber: 1 });
    expect(createArgs.data.at(-1)).toEqual({
      bulkSkuId: "sku-1",
      unitNumber: MAX_NUMBERED_UNITS_PER_CREATE,
    });
    expect(body.data).toEqual({
      converted: true,
      unitsCreated: MAX_NUMBERED_UNITS_PER_CREATE,
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "convert_to_numbered",
    }));
  });

  it("rejects materialization above the numbered-unit ceiling before writes", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1",
      trackByNumber: false,
      locationId: "loc-1",
      balances: [{ locationId: "loc-1", onHandQuantity: MAX_NUMBERED_UNITS_PER_CREATE + 1 }],
    });

    const res = await convertToNumbered(request(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain(`at most ${MAX_NUMBERED_UNITS_PER_CREATE} numbered units`);
    expect(tx.bulkSku.update).not.toHaveBeenCalled();
    expect(tx.bulkSkuUnit.createMany).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("rejects a negative stored balance before writes", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1",
      trackByNumber: false,
      locationId: "loc-1",
      balances: [{ locationId: "loc-1", onHandQuantity: -1 }],
    });

    const res = await convertToNumbered(request(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("cannot be negative");
    expect(tx.bulkSku.update).not.toHaveBeenCalled();
    expect(tx.bulkSkuUnit.createMany).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("rejects nonzero off-location stock even when the current-location balance exists", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1",
      trackByNumber: false,
      locationId: "loc-1",
      balances: [
        { locationId: "loc-old", onHandQuantity: MAX_NUMBERED_UNITS_PER_CREATE + 1 },
        { locationId: "loc-1", onHandQuantity: 2 },
      ],
    });

    const res = await convertToNumbered(request(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("Nonzero bulk stock exists outside the current location");
    expect(tx.bulkSku.update).not.toHaveBeenCalled();
    expect(tx.bulkSkuUnit.createMany).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("rejects nonzero historical stock when the current-location balance is missing", async () => {
    tx.bulkSku.findUnique.mockResolvedValue({
      id: "sku-1",
      trackByNumber: false,
      locationId: "loc-1",
      balances: [{ locationId: "loc-old", onHandQuantity: 2 }],
    });

    const res = await convertToNumbered(request(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("Nonzero bulk stock exists outside the current location");
    expect(tx.bulkSku.update).not.toHaveBeenCalled();
    expect(tx.bulkSkuUnit.createMany).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });
});
