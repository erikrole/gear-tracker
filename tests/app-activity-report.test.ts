import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import { GET as getAppActivity } from "@/app/api/settings/app-activity/route";
import { getAppActivityReport } from "@/lib/services/app-activity-report";

const owner = {
  id: "owner-1",
  name: "Owner",
  email: "owner@example.com",
  role: Role.ADMIN,
  forcePasswordChange: false,
  avatarUrl: null,
  affiliation: null,
  collaboratorProfile: null,
  staffingType: undefined,
  capabilities: [],
  collaboratorPolicy: null,
};

const openedAt = new Date("2026-08-20T15:00:00.000Z");
const staleSeenAt = new Date("2026-08-20T16:00:00.000Z");
const latestSeenAt = new Date("2026-08-21T15:00:00.000Z");

function request() {
  return new Request("https://app.example.com/api/settings/app-activity", {
    headers: { origin: "https://app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.USAGE_ANALYTICS_OWNER_EMAILS = "owner@example.com";
  process.env.USAGE_ANALYTICS_HASH_SECRET = "a-private-test-secret-with-more-than-32-characters";
  process.env.IOS_LATEST_APP_VERSION = "1.0";
  process.env.IOS_LATEST_APP_BUILD = "27";
  vi.mocked(requireAuth).mockResolvedValue(owner);
  dbMock.user.findMany.mockResolvedValue([
    {
      name: "Erik Role",
      email: "erik@example.com",
      role: Role.ADMIN,
      active: true,
      appInstallations: [
        {
          platform: "ios",
          appVersion: "1.0",
          appBuild: "26",
          osVersion: "26.0",
          deviceModel: "iPhone17,1",
          releaseChannel: "testflight",
          firstSeenAt: new Date("2026-08-01T15:00:00.000Z"),
          lastSeenAt: staleSeenAt,
          lastOpenedAt: openedAt,
        },
      ],
    },
    {
      name: "Sam Never Opened",
      email: "sam@example.com",
      role: Role.STUDENT,
      active: true,
      appInstallations: [],
    },
    {
      name: "Taylor Store",
      email: "taylor@example.com",
      role: Role.STAFF,
      active: false,
      appInstallations: [
        {
          platform: "ios",
          appVersion: "1.0",
          appBuild: "27",
          osVersion: "18.6",
          deviceModel: "iPhone15,2",
          releaseChannel: "app_store",
          firstSeenAt: new Date("2026-07-20T15:00:00.000Z"),
          lastSeenAt: latestSeenAt,
          lastOpenedAt: latestSeenAt,
        },
      ],
    },
  ]);
});

describe("owner app activity report", () => {
  it("joins named roster users to client identity and build status", async () => {
    const report = await getAppActivityReport();

    expect(dbMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { hiddenFromRoster: false },
      select: expect.objectContaining({ appInstallations: expect.any(Object) }),
    }));
    expect(report.latestIosBuild).toEqual({ version: "1.0", build: "27" });
    expect(report.summary).toMatchObject({
      totalUsers: 3,
      usedUsers: 2,
      neverUsedUsers: 1,
      iosUsers: 2,
      iosInstallations: 2,
      staleIosInstallations: 1,
      latestIosInstallations: 1,
      testflightInstallations: 1,
      appStoreInstallations: 1,
    });

    const erik = report.users.find((user) => user.email === "erik@example.com");
    expect(erik).toMatchObject({ used: true, lastUsedAt: openedAt.toISOString() });
    expect(erik?.clients[0]).toMatchObject({
      deviceModel: "iPhone17,1",
      appBuild: "26",
      buildStatus: "stale",
      releaseChannel: "testflight",
    });
  });

  it("allows the report only to the configured owner", async () => {
    const response = await getAppActivity(request(), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    process.env.USAGE_ANALYTICS_OWNER_EMAILS = "someone-else@example.com";
    dbMock.user.findMany.mockClear();
    const denied = await getAppActivity(request(), { params: Promise.resolve({}) });
    expect(denied.status).toBe(403);
    expect(dbMock.user.findMany).not.toHaveBeenCalled();
  });
});
