import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/badges/queries", () => ({
  awardBadgeManually: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { awardBadgeManually } from "@/lib/badges/queries";
import { POST } from "@/app/api/badges/award/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN" as const,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student",
  role: "STUDENT" as const,
  avatarUrl: null,
};

function makePostRequest(body: unknown) {
  return new Request("https://app.example.com/api/badges/award", {
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
  process.env.BADGES_ENABLED = "true";
});

describe("POST /api/badges/award", () => {
  it("returns before manual award service work when badges are disabled", async () => {
    process.env.BADGES_ENABLED = "false";
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await POST(makePostRequest({
      userId: "cmstudent000000000000001",
      definitionId: "cmbadge000000000000001",
    }), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Badges are disabled");
    expect(awardBadgeManually).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await POST(makePostRequest({
      userId: "cmstudent000000000000001",
      definitionId: "cmbadge000000000000001",
    }), { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
    expect(awardBadgeManually).not.toHaveBeenCalled();
  });

  it("creates a manual award and audit entry", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(awardBadgeManually).mockResolvedValue({
      id: "cmaward000000000000001",
      userId: "cmstudent000000000000001",
      definitionId: "cmbadge000000000000001",
      awardedAt: new Date("2026-05-09T20:00:00.000Z"),
      source: "MANUAL",
      note: "Staff pick",
      definition: {
        id: "cmbadge000000000000001",
        key: "first_trade",
        name: "Team Player",
        description: "Complete a shift trade.",
        icon: "Handshake",
        category: "TRADE",
      },
    } as any);

    const res = await POST(makePostRequest({
      userId: "cmstudent000000000000001",
      definitionId: "cmbadge000000000000001",
      note: "Staff pick",
    }), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toEqual(expect.objectContaining({
      id: "cmaward000000000000001",
      source: "MANUAL",
      note: "Staff pick",
    }));
    expect(awardBadgeManually).toHaveBeenCalledWith({
      userId: "cmstudent000000000000001",
      definitionId: "cmbadge000000000000001",
      customDefinition: undefined,
      awardedById: "admin-1",
      note: "Staff pick",
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      entityType: "badge_award",
      action: "badge_awarded_manually",
    }));
  });

  it("creates and awards a custom manual badge", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(awardBadgeManually).mockResolvedValue({
      id: "cmaward000000000000002",
      userId: "cmstaff000000000000001",
      definitionId: "cmbadge000000000000002",
      awardedAt: new Date("2026-05-12T20:00:00.000Z"),
      source: "MANUAL",
      note: "Testing cohort",
      definition: {
        id: "cmbadge000000000000002",
        key: "custom_guinea_pig",
        name: "Guinea Pig",
        description: "Signed up early to help test the app.",
        icon: "Trophy",
        category: "MILESTONE",
      },
    } as any);

    const res = await POST(makePostRequest({
      userId: "cmstaff000000000000001",
      customDefinition: {
        name: "Guinea Pig",
        description: "Signed up early to help test the app.",
        icon: "Trophy",
      },
      note: "Testing cohort",
    }), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.definition.key).toBe("custom_guinea_pig");
    expect(awardBadgeManually).toHaveBeenCalledWith({
      userId: "cmstaff000000000000001",
      definitionId: undefined,
      customDefinition: {
        name: "Guinea Pig",
        description: "Signed up early to help test the app.",
        icon: "Trophy",
      },
      awardedById: "admin-1",
      note: "Testing cohort",
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      after: expect.objectContaining({
        definitionId: "cmbadge000000000000002",
        badgeKey: "custom_guinea_pig",
      }),
    }));
  });
});
