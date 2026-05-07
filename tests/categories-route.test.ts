import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// ─── Mock modules ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    bulkSku: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/categories/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/categories/[id]/route";

beforeEach(() => {
  vi.clearAllMocks();
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

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/categories
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/categories", () => {
  it("returns categories with item counts for any authenticated user", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: "cat-1", name: "Cameras", parentId: null },
      { id: "cat-2", name: "Tripods", parentId: null },
    ] as any);
    vi.mocked(db.asset.groupBy).mockResolvedValue([
      { categoryId: "cat-1", _count: { id: 5 } },
    ] as any);
    vi.mocked(db.bulkSku.groupBy).mockResolvedValue([
      { categoryId: "cat-1", _count: { id: 3 } },
      { categoryId: "cat-2", _count: { id: 2 } },
    ] as any);

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // cat-1 has 5 assets + 3 bulk = 8
    expect(body.data.find((c: any) => c.id === "cat-1").itemCount).toBe(8);
    // cat-2 has 0 assets + 2 bulk = 2
    expect(body.data.find((c: any) => c.id === "cat-2").itemCount).toBe(2);
  });

  it("returns zero counts when no items exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: "cat-1", name: "Empty Category", parentId: null },
    ] as any);
    vi.mocked(db.asset.groupBy).mockResolvedValue([] as any);
    vi.mocked(db.bulkSku.groupBy).mockResolvedValue([] as any);

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
    vi.mocked(db.category.create).mockResolvedValue({
      id: "cat-new",
      name: "Lighting",
      parentId: null,
    } as any);

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
  });

  it("creates a child category with valid parentId", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cm123456789012345678901234",
      name: "Equipment",
    } as any);
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    vi.mocked(db.category.create).mockResolvedValue({
      id: "cm234567890123456789012345",
      name: "Lenses",
      parentId: "cm123456789012345678901234",
    } as any);

    const res = await POST(
      makePostRequest({ name: "Lenses", parentId: "cm123456789012345678901234" }),
      noParams
    );

    expect(res.status).toBe(201);
  });

  it("returns 404 when parentId does not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findUnique).mockResolvedValue(null);

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
    vi.mocked(db.category.findFirst).mockResolvedValue({
      id: "cat-existing",
      name: "Lighting",
      parentId: null,
    } as any);

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
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    } as any);
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    vi.mocked(db.category.update).mockResolvedValue({
      id: "cm123456789012345678901234",
      name: "Camera Bodies",
      parentId: null,
    } as any);

    const res = await PATCH(
      makePatchRequest({ name: "  Camera Bodies  " }),
      categoryParams
    );

    expect(res.status).toBe(200);
    expect(db.category.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cm123456789012345678901234" },
      data: { name: "Camera Bodies" },
    }));
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
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    } as any);
    vi.mocked(db.category.findFirst).mockResolvedValue({
      id: "cm234567890123456789012345",
      name: "Lighting",
      parentId: null,
    } as any);

    const res = await PATCH(
      makePatchRequest({ name: "Lighting" }),
      categoryParams
    );

    expect(res.status).toBe(409);
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("returns 400 when moving a category under its descendant", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.category.findUnique)
      .mockResolvedValueOnce({
        id: "cm123456789012345678901234",
        name: "Cameras",
        parentId: null,
      } as any)
      .mockResolvedValueOnce({
        id: "cm234567890123456789012345",
        parentId: "cm123456789012345678901234",
      } as any);

    const res = await PATCH(
      makePatchRequest({ parentId: "cm234567890123456789012345" }),
      categoryParams
    );

    expect(res.status).toBe(400);
    expect(db.category.update).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/categories/[id]
// ═════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/categories/[id]", () => {
  it("deletes an unused leaf category", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cm123456789012345678901234",
      name: "Cameras",
      parentId: null,
    } as any);
    vi.mocked(db.asset.count).mockResolvedValue(0);
    vi.mocked(db.bulkSku.count).mockResolvedValue(0);
    vi.mocked(db.category.count).mockResolvedValue(0);
    vi.mocked(db.category.delete).mockResolvedValue({} as any);

    const res = await DELETE(makeDeleteRequest(), categoryParams);

    expect(res.status).toBe(200);
  });
});
