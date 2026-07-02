import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
    },
    bulkSku: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as getUsersExport } from "@/app/api/users/export/route";
import { GET as getUsersOrgChart } from "@/app/api/users/org-chart/route";
import { GET as getFormOptions } from "@/app/api/form-options/route";

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

const studentUser = {
  id: "student-1",
  email: "student@test.com",
  name: "Student",
  role: Role.STUDENT,
  avatarUrl: null,
};

const noParams = { params: Promise.resolve({}) };

function makeGetRequest(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function mockExportUsers() {
  vi.mocked(db.user.findMany).mockResolvedValue(users([
    {
      id: "admin-target",
      name: "Admin Target",
      role: Role.ADMIN,
      email: "admin-target@test.com",
      athleticsEmail: "admin-athletics@test.com",
      phone: "111-111-1111",
      title: "Director",
      gradYear: null,
      studentYearOverride: null,
      primaryArea: null,
      startDate: null,
      topSize: null,
      bottomSize: null,
      shoeSize: null,
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      location: null,
      sportAssignments: [],
      areaAssignments: [],
      directReport: null,
      directReportName: null,
    },
    {
      id: "staff-target",
      name: "Staff Target",
      role: Role.STAFF,
      email: "staff-target@test.com",
      athleticsEmail: "staff-athletics@test.com",
      phone: "222-222-2222",
      title: "Coordinator",
      gradYear: null,
      studentYearOverride: null,
      primaryArea: null,
      startDate: null,
      topSize: null,
      bottomSize: null,
      shoeSize: null,
      active: true,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      location: null,
      sportAssignments: [],
      areaAssignments: [],
      directReport: null,
      directReportName: null,
    },
    {
      id: "student-target",
      name: "Student Target",
      role: Role.STUDENT,
      email: "student-target@test.com",
      athleticsEmail: "student-athletics@test.com",
      phone: "333-333-3333",
      title: null,
      gradYear: 2027,
      studentYearOverride: null,
      primaryArea: null,
      startDate: null,
      topSize: null,
      bottomSize: null,
      shoeSize: null,
      active: true,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      location: null,
      sportAssignments: [],
      areaAssignments: [],
      directReport: null,
      directReportName: null,
    },
  ]));
}

function users(rows: unknown) {
  return rows as Awaited<ReturnType<typeof db.user.findMany>>;
}

beforeEach(() => {
  vi.mocked(db.location.findMany).mockResolvedValue([]);
  vi.mocked(db.department.findMany).mockResolvedValue([]);
  vi.mocked(db.bulkSku.findMany).mockResolvedValue([]);
});

describe("user PII scope hardening", () => {
  it("redacts staff and admin sensitive contact fields from STAFF user exports", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    mockExportUsers();

    const res = await getUsersExport(makeGetRequest("/api/users/export"), noParams);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain("admin-athletics@test.com");
    expect(body).not.toContain("111-111-1111");
    expect(body).not.toContain("staff-athletics@test.com");
    expect(body).not.toContain("222-222-2222");
    expect(body).toContain("student-athletics@test.com");
    expect(body).toContain("333-333-3333");
  });

  it("keeps full sensitive contact fields in ADMIN user exports", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    mockExportUsers();

    const res = await getUsersExport(makeGetRequest("/api/users/export"), noParams);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("admin-athletics@test.com");
    expect(body).toContain("111-111-1111");
    expect(body).toContain("staff-athletics@test.com");
    expect(body).toContain("222-222-2222");
  });

  it("blocks org chart reporting hierarchy from STUDENT callers", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getUsersOrgChart(makeGetRequest("/api/users/org-chart"), noParams);

    expect(res.status).toBe(403);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("limits form-options user directory to self for STUDENT callers", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.user.findMany).mockResolvedValue(users([
      { id: "student-1", name: "Student", avatarUrl: null },
    ]));

    const res = await getFormOptions(makeGetRequest("/api/form-options"), noParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { hiddenFromRoster: false },
            { id: "student-1", active: true },
          ],
        },
        select: { id: true, name: true, avatarUrl: true },
      }),
    );
    expect(body.data.users).toEqual([{ id: "student-1", name: "Student", avatarUrl: null }]);
  });
});
