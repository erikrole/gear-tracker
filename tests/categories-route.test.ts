import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// ─── Mock modules ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ...(() => {
    const category = {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    };
    const asset = {
      groupBy: vi.fn(),
      count: vi.fn(),
    };
    const bulkSku = {
      groupBy: vi.fn(),
      count: vi.fn(),
    };
    const tx = { category, asset, bulkSku };
    return {
      db: {
        ...tx,
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
        _mockTx: tx,
      },
    };
  })(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntryTx } from "@/lib/audit";
import { GET, POST } from "@/app/api/categories/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/categories/[id]/route";

type CategoryListRow = {
  id: string;
  name: string;
  parentId: string | null;
};

type CategoryCountRow = {
  categoryId: string | null;
  _count: { id: number };
};

type CategoryResponseRow = CategoryListRow & {
  itemCount: number;
};

type MockFn = ReturnType<typeof vi.fn>;
type CategoryTxMock = {
  category: Record<"findMany" | "findUnique" | "findFirst" | "create" | "update" | "count" | "delete", MockFn>;
  asset: Record<"groupBy" | "count", MockFn>;
  bulkSku: Record<"groupBy" | "count", MockFn>;
};

const categoryTx = (db as unknown as { _mockTx: CategoryTxMock })._mockTx;
const transactionMock = db.$transaction as unknown as MockFn;

function categoryFindManyResult(rows: CategoryListRow[]) {
  return rows as unknown as Awaited<ReturnType<typeof db.category.findMany>>;
}

function assetGroupByResult(rows: CategoryCountRow[]) {
  return rows as unknown as Awaited<ReturnType<typeof db.asset.groupBy>>;
}

function bulkSkuGroupByResult(rows: CategoryCountRow[]) {
  return rows as unknown as Awaited<ReturnType<typeof db.bulkSku.groupBy>>;
}

function categoryFindUniqueResult(row: CategoryListRow | null) {
  return row as unknown as Awaited<ReturnType<typeof db.category.findUnique>>;
}

function categoryFindFirstResult(row: CategoryListRow | null) {
  return row as unknown as Awaited<ReturnType<typeof db.category.findFirst>>;
}

function categoryCreateResult(row: CategoryListRow) {
  return row as unknown as Awaited<ReturnType<typeof db.category.create>>;
}

function categoryUpdateResult(row: CategoryListRow) {
  return row as unknown as Awaited<ReturnType<typeof db.category.update>>;
}

function categoryDeleteResult(row: object) {
  return row as unknown as Awaited<ReturnType<typeof db.category.delete>>;
}

