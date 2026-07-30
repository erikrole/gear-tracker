import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    blast: { findUnique: vi.fn(), update: vi.fn() },
    blastRecipient: { findMany: vi.fn(), updateMany: vi.fn() },
    deviceToken: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/push/apns", () => ({
  sendPush: vi.fn(),
}));

// `deferPush` wraps next/server's after(); the send path under test is called
// directly here, so a pass-through keeps the module import cheap.
vi.mock("@/lib/services/notifications", () => ({
  deferPush: (task: Promise<void>) => void task,
}));

import { db } from "@/lib/db";
import { sendPush } from "@/lib/push/apns";
import { sendBlastPush } from "@/lib/services/blasts";

const mockedDb = db as unknown as {
  blast: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  blastRecipient: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  deviceToken: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
};
const mockedSendPush = sendPush as unknown as ReturnType<typeof vi.fn>;

/** Every updateMany call, flattened to { status, userIds }. */
function statusWrites() {
  return mockedDb.blastRecipient.updateMany.mock.calls
    .filter(([args]) => Array.isArray(args.where.userId?.in))
    .map(([args]) => ({
      status: args.data.pushStatus,
      userIds: args.where.userId.in as string[],
    }));
}

function statusFor(userId: string): string | undefined {
  return statusWrites().find((w) => w.userIds.includes(userId))?.status;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedDb.blast.findUnique.mockResolvedValue({ title: "Call time moved", body: "Be at gate 3 by 4pm", status: "SENT" });
  mockedDb.blastRecipient.updateMany.mockResolvedValue({ count: 1 });
  mockedDb.deviceToken.updateMany.mockResolvedValue({ count: 0 });
  mockedSendPush.mockImplementation(async (tokens: string[]) => ({
    accepted: tokens,
    revoked: [],
    ok: tokens.length,
  }));
});

