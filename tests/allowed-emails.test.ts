import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    allowedEmail: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntries: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/allowed-emails/route";
import { DELETE } from "@/app/api/allowed-emails/[id]/route";

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

function makeGetRequest(query = "") {
  return new Request(`https://app.example.com/api/allowed-emails${query}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/allowed-emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new Request("https://app.example.com/api/allowed-emails/entry-1", {
    method: "DELETE",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
  });
}

const noParams = { params: Promise.resolve({}) };

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/allowed-emails
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/allowed-emails", () => {
  it("returns paginated allowed emails for ADMIN", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findMany).mockResolvedValue([
      { id: "e-1", email: "stu@uw.edu", role: "STUDENT", claimedAt: null } as any,
    ]);
    vi.mocked(db.allowedEmail.count).mockResolvedValue(1);

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("filters by search query", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findMany).mockResolvedValue([]);
    vi.mocked(db.allowedEmail.count).mockResolvedValue(0);

    await GET(makeGetRequest("?q=test"), noParams);

    expect(db.allowedEmail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { contains: "test", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by claimed status", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findMany).mockResolvedValue([]);
    vi.mocked(db.allowedEmail.count).mockResolvedValue(0);

    await GET(makeGetRequest("?status=unclaimed"), noParams);

    expect(db.allowedEmail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          claimedAt: null,
        }),
      })
    );
  });

  it("returns 403 for STUDENT", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/allowed-emails (single)
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/allowed-emails (single)", () => {
  it("creates a single allowed email entry", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.allowedEmail.create).mockResolvedValue({
      id: "e-1",
      email: "new@uw.edu",
      role: "STUDENT",
    } as any);

    const res = await POST(
      makePostRequest({ email: "New@UW.edu", role: "STUDENT" }),
      noParams
    );

    expect(res.status).toBe(201);
    // Verify email is lowercased
    expect(db.allowedEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@uw.edu",
        }),
      })
    );
  });

  it("returns 409 when user with email is already registered", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "existing-user" } as any);

    const res = await POST(
      makePostRequest({ email: "existing@uw.edu", role: "STUDENT" }),
      noParams
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already registered");
  });

  it("STAFF cannot add STAFF-role entries", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await POST(
      makePostRequest({ email: "staff2@uw.edu", role: "STAFF" }),
      noParams
    );

    expect(res.status).toBe(403);
  });

  it("ADMIN can add STAFF-role entries", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.allowedEmail.create).mockResolvedValue({
      id: "e-1",
      email: "staff2@uw.edu",
      role: "STAFF",
    } as any);

    const res = await POST(
      makePostRequest({ email: "staff2@uw.edu", role: "STAFF" }),
      noParams
    );

    expect(res.status).toBe(201);
  });

  it("returns 403 for STUDENT", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await POST(
      makePostRequest({ email: "any@uw.edu", role: "STUDENT" }),
      noParams
    );

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/allowed-emails (bulk)
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/allowed-emails (bulk)", () => {
  it("creates multiple allowed email entries and reports skipped ones", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findMany).mockResolvedValue([
      { email: "existing@uw.edu" } as any,
    ]);
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    vi.mocked(db.allowedEmail.createMany).mockResolvedValue({ count: 1 } as any);
    // After createMany, fetch the created records
    vi.mocked(db.allowedEmail.findMany).mockResolvedValueOnce([
      { email: "existing@uw.edu" } as any,
    ]).mockResolvedValueOnce([
      { id: "e-1", email: "new@uw.edu", role: "STUDENT" } as any,
    ]);

    const res = await POST(
      makePostRequest({
        emails: [
          { email: "New@UW.edu", role: "STUDENT" },
          { email: "Existing@UW.edu", role: "STUDENT" },
        ],
      }),
      noParams
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.skipped).toContain("existing@uw.edu");
  });

  it("STAFF cannot bulk-add STAFF-role entries", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await POST(
      makePostRequest({
        emails: [
          { email: "staff2@uw.edu", role: "STAFF" },
          { email: "student@uw.edu", role: "STUDENT" },
        ],
      }),
      noParams
    );

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/allowed-emails/[id]
// ═════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/allowed-emails/[id]", () => {
  it("deletes an unclaimed entry", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue({
      id: "entry-1",
      email: "del@uw.edu",
      role: "STUDENT",
      claimedAt: null,
    } as any);
    vi.mocked(db.allowedEmail.deleteMany).mockResolvedValue({ count: 1 });

    const res = await DELETE(
      makeDeleteRequest(),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 when entry not found", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue(null);

    const res = await DELETE(
      makeDeleteRequest(),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when entry is already claimed", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue({
      id: "entry-1",
      email: "claimed@uw.edu",
      role: "STUDENT",
      claimedAt: new Date(),
    } as any);

    const res = await DELETE(
      makeDeleteRequest(),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("claimed");
  });

  it("handles race condition where entry becomes claimed between check and delete", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue({
      id: "entry-1",
      email: "race@uw.edu",
      role: "STUDENT",
      claimedAt: null,
    } as any);
    // deleteMany returns 0 because the entry was claimed between findUnique and deleteMany
    vi.mocked(db.allowedEmail.deleteMany).mockResolvedValue({ count: 0 });

    const res = await DELETE(
      makeDeleteRequest(),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("just claimed");
  });

  it("returns 403 for STUDENT", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await DELETE(
      makeDeleteRequest(),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(403);
  });
});