function categoryParentChain(parentDepth: number) {
  const ids = [
    "cm234567890123456789012345",
    ...Array.from({ length: parentDepth }, (_, index) => `chain-${index + 1}`),
  ];
  return ids.map((id, index) => ({
    id,
    name: `Level ${index}`,
    parentId: ids[index + 1] ?? null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionMock.mockImplementation(
    async (fn: (tx: CategoryTxMock) => Promise<unknown>) => fn(categoryTx),
  );
  vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([]));
  vi.mocked(db.category.findFirst).mockResolvedValue(null);
  vi.mocked(db.asset.count).mockResolvedValue(0);
  vi.mocked(db.bulkSku.count).mockResolvedValue(0);
  vi.mocked(db.category.count).mockResolvedValue(0);
  vi.mocked(createAuditEntryTx).mockResolvedValue(undefined);
});

const adminUser = {
  id: "admin-1",
  email: "admin@test.com",
  name: "Admin",
  role: "ADMIN" as const,
  avatarUrl: null,
};

const staffUser = {
  id: "staff-1",
  email: "staff@test.com",
  name: "Staff",
  role: "STAFF" as const,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@test.com",
  name: "Student",
  role: "STUDENT" as const,
  avatarUrl: null,
};

function makeGetRequest() {
  return new Request("https://app.example.com/api/categories", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/categories", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: Record<string, unknown>, id = "cm123456789012345678901234") {
  return new Request(`https://app.example.com/api/categories/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id = "cm123456789012345678901234") {
  return new Request(`https://app.example.com/api/categories/${id}`, {
    method: "DELETE",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
  });
}

const noParams = { params: Promise.resolve({}) };
const categoryParams = { params: Promise.resolve({ id: "cm123456789012345678901234" }) };

function serializableConflict() {
  return new Prisma.PrismaClientKnownRequestError("Serializable conflict", {
    code: "P2034",
    clientVersion: "test",
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/categories
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/categories", () => {
  it("returns categories with item counts for any authenticated user", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      { id: "cat-1", name: "Cameras", parentId: null },
      { id: "cat-2", name: "Tripods", parentId: null },
    ]));
    vi.mocked(db.asset.groupBy).mockResolvedValue(assetGroupByResult([
      { categoryId: "cat-1", _count: { id: 5 } },
    ]));
    vi.mocked(db.bulkSku.groupBy).mockResolvedValue(bulkSkuGroupByResult([
      { categoryId: "cat-1", _count: { id: 3 } },
      { categoryId: "cat-2", _count: { id: 2 } },
    ]));

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: CategoryResponseRow[] };
    expect(body.data).toHaveLength(2);
    // cat-1 has 5 assets + 3 bulk = 8
    expect(body.data.find((c) => c.id === "cat-1")?.itemCount).toBe(8);
    // cat-2 has 0 assets + 2 bulk = 2
    expect(body.data.find((c) => c.id === "cat-2")?.itemCount).toBe(2);
  });

  it("returns zero counts when no items exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      { id: "cat-1", name: "Empty Category", parentId: null },
    ]));
    vi.mocked(db.asset.groupBy).mockResolvedValue(assetGroupByResult([]));
    vi.mocked(db.bulkSku.groupBy).mockResolvedValue(bulkSkuGroupByResult([]));

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].itemCount).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/categories
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/categories", () => {
  it("creates a new root category for ADMIN", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    vi.mocked(db.category.create).mockResolvedValue(categoryCreateResult({
      id: "cat-new",
      name: "Lighting",
      parentId: null,
    }));

    const res = await POST(
      makePostRequest({ name: "  Lighting  " }),
      noParams
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Lighting");
    expect(db.category.create).toHaveBeenCalledWith({
      data: { name: "Lighting", parentId: null },
    });
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(categoryTx, expect.objectContaining({
      entityId: "cat-new",
      action: "created",
    }));
  });

  it("creates a child category with valid parentId", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([{
      id: "cm123456789012345678901234",
      name: "Equipment",
      parentId: null,
    }]));
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    vi.mocked(db.category.create).mockResolvedValue(categoryCreateResult({
      id: "cm234567890123456789012345",
      name: "Lenses",
      parentId: "cm123456789012345678901234",
    }));

    const res = await POST(
      makePostRequest({ name: "Lenses", parentId: "cm123456789012345678901234" }),
      noParams
    );

    expect(res.status).toBe(201);
  });

  it("returns 404 when parentId does not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await POST(
      makePostRequest({ name: "Child", parentId: "cm123456789012345678901234" }),
      noParams
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Parent category not found");
  });

  it("returns 409 when a category already exists in the same level", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findFirst).mockResolvedValue(categoryFindFirstResult({
      id: "cat-existing",
      name: "Lighting",
      parentId: null,
    }));

    const res = await POST(
      makePostRequest({ name: "Lighting" }),
      noParams
    );

    expect(res.status).toBe(409);
    expect(db.category.create).not.toHaveBeenCalled();
  });

  it("returns 409 when create hits a unique constraint", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["name", "parentId"] },
    });
    vi.mocked(db.category.create).mockRejectedValue(uniqueError);

    const res = await POST(
      makePostRequest({ name: "Lighting" }),
      noParams
    );

    expect(res.status).toBe(409);
  });

  it("accepts a new leaf whose resulting root-to-leaf path is exactly 25 edges", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult(
      categoryParentChain(24),
    ));
    vi.mocked(db.category.create).mockResolvedValue(categoryCreateResult({
      id: "cat-new",
      name: "Deep Leaf",
      parentId: "cm234567890123456789012345",
    }));

    const res = await POST(makePostRequest({
      name: "Deep Leaf",
      parentId: "cm234567890123456789012345",
    }), noParams);

    expect(res.status).toBe(201);
    expect(db.category.findMany).toHaveBeenCalledOnce();
    expect(db.category.create).toHaveBeenCalledOnce();
  });

  it("rejects a new leaf whose resulting path would be 26 edges", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult(
      categoryParentChain(25),
    ));

    const res = await POST(makePostRequest({
      name: "Too Deep",
      parentId: "cm234567890123456789012345",
    }), noParams);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("25 parent-child edges");
    expect(db.category.findMany).toHaveBeenCalledOnce();
    expect(db.category.create).not.toHaveBeenCalled();
  });

  it("BUG: retries a concurrent root insert and observes the duplicate despite a null parent", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(categoryFindFirstResult({
        id: "cat-winner",
        name: "Lighting",
        parentId: null,
      }));
    vi.mocked(db.category.create).mockResolvedValue(categoryCreateResult({
      id: "cat-loser",
      name: "Lighting",
      parentId: null,
    }));
    transactionMock.mockImplementationOnce(
      async (fn: (tx: CategoryTxMock) => Promise<unknown>) => {
        await fn(categoryTx);
        throw serializableConflict();
      },
    );

    const res = await POST(makePostRequest({ name: "Lighting" }), noParams);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Category already exists in this level");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(db.category.create).toHaveBeenCalledTimes(1);
  });

  it("BUG: maps persistent serialization conflicts after one bounded retry", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    transactionMock
      .mockRejectedValueOnce(serializableConflict())
      .mockRejectedValueOnce(serializableConflict());

    const res = await POST(makePostRequest({ name: "Lighting" }), noParams);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Category changed at the same time; please try again");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(db.category.create).not.toHaveBeenCalled();
  });

  it("BUG: does not report creation success when the transactional audit write fails", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.create).mockResolvedValue(categoryCreateResult({
      id: "cat-new",
      name: "Lighting",
      parentId: null,
    }));
    vi.mocked(createAuditEntryTx).mockRejectedValueOnce(new Error("audit unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await POST(makePostRequest({ name: "Lighting" }), noParams);

    expect(res.status).toBe(500);
    expect(createAuditEntryTx).toHaveBeenCalledWith(categoryTx, expect.objectContaining({
      action: "created",
    }));
    consoleError.mockRestore();
  });

  it("returns 403 for STUDENT", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await POST(
      makePostRequest({ name: "Nope" }),
      noParams
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 for empty name", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await POST(
      makePostRequest({ name: "" }),
      noParams
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing name", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await POST(
      makePostRequest({}),
      noParams
    );

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/categories/[id]
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/categories/[id]", () => {
  it("renames a category with trimmed input", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([{
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    }]));
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    vi.mocked(db.category.update).mockResolvedValue(categoryUpdateResult({
      id: "cm123456789012345678901234",
      name: "Camera Bodies",
      parentId: null,
    }));

    const res = await PATCH(
      makePatchRequest({ name: "  Camera Bodies  " }),
      categoryParams
    );

    expect(res.status).toBe(200);
    expect(db.category.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cm123456789012345678901234" },
      data: { name: "Camera Bodies" },
    }));
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(categoryTx, expect.objectContaining({
      action: "updated",
    }));
  });

  it("renames a legacy overdeep category without revalidating unchanged placement", async () => {
    const id = "cm123456789012345678901234";
    const parentId = "cm234567890123456789012345";
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      { id, name: "Cameras", parentId },
      ...categoryParentChain(25),
    ]));
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    vi.mocked(db.category.update).mockResolvedValue(categoryUpdateResult({
      id,
      name: "Camera Bodies",
      parentId,
    }));

    const res = await PATCH(makePatchRequest({ name: "Camera Bodies" }), categoryParams);

    expect(res.status).toBe(200);
    expect(db.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: id },
        name: "Camera Bodies",
        parentId,
      },
    });
    expect(db.category.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "Camera Bodies" },
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(categoryTx, expect.objectContaining({
      before: { name: "Cameras", parentId },
      after: { name: "Camera Bodies", parentId },
    }));
  });

  it("still validates an explicitly supplied unchanged parent on a legacy overdeep category", async () => {
    const id = "cm123456789012345678901234";
    const parentId = "cm234567890123456789012345";
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      { id, name: "Cameras", parentId },
      ...categoryParentChain(25),
    ]));

    const res = await PATCH(makePatchRequest({ parentId }), categoryParams);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("25 parent-child edges");
    expect(db.category.update).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty patch body", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await PATCH(
      makePatchRequest({}),
      categoryParams
    );

    expect(res.status).toBe(400);
  });

  it("returns 409 when rename would duplicate a sibling", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([{
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    }]));
    vi.mocked(db.category.findFirst).mockResolvedValue(categoryFindFirstResult({
      id: "cm234567890123456789012345",
      name: "Lighting",
      parentId: null,
    }));

    const res = await PATCH(
      makePatchRequest({ name: "Lighting" }),
      categoryParams
    );

    expect(res.status).toBe(409);
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("returns 400 when moving a category under its descendant", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      {
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: null,
      },
      {
        id: "cm234567890123456789012345",
        name: "Camera Lenses",
        parentId: "cm123456789012345678901234",
      },
    ]));

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams
    );

    expect(res.status).toBe(400);
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("BUG: retries the whole move and rejects a parent chain made cyclic by the winning transaction", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany)
      .mockResolvedValueOnce(categoryFindManyResult([
        {
          id: "cm123456789012345678901234",
          name: "Cameras",
          parentId: null,
        },
        {
          id: "cm234567890123456789012345",
          name: "Lenses",
          parentId: null,
        },
      ]))
      .mockResolvedValueOnce(categoryFindManyResult([
        {
          id: "cm123456789012345678901234",
          name: "Cameras",
          parentId: null,
        },
        {
          id: "cm234567890123456789012345",
          name: "Lenses",
          parentId: "cm123456789012345678901234",
        },
      ]));
    vi.mocked(db.category.update).mockResolvedValue(categoryUpdateResult({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: "cm234567890123456789012345",
    }));
    transactionMock.mockImplementationOnce(
      async (fn: (tx: CategoryTxMock) => Promise<unknown>) => {
        await fn(categoryTx);
        throw serializableConflict();
      },
    );

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("subcategories");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(db.category.update).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-corrupt parent cycle without exhausting traversal", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      {
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: null,
      },
      {
        id: "cm234567890123456789012345",
        name: "Lenses",
        parentId: "cm345678901234567890123456",
      },
      {
        id: "cm345678901234567890123456",
        name: "Prime Lenses",
        parentId: "cm234567890123456789012345",
      },
    ]));

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams,
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("contains a cycle");
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("accepts moving a two-edge subtree when its resulting deepest path is exactly 25 edges", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      ...categoryParentChain(22),
      {
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: null,
      },
      { id: "subtree-child", name: "Lenses", parentId: "cm123456789012345678901234" },
      { id: "subtree-leaf", name: "Prime Lenses", parentId: "subtree-child" },
    ]));
    vi.mocked(db.category.update).mockResolvedValue(categoryUpdateResult({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: "cm234567890123456789012345",
    }));

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams,
    );

    expect(res.status).toBe(200);
    expect(db.category.findMany).toHaveBeenCalledOnce();
    expect(db.category.update).toHaveBeenCalledOnce();
  });

  it("rejects moving a two-edge subtree one edge beyond the whole-tree limit", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      ...categoryParentChain(23),
      {
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: null,
      },
      { id: "subtree-child", name: "Lenses", parentId: "cm123456789012345678901234" },
      { id: "subtree-leaf", name: "Prime Lenses", parentId: "subtree-child" },
    ]));

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("25 parent-child edges");
    expect(db.category.findMany).toHaveBeenCalledOnce();
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("rejects a proposed parent whose ancestry contains a missing link", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      {
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: null,
      },
      {
        id: "cm234567890123456789012345",
        name: "Lenses",
        parentId: "missing-ancestor",
      },
    ]));

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams,
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("parent chain is invalid");
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("maps a concurrent sibling uniqueness violation to a category conflict", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findMany).mockResolvedValue(categoryFindManyResult([
      {
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: "cm234567890123456789012345",
      },
      {
        id: "cm234567890123456789012345",
        name: "Equipment",
        parentId: null,
      },
    ]));
    vi.mocked(db.category.update).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await PATCH(makePatchRequest({ name: "Lighting" }), categoryParams);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Category already exists in this level");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/categories/[id]
