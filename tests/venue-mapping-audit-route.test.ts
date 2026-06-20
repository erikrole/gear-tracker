import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  location: {
    findMany: vi.fn(),
  },
  locationMapping: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET } from "@/app/api/location-mappings/audit/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: Role.ADMIN,
  avatarUrl: null,
};

const staffUser = {
  ...adminUser,
  id: "staff-1",
  email: "staff@example.com",
  role: Role.STAFF,
};

function request() {
  return new Request("https://app.example.com/api/location-mappings/audit", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

describe("GET /api/location-mappings/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.location.findMany).mockResolvedValue([
      {
        id: "loc-camp",
        name: "Camp Randall Stadium",
        active: true,
        isHomeVenue: true,
      },
      {
        id: "loc-fieldhouse",
        name: "UW Field House",
        active: true,
        isHomeVenue: true,
      },
    ] as never);
    vi.mocked(db.locationMapping.findMany).mockResolvedValue([
      {
        id: "map-camp",
        pattern: "Camp Randall",
        locationId: "loc-camp",
        location: {
          id: "loc-camp",
          name: "Camp Randall Stadium",
          active: true,
          isHomeVenue: true,
        },
      },
    ] as never);
  });

  it("returns venue mapping audit diagnostics for admins", async () => {
    const res = await GET(request(), { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.issueCount).toBe(1);
    expect(json.data.homeVenuesWithoutMappings).toEqual([
      {
        id: "loc-fieldhouse",
        name: "UW Field House",
        active: true,
        isHomeVenue: true,
      },
    ]);
    expect(db.location.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        active: true,
        isHomeVenue: true,
      },
      orderBy: { name: "asc" },
    });
  });

  it("rejects non-admin users", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await GET(request(), { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
    expect(db.location.findMany).not.toHaveBeenCalled();
    expect(db.locationMapping.findMany).not.toHaveBeenCalled();
  });
});
