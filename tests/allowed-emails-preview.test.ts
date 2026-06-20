import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    allowedEmail: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { POST } from "@/app/api/allowed-emails/preview/route";

const adminUser = {
  id: "admin-1",
  email: "admin@test.com",
  name: "Admin",
  role: Role.ADMIN,
  avatarUrl: null,
};

const staffUser = {
  id: "staff-1",
  email: "staff@test.com",
  name: "Staff",
  role: Role.STAFF,
  avatarUrl: null,
};

function allowedEmails(rows: unknown) {
  return rows as Awaited<ReturnType<typeof db.allowedEmail.findMany>>;
}

function users(rows: unknown) {
  return rows as Awaited<ReturnType<typeof db.user.findMany>>;
}

function makePreviewRequest(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/allowed-emails/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/allowed-emails/preview", () => {
  it("returns account-status preview rows for authorized admins", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.allowedEmail.findMany).mockResolvedValue(allowedEmails([
      { email: "pending@uw.edu", role: Role.STUDENT, claimedAt: null },
    ]));
    vi.mocked(db.user.findMany).mockResolvedValue(users([
      { email: "existing@uw.edu", role: Role.STAFF },
    ]));

    const response = await POST(
      makePreviewRequest({
        emails: [
          { email: "ready@uw.edu", role: "STUDENT" },
          { email: "pending@uw.edu", role: "STUDENT" },
          { email: "existing@uw.edu", role: "STAFF" },
        ],
      }),
      noParams,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toEqual({
      ready: 1,
      duplicate: 0,
      existing_user: 1,
      pending_invite: 1,
      claimed_invite: 0,
    });
    expect(body.rows.map((row: { status: string }) => row.status)).toEqual([
      "ready",
      "pending_invite",
      "existing_user",
    ]);
  });

  it("blocks staff preview requests for staff-role invitations", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const response = await POST(
      makePreviewRequest({
        emails: [{ email: "staff2@uw.edu", role: "STAFF" }],
      }),
      noParams,
    );

    expect(response.status).toBe(403);
    expect(db.allowedEmail.findMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});
