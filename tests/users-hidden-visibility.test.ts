import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Role, ShiftWorkerType, type User } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  user: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
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
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireKiosk: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { requireAuth, requireKiosk } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewHiddenUsers, visibleUserWhere } from "@/lib/user-visibility";
import { GET as getMe } from "@/app/api/me/route";
import { GET as getUsers } from "@/app/api/users/route";
import { GET as exportUsers } from "@/app/api/users/export/route";
import { GET as getUserById } from "@/app/api/users/[id]/route";
import { GET as getFormOptions } from "@/app/api/form-options/route";
import { GET as getKioskUsers } from "@/app/api/kiosk/users/route";

const operator = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

const internalOperator = {
  ...operator,
  email: "owner@example.com",
};

function getReq(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Visible User",
    email: "visible@example.com",
    passwordHash: "hash",
    forcePasswordChange: false,
    role: Role.STUDENT,
    staffingType: ShiftWorkerType.ST,
    phone: null,
    slackHandle: null,
    slackProfileUrl: null,
    primaryArea: null,
    locationId: null,
    avatarUrl: null,
    active: true,
    hiddenFromRoster: false,
    title: null,
    gradYear: null,
    studentYearOverride: null,
    lastActiveAt: null,
    createdAt: new Date("2026-06-24T12:00:00.000Z"),
    updatedAt: new Date("2026-06-24T12:00:00.000Z"),
    notificationPrefs: null,
    athleticsEmail: null,
    startDate: null,
    directReportId: null,
    directReportName: null,
    topSize: null,
    bottomSize: null,
    shoeSize: null,
    wiscardNumber: null,
    icsToken: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.INTERNAL_OPERATOR_EMAILS;
  vi.mocked(requireAuth).mockResolvedValue(operator);
  vi.mocked(requireKiosk).mockResolvedValue({
    kioskId: "kiosk-1",
    name: "Counter iPad",
    locationId: "loc-1",
    locationName: "Camp Randall",
  });
  vi.mocked(db.user.count).mockResolvedValue(0);
  vi.mocked(db.user.findMany).mockResolvedValue([]);
  vi.mocked(db.user.findUnique).mockResolvedValue(null);
  vi.mocked(db.user.groupBy).mockResolvedValue([]);
  vi.mocked(db.location.findMany).mockResolvedValue([]);
  vi.mocked(db.department.findMany).mockResolvedValue([]);
  vi.mocked(db.bulkSku.findMany).mockResolvedValue([]);
});

describe("hidden smoke user visibility", () => {
  it("keeps hidden users out of default user lists and stats", async () => {
    const res = await getUsers(getReq("/api/users"), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ hiddenFromRoster: false }]),
        }),
      }),
    );
    expect(db.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ hiddenFromRoster: false }]),
        }),
      }),
    );
  });

  it("ignores includeHidden unless the actor is an internal operator", async () => {
    await getUsers(getReq("/api/users?includeHidden=1"), { params: Promise.resolve({}) });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ hiddenFromRoster: false }]),
        }),
      }),
    );
  });

  it("allows configured internal operators to opt into hidden users", async () => {
    process.env.INTERNAL_OPERATOR_EMAILS = "owner@example.com";
    vi.mocked(requireAuth).mockResolvedValue(internalOperator);

    await getUsers(getReq("/api/users?includeHidden=1"), { params: Promise.resolve({}) });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          AND: expect.arrayContaining([{ hiddenFromRoster: false }]),
        }),
      }),
    );
  });

  it("keeps hidden users out of staff exports by default", async () => {
    await exportUsers(getReq("/api/users/export"), { params: Promise.resolve({}) });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ hiddenFromRoster: false }]),
        }),
      }),
    );
  });

  it("hides hidden profiles from non-internal operators", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(makeUser({ id: "hidden-1", hiddenFromRoster: true }));

    const res = await getUserById(getReq("/api/users/hidden-1"), {
      params: Promise.resolve({ id: "hidden-1" }),
    });

    expect(res.status).toBe(404);
  });

  it("lets a hidden user read their own profile", async () => {
    const hiddenSelf = { ...operator, id: "hidden-1" };
    vi.mocked(requireAuth).mockResolvedValue(hiddenSelf);
    vi.mocked(db.user.findUnique).mockResolvedValue(makeUser({ id: "hidden-1", hiddenFromRoster: true }));

    const res = await getUserById(getReq("/api/users/hidden-1"), {
      params: Promise.resolve({ id: "hidden-1" }),
    });

    expect(res.status).toBe(200);
  });

  it("keeps hidden users out of form-option people pickers", async () => {
    await getFormOptions(getReq("/api/form-options"), { params: Promise.resolve({}) });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { hiddenFromRoster: false },
            { active: true },
          ],
        },
      }),
    );
  });

  it("keeps hidden users out of kiosk student selection", async () => {
    await getKioskUsers(getReq("/api/kiosk/users"), { params: Promise.resolve({}) });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          hiddenFromRoster: false,
        }),
      }),
    );
  });

  it("only trusts comma-separated internal operator emails for hidden access", () => {
    process.env.INTERNAL_OPERATOR_EMAILS = "owner@example.com, other@example.com";

    expect(canViewHiddenUsers({ email: "OWNER@example.com" })).toBe(true);
    expect(canViewHiddenUsers({ email: "staff@example.com" })).toBe(false);
    expect(visibleUserWhere({ email: "staff@example.com" })).toEqual({ hiddenFromRoster: false });
  });

  it("surfaces the hidden-user capability from /api/me", async () => {
    process.env.INTERNAL_OPERATOR_EMAILS = "owner@example.com";
    vi.mocked(requireAuth).mockResolvedValue(internalOperator);

    const res = await getMe(getReq("/api/me"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.canViewHiddenUsers).toBe(true);
  });

  it("keeps /users hidden-user opt-in behind the /api/me capability", () => {
    const pageSource = readFileSync("src/app/(app)/users/page.tsx", "utf8");
    const filtersSource = readFileSync("src/app/(app)/users/UserFilters.tsx", "utf8");

    expect(pageSource).toContain("canViewHiddenUsers");
    expect(pageSource).toContain('params.set("includeHidden", "1")');
    expect(pageSource).toContain("canShowHiddenUsers && showHiddenUsers");
    expect(filtersSource).toContain("canShowHiddenUsers");
    expect(filtersSource).toContain("Show hidden test users");
  });
});
