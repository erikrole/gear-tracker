import { db } from "@/lib/db";

type InstallationRecord = {
  platform: string;
  appVersion: string | null;
  appBuild: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  releaseChannel: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastOpenedAt: Date | null;
};

type BuildStatus = "latest" | "stale" | "ahead" | "unknown";

function configuredLatestIosBuild(): { version: string | null; build: string } | null {
  const build = process.env.IOS_LATEST_APP_BUILD?.trim();
  if (!build) return null;
  return {
    version: process.env.IOS_LATEST_APP_VERSION?.trim() || null,
    build,
  };
}

function iosBuildStatus(
  client: InstallationRecord,
  latest: { version: string | null; build: string } | null,
): BuildStatus | null {
  if (client.platform !== "ios") return null;
  if (!latest || !client.appBuild) return "unknown";
  if (latest.version && client.appVersion !== latest.version) {
    if (!client.appVersion) return "unknown";
    const current = Number(client.appBuild);
    const expected = Number(latest.build);
    if (Number.isFinite(current) && Number.isFinite(expected)) return current < expected ? "stale" : "ahead";
    return "unknown";
  }
  if (client.appBuild === latest.build) return "latest";

  const current = Number(client.appBuild);
  const expected = Number(latest.build);
  if (Number.isFinite(current) && Number.isFinite(expected)) {
    return current < expected ? "stale" : "ahead";
  }
  return "unknown";
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function latestDate(values: Array<Date | null>): Date | null {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    if (!latest || value > latest) return value;
    return latest;
  }, null);
}

export async function getAppActivityReport() {
  const latestIosBuild = configuredLatestIosBuild();
  const users = await db.user.findMany({
    where: { hiddenFromRoster: false },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      name: true,
      email: true,
      role: true,
      active: true,
      appInstallations: {
        orderBy: { lastSeenAt: "desc" },
        select: {
          platform: true,
          appVersion: true,
          appBuild: true,
          osVersion: true,
          deviceModel: true,
          releaseChannel: true,
          firstSeenAt: true,
          lastSeenAt: true,
          lastOpenedAt: true,
        },
      },
    },
  });

  const reportUsers = users.map((user) => {
    const clients = user.appInstallations as InstallationRecord[];
    const lastUsedAt = latestDate(clients.map((client) => client.lastOpenedAt));

    return {
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      used: Boolean(lastUsedAt),
      lastUsedAt: iso(lastUsedAt),
      clients: clients.map((client) => ({
        platform: client.platform,
        appVersion: client.appVersion,
        appBuild: client.appBuild,
        osVersion: client.osVersion,
        deviceModel: client.deviceModel,
        releaseChannel: client.releaseChannel,
        firstSeenAt: client.firstSeenAt.toISOString(),
        lastSeenAt: client.lastSeenAt.toISOString(),
        lastOpenedAt: iso(client.lastOpenedAt),
        buildStatus: iosBuildStatus(client, latestIosBuild),
      })),
    };
  });

  const clients = reportUsers.flatMap((user) => user.clients);
  const usersWith = (predicate: (user: (typeof reportUsers)[number]) => boolean) =>
    reportUsers.filter(predicate).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: reportUsers.length,
      usedUsers: usersWith((user) => user.used),
      neverUsedUsers: usersWith((user) => !user.used),
      iosUsers: usersWith((user) => user.clients.some((client) => client.platform === "ios")),
      iosInstallations: clients.filter((client) => client.platform === "ios").length,
      latestIosInstallations: clients.filter((client) => client.buildStatus === "latest").length,
      staleIosInstallations: clients.filter((client) => client.buildStatus === "stale").length,
      unclassifiedIosInstallations: clients.filter((client) => client.platform === "ios" && client.buildStatus !== "latest" && client.buildStatus !== "stale").length,
      testflightInstallations: clients.filter((client) => client.releaseChannel === "testflight").length,
      appStoreInstallations: clients.filter((client) => client.releaseChannel === "app_store").length,
      webInstallations: clients.filter((client) => client.platform === "web").length,
    },
    latestIosBuild,
    users: reportUsers,
  };
}
