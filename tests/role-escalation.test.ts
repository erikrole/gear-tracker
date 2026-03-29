import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
import { PATCH } from "@/app/api/users/[id]/role/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/users/target-1/role", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(db.user.update).mockResolvedValue({
    id: "target-1", role: "STAFF",
  } as any);
});

describe("PATCH /api/users/[id]/role", () => {
  it("ADMIN can change any role", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as any, avatarUrl: null,
    });
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "target-1", role: "STUDENT",
    } as any);

    const res = await PATCH(
      makeRequest({ role: "STAFF" }),
      { params: Promise.resolve({ id: "target-1" }) }
    );

    expect(res.status).toBe(200);
  });

  it("STAFF cannot grant ADMIN role", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "staff-1", email: "staff@test.com", name: "Staff", role: "STAFF" as any, avatarUrl: null,
    });
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "target-1", role: "STUDENT",
    } as any);

    const res = await PATCH(
      makeRequest({ role: "ADMIN" }),
      { params: Promise.resolve({ id: "target-1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("STAFF cannot revoke ADMIN role", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "staff-1", email: "staff@test.com", name: "Staff", role: "STAFF" as any, avatarUrl: null,
    });
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "target-1", role: "ADMIN",
    } as any);

    const res = await PATCH(
      makeRequest({ role: "STAFF" }),
      { params: Promise.resolve({ id: "target-1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("cannot change own role", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as any, avatarUrl: null,
    });
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "admin-1", role: "ADMIN",
    } as any);

    const res = await PATCH(
      makeRequest({ role: "STAFF" }),
      { params: Promise.resolve({ id: "admin-1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when target user not found", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as any, avatarUrl: null,
    });
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const res = await PATCH(
      makeRequest({ role: "STAFF" }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(res.status).toBe(404);
  });

  it("STUDENT cannot access role change endpoint", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "student-1", email: "stu@test.com", name: "Student", role: "STUDENT" as any, avatarUrl: null,
    });

    const res = await PATCH(
      makeRequest({ role: "STAFF" }),
      { params: Promise.resolve({ id: "target-1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("ADMIN can change STUDENT to ADMIN", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: "admin-1", email: "admin@test.com", name: "Admin", role: "ADMIN" as any, avatarUrl: null,
    });
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "target-1", role: "STUDENT",
    } as any);
    vi.mocked(db.user.update).mockResolvedValue({
      id: "target-1", role: "ADMIN",
    } as any);

    const res = await PATCH(
      makeRequest({ role: "ADMIN" }),
      { params: Promise.resolve({ id: "target-1" }) }
    );

    expect(res.status).toBe(200);
  });
});
