import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  transaction: vi.fn(),
  bulkSkuFindUnique: vi.fn(),
  productCreate: vi.fn(),
  productFindUnique: vi.fn(),
  productFindFirst: vi.fn(),
  productUpdate: vi.fn(),
  unitFindUnique: vi.fn(),
  unitUpdate: vi.fn(),
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit", () => ({ createAuditEntryTx: mocks.createAuditEntryTx }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { POST as createProduct } from "@/app/api/bulk-skus/[id]/products/route";
import { PATCH as updateProduct } from "@/app/api/bulk-skus/[id]/products/[productId]/route";
import { PATCH as assignProduct } from "@/app/api/bulk-skus/[id]/units/[unitNumber]/product/route";

const PRODUCT_ONE_ID = "cmnrtqudd0005jp04hlg8vauz";
const PRODUCT_TWO_ID = "cmnrtqudx0009jp049epk5si3";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff",
  role: Role.STAFF,
  avatarUrl: null,
  forcePasswordChange: false,
};

function request(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  return new Request(`https://gear.test${path}`, {
    method,
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
  mocks.requireAuth.mockResolvedValue(staffUser);
  mocks.bulkSkuFindUnique.mockResolvedValue({ id: "family-1", trackByNumber: true });
  mocks.productCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({
    id: PRODUCT_ONE_ID,
    ...data,
    active: true,
    model: data.model ?? null,
    _count: { units: 0 },
  }));
  mocks.productFindUnique.mockResolvedValue({
    id: PRODUCT_ONE_ID,
    bulkSkuId: "family-1",
    name: "Watson NP-F550",
    normalizedName: "watson np-f550",
    brand: "Watson",
    model: "B-4203",
    active: true,
  });
  mocks.productFindFirst.mockResolvedValue({ id: PRODUCT_TWO_ID, name: "GVM NP-F" });
  mocks.productUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({
    id: PRODUCT_ONE_ID,
    bulkSkuId: "family-1",
    name: "Watson NP-F550",
    brand: "Watson",
    model: "B-4203",
    active: data.active ?? true,
    _count: { units: 4 },
  }));
  mocks.unitFindUnique.mockResolvedValue({
    id: "unit-7",
    bulkSkuId: "family-1",
    unitNumber: 7,
    product: { id: PRODUCT_ONE_ID, name: "Watson NP-F550" },
  });
  mocks.unitUpdate.mockResolvedValue({
    id: "unit-7",
    bulkSkuId: "family-1",
    productId: PRODUCT_TWO_ID,
    unitNumber: 7,
    product: { id: PRODUCT_TWO_ID, name: "GVM NP-F" },
  });
  mocks.createAuditEntryTx.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    bulkSku: { findUnique: mocks.bulkSkuFindUnique },
    bulkSkuProduct: {
      create: mocks.productCreate,
      findUnique: mocks.productFindUnique,
      findFirst: mocks.productFindFirst,
      update: mocks.productUpdate,
    },
    bulkSkuUnit: {
      findUnique: mocks.unitFindUnique,
      update: mocks.unitUpdate,
    },
  }));
});

describe("item-family products", () => {
  it("creates a normalized product and audit record in one transaction", async () => {
    const res = await createProduct(
      request("/api/bulk-skus/family-1/products", "POST", {
        name: "  Watson   NP-F550 ",
        brand: " Watson ",
        model: " B-4203 ",
      }),
      { params: Promise.resolve({ id: "family-1" }) },
    );

    expect(res.status).toBe(201);
    expect(mocks.productCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Watson NP-F550",
        normalizedName: "watson np-f550",
        brand: "Watson",
        model: "B-4203",
      }),
    }));
    expect(mocks.createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "created",
      entityType: "bulk_sku_product",
    }));
  });

  it("requires Units tracking before products can be added", async () => {
    mocks.bulkSkuFindUnique.mockResolvedValueOnce({ id: "family-1", trackByNumber: false });

    const res = await createProduct(
      request("/api/bulk-skus/family-1/products", "POST", { name: "GVM NP-F", brand: "GVM" }),
      { params: Promise.resolve({ id: "family-1" }) },
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Convert this item family to Units");
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("archives a product without deleting or rewriting assigned units", async () => {
    const res = await updateProduct(
      request(`/api/bulk-skus/family-1/products/${PRODUCT_ONE_ID}`, "PATCH", { active: false }),
      { params: Promise.resolve({ id: "family-1", productId: PRODUCT_ONE_ID }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.productUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: PRODUCT_ONE_ID },
      data: { active: false },
    }));
    expect(mocks.unitUpdate).not.toHaveBeenCalled();
    expect(mocks.createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "updated",
      after: expect.objectContaining({ active: false }),
    }));
  });

  it("assigns a product from the same family and audits the identity change", async () => {
    const res = await assignProduct(
      request("/api/bulk-skus/family-1/units/7/product", "PATCH", { productId: PRODUCT_TWO_ID }),
      { params: Promise.resolve({ id: "family-1", unitNumber: "7" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.productFindFirst).toHaveBeenCalledWith({
      where: { id: PRODUCT_TWO_ID, bulkSkuId: "family-1", active: true },
      select: { id: true, name: true },
    });
    expect(mocks.unitUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { productId: PRODUCT_TWO_ID },
    }));
    expect(mocks.createAuditEntryTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "assign_product",
      before: { productId: PRODUCT_ONE_ID, productName: "Watson NP-F550" },
      after: { productId: PRODUCT_TWO_ID, productName: "GVM NP-F" },
    }));
  });

  it("rejects a product that is inactive or belongs to another family", async () => {
    mocks.productFindFirst.mockResolvedValueOnce(null);

    const res = await assignProduct(
      request("/api/bulk-skus/family-1/units/7/product", "PATCH", { productId: PRODUCT_TWO_ID }),
      { params: Promise.resolve({ id: "family-1", unitNumber: "7" }) },
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Active product not found");
    expect(mocks.unitUpdate).not.toHaveBeenCalled();
  });
});
