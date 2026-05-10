import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    badgeDefinition: {
      findMany: vi.fn(),
    },
    systemConfig: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as getBadgeCatalog } from "@/app/api/badges/route";
import { GET as getUserBadges } from "@/app/api/badges/user/[userId]/route";

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

function makeGetRequest(url = "https://app.example.com/api/badges") {
  return new Request(url, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BADGES_ENABLED = "true";
});

describe("GET /api/badges", () => {
  it("returns before badge queries when badges are disabled", async () => {
    process.env.BADGES_ENABLED = "false";
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getBadgeCatalog(makeGetRequest(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [], disabled: true });
    expect(db.badgeDefinition.findMany).not.toHaveBeenCalled();
  });

  it("returns active badge definitions", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.badgeDefinition.findMany).mockResolvedValue([
      {
        id: "definition-1",
        key: "first_checkout",
        name: "First Checkout",
        description: "Complete your first kiosk checkout.",
        icon: "PackageCheck",
        category: "CHECKOUT",
        kind: "COUNT",
        trigger: "checkout:opened",
        threshold: 1,
        ruleKey: null,
        active: true,
        sortOrder: 10,
        createdAt: new Date("2026-05-09T12:00:00.000Z"),
      } as any,
    ]);

    const res = await getBadgeCatalog(makeGetRequest(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        key: "first_checkout",
        active: true,
      }),
    ]);
    expect(db.badgeDefinition.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  });
});

describe("GET /api/badges/user/[userId]", () => {
  it("returns before badge profile queries when badges are disabled", async () => {
    process.env.BADGES_ENABLED = "false";
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getUserBadges(makeGetRequest("https://app.example.com/api/badges/user/student-1"), {
      params: Promise.resolve({ userId: "student-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      userId: "student-1",
      peerVisible: false,
      earnedCount: 0,
      totalCount: 0,
      badges: [],
      disabled: true,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.systemConfig.findUnique).not.toHaveBeenCalled();
    expect(db.badgeDefinition.findMany).not.toHaveBeenCalled();
  });

  it("returns active and historically earned inactive badges for visible users", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "student-1", role: "STUDENT", active: true } as any);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({ key: "badges.peerVisible", value: false } as any);
    vi.mocked(db.badgeDefinition.findMany).mockResolvedValue([
      {
        id: "definition-1",
        key: "first_checkout",
        name: "First Checkout",
        description: "Complete your first kiosk checkout.",
        icon: "PackageCheck",
        category: "CHECKOUT",
        kind: "COUNT",
        trigger: "checkout:opened",
        threshold: 1,
        ruleKey: null,
        active: true,
        sortOrder: 10,
        createdAt: new Date("2026-05-09T12:00:00.000Z"),
        awards: [{
          id: "award-1",
          awardedAt: new Date("2026-05-09T13:00:00.000Z"),
          source: "AUTO",
          note: null,
        }],
      },
      {
        id: "definition-2",
        key: "retired_badge",
        name: "Retired Badge",
        description: "Historical award.",
        icon: "Trophy",
        category: "MILESTONE",
        kind: "RULE",
        trigger: "manual",
        threshold: null,
        ruleKey: null,
        active: false,
        sortOrder: 20,
        createdAt: new Date("2026-05-09T12:00:00.000Z"),
        awards: [],
      },
    ] as any);

    const res = await getUserBadges(makeGetRequest("https://app.example.com/api/badges/user/student-1"), {
      params: Promise.resolve({ userId: "student-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.earnedCount).toBe(1);
    expect(body.data.totalCount).toBe(1);
    expect(body.data.badges[0]).toEqual(expect.objectContaining({
      key: "first_checkout",
      earned: true,
      awardedAt: "2026-05-09T13:00:00.000Z",
    }));
    expect(db.badgeDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { active: true },
          { awards: { some: { userId: "student-1" } } },
        ],
      },
      include: expect.objectContaining({
        awards: expect.objectContaining({
          where: { userId: "student-1" },
          take: 1,
        }),
      }),
    }));
  });

  it("blocks peer students when badge peer visibility is disabled", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ ...studentUser, id: "student-2" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "student-1", role: "STUDENT", active: true } as any);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({ key: "badges.peerVisible", value: false } as any);

    const res = await getUserBadges(makeGetRequest("https://app.example.com/api/badges/user/student-1"), {
      params: Promise.resolve({ userId: "student-1" }),
    });

    expect(res.status).toBe(403);
    expect(db.badgeDefinition.findMany).not.toHaveBeenCalled();
  });

  it("allows peer students when badge peer visibility is enabled", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ ...studentUser, id: "student-2" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "student-1", role: "STUDENT", active: true } as any);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.badgeDefinition.findMany).mockResolvedValue([]);

    const res = await getUserBadges(makeGetRequest("https://app.example.com/api/badges/user/student-1"), {
      params: Promise.resolve({ userId: "student-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.peerVisible).toBe(true);
  });

  it("returns badge profiles for staff users too", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "staff-1", role: "STAFF", active: true } as any);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({ key: "badges.peerVisible", value: false } as any);
    vi.mocked(db.badgeDefinition.findMany).mockResolvedValue([]);

    const res = await getUserBadges(makeGetRequest("https://app.example.com/api/badges/user/staff-1"), {
      params: Promise.resolve({ userId: "staff-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.userId).toBe("staff-1");
    expect(db.badgeDefinition.findMany).toHaveBeenCalled();
  });

  it("allows users to compare staff badges when peer visibility is enabled", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "staff-1", role: "STAFF", active: true } as any);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.badgeDefinition.findMany).mockResolvedValue([]);

    const res = await getUserBadges(makeGetRequest("https://app.example.com/api/badges/user/staff-1"), {
      params: Promise.resolve({ userId: "staff-1" }),
    });

    expect(res.status).toBe(200);
  });
});