// ═════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/categories/[id]", () => {
  it("deletes an unused leaf category", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findUnique).mockResolvedValue(categoryFindUniqueResult({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    }));
    vi.mocked(db.asset.count).mockResolvedValue(0);
    vi.mocked(db.bulkSku.count).mockResolvedValue(0);
    vi.mocked(db.category.count).mockResolvedValue(0);
    vi.mocked(db.category.delete).mockResolvedValue(categoryDeleteResult({}));

    const res = await DELETE(makeDeleteRequest(), categoryParams);

    expect(res.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(categoryTx, expect.objectContaining({
      action: "deleted",
    }));
  });

  it("BUG: retries deletion and preserves a category that gained a child", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findUnique).mockResolvedValue(categoryFindUniqueResult({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    }));
    vi.mocked(db.category.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    vi.mocked(db.category.delete).mockResolvedValue(categoryDeleteResult({}));
    transactionMock.mockImplementationOnce(
      async (fn: (tx: CategoryTxMock) => Promise<unknown>) => {
        await fn(categoryTx);
        throw serializableConflict();
      },
    );

    const res = await DELETE(makeDeleteRequest(), categoryParams);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("has subcategories");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(db.category.delete).toHaveBeenCalledTimes(1);
  });

  it("BUG: does not report deletion success when its transactional audit write fails", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findUnique).mockResolvedValue(categoryFindUniqueResult({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    }));
    vi.mocked(db.category.delete).mockResolvedValue(categoryDeleteResult({}));
    vi.mocked(createAuditEntryTx).mockRejectedValueOnce(new Error("audit unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await DELETE(makeDeleteRequest(), categoryParams);

    expect(res.status).toBe(500);
    expect(createAuditEntryTx).toHaveBeenCalledWith(categoryTx, expect.objectContaining({
      action: "deleted",
    }));
    consoleError.mockRestore();
  });
});
