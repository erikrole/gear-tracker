import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  locationMapping: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
  SETTINGS_MUTATION_LIMIT: { max: 10, windowMs: 60_000 },
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { GET, POST } from "@/app/api/location-mappings/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: Role.ADMIN,
  avatarUrl: null,
  forcePasswordChange: false,
};

const staffUser = {
  ...adminUser,
  id: "staff-1",
  email: "staff@example.com",
  role: Role.STAFF,
};

function getRequest() {
  return new Request("https://app.example.com/api/location-mappings", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function postRequest(body: unknown) {
  return new Request("https://app.example.com/api/location-mappings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/location-mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.locationMapping.findMany).mockResolvedValue([] as never);
    vi.mocked(db.locationMapping.create).mockResolvedValue({
      id: "map-created",
      pattern: "Camp Randall",
      locationId: "cjld2cjxh0000qzrmn831i7rn",
      priority: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      location: { id: "cjld2cjxh0000qzrmn831i7rn", name: "Camp Randall Stadium" },
    } as never);
    vi.mocked(createAuditEntry).mockResolvedValue(undefined);
    vi.mocked(enforceRateLimit).mockResolvedValue(undefined as never);
  });

  it("rejects non-admin reads", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await GET(getRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
    expect(db.locationMapping.findMany).not.toHaveBeenCalled();
  });

  it("sorts reads by priority, then longest pattern", async () => {
    vi.mocked(db.locationMapping.findMany).mockResolvedValue([
      {
        id: "short",
        pattern: "Camp",
        locationId: "loc-1",
        priority: 5,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        location: { id: "loc-1", name: "Camp" },
      },
      {
        id: "long",
        pattern: "Camp Randall",
        locationId: "loc-2",
        priority: 5,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        location: { id: "loc-2", name: "Camp Randall Stadium" },
      },
      {
        id: "low",
        pattern: "Field House",
        locationId: "loc-3",
        priority: 1,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        location: { id: "loc-3", name: "UW Field House" },
      },
    ] as never);

    const res = await GET(getRequest(), { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.map((mapping: { id: string }) => mapping.id)).toEqual(["long", "short", "low"]);
    expect(db.locationMapping.findMany).toHaveBeenCalledWith({
      include: { location: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });

  it("rejects invalid regex patterns before create", async () => {
    const res = await POST(postRequest({
      pattern: "Field (north",
      locationId: "cjld2cjxh0000qzrmn831i7rn",
      priority: 0,
    }), { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details).toContain("pattern: Pattern must be a valid regular expression");
    expect(db.locationMapping.create).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("trims and creates valid regex patterns", async () => {
    const res = await POST(postRequest({
      pattern: "  Camp Randall  ",
      locationId: "cjld2cjxh0000qzrmn831i7rn",
      priority: 2,
    }), { params: Promise.resolve({}) });

    expect(res.status).toBe(201);
    expect(db.locationMapping.create).toHaveBeenCalledWith({
      data: {
        pattern: "Camp Randall",
        locationId: "cjld2cjxh0000qzrmn831i7rn",
        priority: 2,
      },
      include: { location: { select: { id: true, name: true } } },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "create",
      after: { pattern: "Camp Randall", locationId: "cjld2cjxh0000qzrmn831i7rn" },
    }));
  });
});