describe("sendBlastPush", () => {
  it("writes blast inbox copies with bounded set-based database operations", () => {
    const service = readFileSync(
      path.join(process.cwd(), "src/lib/services/blasts.ts"),
      "utf8",
    );
    const writer = service.slice(
      service.indexOf("async function writeInboxCopies"),
      service.indexOf("export async function sendBlastPush"),
    );

    expect(writer).toContain("tx.notification.createMany({");
    expect(writer).toContain('UPDATE "blast_recipients" AS br');
    expect(writer).not.toContain("Promise.allSettled(");
    expect(writer).not.toContain("db.notification.create({");
  });

  it("sends one batched dispatch for the whole blast, not one per user", async () => {
    mockedDb.blastRecipient.findMany.mockResolvedValue([
      { userId: "u1", user: { notificationPrefs: null } },
      { userId: "u2", user: { notificationPrefs: null } },
      { userId: "u3", user: { notificationPrefs: null } },
    ]);
    mockedDb.deviceToken.findMany.mockResolvedValue([
      { token: "t1", userId: "u1" },
      { token: "t2", userId: "u2" },
      { token: "t3", userId: "u3" },
    ]);

    await sendBlastPush("b1");

    expect(mockedSendPush).toHaveBeenCalledTimes(1);
    expect(mockedSendPush.mock.calls[0]?.[0]).toEqual(["t1", "t2", "t3"]);
    expect(mockedSendPush.mock.calls[0]?.[1]).toMatchObject({
      title: "Call time moved",
      payload: { blastId: "b1" },
    });
    expect(mockedDb.blastRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blastId: "b1", user: { active: true } },
      }),
    );
    expect(mockedDb.deviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: "IOS",
          user: { active: true },
        }),
        take: 4_000,
      }),
    );
    expect(statusFor("u1")).toBe("SENT");
  });

  it("records SKIPPED_PREFS for a user who paused or muted push, and never queries their tokens", async () => {
    mockedDb.blastRecipient.findMany.mockResolvedValue([
      { userId: "u1", user: { notificationPrefs: null } },
      { userId: "muted", user: { notificationPrefs: { channels: { push: false, email: true } } } },
      {
        userId: "paused",
        user: { notificationPrefs: { pausedUntil: new Date(Date.now() + 3_600_000).toISOString() } },
      },
    ]);
    mockedDb.deviceToken.findMany.mockResolvedValue([{ token: "t1", userId: "u1" }]);

    await sendBlastPush("b1");

    expect(statusFor("muted")).toBe("SKIPPED_PREFS");
    expect(statusFor("paused")).toBe("SKIPPED_PREFS");
    expect(mockedDb.deviceToken.findMany.mock.calls[0]?.[0].where.userId.in).toEqual(["u1"]);
  });

  it("records NO_DEVICE for an eligible user with no live token", async () => {
    mockedDb.blastRecipient.findMany.mockResolvedValue([
      { userId: "u1", user: { notificationPrefs: null } },
      { userId: "webonly", user: { notificationPrefs: null } },
    ]);
    mockedDb.deviceToken.findMany.mockResolvedValue([{ token: "t1", userId: "u1" }]);

    await sendBlastPush("b1");

    expect(statusFor("webonly")).toBe("NO_DEVICE");
    expect(statusFor("u1")).toBe("SENT");
  });

  it("records FAILED, not SENT, when every one of a user's tokens is revoked", async () => {
    mockedDb.blastRecipient.findMany.mockResolvedValue([
      { userId: "stale", user: { notificationPrefs: null } },
      { userId: "twophones", user: { notificationPrefs: null } },
    ]);
    mockedDb.deviceToken.findMany.mockResolvedValue([
      { token: "dead", userId: "stale" },
      { token: "dead2", userId: "twophones" },
      { token: "live", userId: "twophones" },
    ]);
    mockedSendPush.mockResolvedValue({
      accepted: ["live"],
      revoked: ["dead", "dead2"],
      ok: 1,
    });

    await sendBlastPush("b1");

    expect(statusFor("stale")).toBe("FAILED");
    // One dead phone and one live phone still counts as delivered.
    expect(statusFor("twophones")).toBe("SENT");
    expect(mockedDb.deviceToken.updateMany).toHaveBeenCalledWith({
      where: { token: { in: ["dead", "dead2"] } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("records FAILED when APNs reports only a transient delivery failure", async () => {
    mockedDb.blastRecipient.findMany.mockResolvedValue([
      { userId: "transient", user: { notificationPrefs: null } },
    ]);
    mockedDb.deviceToken.findMany.mockResolvedValue([
      { token: "retry-later", userId: "transient" },
    ]);
    mockedSendPush.mockResolvedValue({ accepted: [], revoked: [], ok: 0 });

    await sendBlastPush("b1");

    expect(statusFor("transient")).toBe("FAILED");
    expect(mockedDb.deviceToken.updateMany).not.toHaveBeenCalled();
  });

  it("limits a blast to the two newest active registrations per recipient", async () => {
    mockedDb.blastRecipient.findMany.mockResolvedValue([
      { userId: "u1", user: { notificationPrefs: null } },
      { userId: "u2", user: { notificationPrefs: null } },
    ]);
    mockedDb.deviceToken.findMany.mockResolvedValue([
      { token: "u1-newest", userId: "u1" },
      { token: "u1-second", userId: "u1" },
      { token: "u1-third", userId: "u1" },
      { token: "u2-only", userId: "u2" },
    ]);

    await sendBlastPush("b1");

    expect(mockedSendPush.mock.calls[0]?.[0]).toEqual([
      "u1-newest",
      "u1-second",
      "u2-only",
    ]);
  });

  it("does not send for a cancelled blast", async () => {
    mockedDb.blast.findUnique.mockResolvedValue({ title: "x", body: "y", status: "CANCELLED" });

    await sendBlastPush("b1");

    expect(mockedSendPush).not.toHaveBeenCalled();
    expect(mockedDb.blastRecipient.findMany).not.toHaveBeenCalled();
  });

  it("swallows errors -- it runs inside after(), where a rejection is fatal", async () => {
    mockedDb.blastRecipient.findMany.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendBlastPush("b1")).resolves.toBeUndefined();

    spy.mockRestore();
  });
});
