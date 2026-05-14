import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/services/bookings-helpers", () => ({
  upsertBulkBalancesAndMovements: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { GET } from "@/app/api/users/route";
import { PATCH } from "@/app/api/users/[id]/route";

const adminUser = {
  id: "cm000000000000000000000001",
  email: "admin@test.com",
  name: "Admin",
  role: "ADMIN" as const,
  avatarUrl: null,
};

const targetId = "cm000000000000000000000002";
const managerId = "cm000000000000000000000003";

function patchRequest(body: Record<string, unknown>) {
  return new Request(`https://app.example.com/api/users/${targetId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function routeParams(id = targetId) {
  return { params: Promise.resolve({ id }) };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: targetId,
    name: "Student One",
    email: "student@test.com",
    role: "STUDENT",
    locationId: null,
    location: null,
    phone: null,
    slackHandle: null,
    slackProfileUrl: null,
    primaryArea: null,
    avatarUrl: null,
    active: true,
    lastActiveAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    sportAssignments: [],
    areaAssignments: [],
    title: null,
    athleticsEmail: null,
    startDate: null,
    directReportId: null,
    directReportName: null,
    directReport: null,
    gradYear: 2027,
    studentYearOverride: null,
    topSize: null,
    bottomSize: null,
    shoeSize: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
  vi.mocked(db.user.findMany).mockResolvedValue([]);
  vi.mocked(db.user.count).mockResolvedValue(0);
  vi.mocked(db.user.groupBy).mockResolvedValue([]);
  vi.mocked(db.user.update).mockResolvedValue(makeUser({ directReportId: managerId }) as any);
});

describe("GET /api/users", () => {
  it("returns lastActiveAt and supports last-active sorting", async () => {
    const lastActiveAt = new Date("2026-05-13T14:00:00.000Z");
    vi.mocked(db.user.findMany).mockResolvedValue([
      makeUser({
        id: targetId,
        name: "Student One",
        lastActiveAt,
        location: { id: "loc-1", name: "Camp Randall" },
      }) as any,
    ]);
    vi.mocked(db.user.count).mockResolvedValue(1);
    vi.mocked(db.user.groupBy).mockResolvedValue([
      { role: "STUDENT", _count: { _all: 1 } },
    ] as any);

    const res = await GET(
      new Request("https://app.example.com/api/users?sort=lastActive_desc"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { lastActiveAt: { sort: "desc", nulls: "last" } },
          { name: "asc" },
        ],
      }),
    );
    expect(body.data[0].lastActiveAt).toBe("2026-05-13T14:00:00.000Z");
  });
});

describe("PATCH /api/users/[id]", () => {
  it("saves a linked direct report when the reporting chain is valid", async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce(makeUser() as any)
      .mockResolvedValueOnce({ id: managerId, directReportId: null } as any);

    const res = await PATCH(
      patchRequest({ directReportId: managerId }),
      routeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetId },
        data: {
          directReportId: managerId,
          directReportName: null,
        },
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        before: expect.objectContaining({ directReportId: null }),
        after: expect.objectContaining({ directReportId: managerId }),
      }),
    );
    expect(body.data.directReportId).toBe(managerId);
  });

  it("rejects a missing linked direct report before updating the user", async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce(makeUser() as any)
      .mockResolvedValueOnce(null);

    const res = await PATCH(
      patchRequest({ directReportId: managerId }),
      routeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Direct report user not found");
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects direct-report cycles before updating the user", async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce(makeUser() as any)
      .mockResolvedValueOnce({ id: managerId, directReportId: targetId } as any);

    const res = await PATCH(
      patchRequest({ directReportId: managerId }),
      routeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("reporting cycle");
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
