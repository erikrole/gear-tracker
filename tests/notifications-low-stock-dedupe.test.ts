import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), createMany: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  buildNotificationEmail: vi.fn().mockReturnValue("<html></html>"),
}));

vi.mock("@/lib/push/apns", () => ({
  sendPush: vi.fn().mockResolvedValue({ revoked: [] }),
}));

import { db } from "@/lib/db";
import { notifyLowStock } from "@/lib/services/notifications";

const mockDb = db as unknown as {
  user: { findMany: MockFn };
  notification: { findMany: MockFn; createMany: MockFn };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
  mockDb.notification.findMany.mockResolvedValue([]);
  mockDb.notification.createMany.mockResolvedValue({ count: 2 });
});

const args = {
  bulkSkuId: "sku-1",
  skuName: "Sony Battery",
  onHandQuantity: 2,
  minThreshold: 5,
};

describe("notifyLowStock dedupe", () => {
  // ── REGRESSION: dedupeKey is globally unique, so a constant key plus
  // skipDuplicates silenced every future re-alert after the first one. ──
  it("uses day-stamped dedupe keys so re-alerts survive the unique constraint", async () => {
    await notifyLowStock(args);

    const call = mockDb.notification.createMany.mock.calls[0]![0];
    const dayStamp = new Date().toISOString().slice(0, 10);
    expect(call.data).toHaveLength(2);
    expect(call.data[0].dedupeKey).toBe(`low_stock:sku-1:admin-1:${dayStamp}`);
    expect(call.data[1].dedupeKey).toBe(`low_stock:sku-1:admin-2:${dayStamp}`);
  });

  it("skips admins alerted for this SKU within the last 24 hours", async () => {
    mockDb.notification.findMany.mockResolvedValue([
      { dedupeKey: "low_stock:sku-1:admin-1:2026-07-07" },
    ]);

    await notifyLowStock(args);

    const call = mockDb.notification.createMany.mock.calls[0]![0];
    expect(call.data).toHaveLength(1);
    expect(call.data[0].userId).toBe("admin-2");
  });

  it("treats legacy un-stamped keys as recent alerts too", async () => {
    mockDb.notification.findMany.mockResolvedValue([
      { dedupeKey: "low_stock:sku-1:admin-1" },
    ]);

    await notifyLowStock(args);

    const call = mockDb.notification.createMany.mock.calls[0]![0];
    expect(call.data).toHaveLength(1);
    expect(call.data[0].userId).toBe("admin-2");
  });

  it("queries the 24h window by SKU prefix, not exact constant keys", async () => {
    await notifyLowStock(args);

    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dedupeKey: { startsWith: "low_stock:sku-1:" },
          createdAt: { gte: expect.any(Date) },
        }),
      }),
    );
  });
});

describe("APNs transport contract", () => {
  const source = (relativeFile: string) =>
    readFileSync(path.join(process.cwd(), relativeFile), "utf8");

  it("attaches a session error handler and request timeouts", () => {
    const apns = source("src/lib/push/apns.ts");
    // Every send path connects through the guarded helper — an unhandled
    // http2 session "error" event would kill the serverless function.
    expect(apns).toContain('client.on("error"');
    // The only raw http2.connect lives inside connectApns.
    expect((apns.match(/http2\.connect\(/g) ?? []).length).toBe(1);
    expect(apns).toContain("connectApns(host)");
    expect(apns).toContain("req.setTimeout(APNS_REQUEST_TIMEOUT_MS");
  });

  it("caches the provider JWT instead of minting one per send", () => {
    const apns = source("src/lib/push/apns.ts");
    expect(apns).toContain("cachedJwt");
    // All sends fetch the token via the cache, never mint directly.
    expect((apns.match(/getJwt\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(apns).not.toContain("const jwt = makeJWT();");
  });

  it("retries wrong-environment tokens on the other APNs host before revoking", () => {
    const apns = source("src/lib/push/apns.ts");
    // Dev builds hold sandbox tokens even against the production server;
    // revoking on the first BadDeviceToken permanently silences those devices.
    expect(apns).toContain("APNS_FALLBACK_HOST");
    expect(apns).toContain('outcomes.get(t) === "badToken"');
    // Auth failures re-mint the provider JWT instead of failing the batch.
    expect(apns).toContain("invalidateJwt()");
  });

  it("sendPushToUser never throws into fire-and-forget call sites", () => {
    const notifications = source("src/lib/services/notifications.ts");
    const fnStart = notifications.indexOf("export async function sendPushToUser");
    const fnBody = notifications.slice(fnStart, notifications.indexOf("export", fnStart + 1));
    expect(fnBody).toContain("try {");
    expect(fnBody).toContain("catch (err)");
  });
});
