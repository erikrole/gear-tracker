import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  calendarSourceFailureDetail,
  updateCalendarSyncHealth,
} from "@/lib/services/calendar-sync-health";

const mockedDb = db as unknown as {
  systemConfig: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
  };
  notification: {
    createMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedDb.systemConfig.upsert.mockResolvedValue({} as any);
  mockedDb.user.findMany.mockResolvedValue([]);
  mockedDb.notification.createMany.mockResolvedValue({ count: 0 } as any);
});

describe("calendar sync health escalation", () => {
  it("notifies active admins when a source reaches three consecutive hard failures", async () => {
    mockedDb.systemConfig.findUnique.mockResolvedValue({
      key: "calendar_sync_health",
      value: {
        sources: {
          "source-1": {
            consecutiveFailures: 2,
            lastError: "HTTP 500",
          },
        },
      },
    });
    mockedDb.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    mockedDb.notification.createMany.mockResolvedValue({ count: 2 } as any);

    const result = await updateCalendarSyncHealth({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      result: { added: 0, updated: 0, cancelled: 0, skipped: 0, errors: [], error: "HTTP 500" },
      now: new Date("2026-06-02T08:00:00.000Z"),
    });

    expect(result).toEqual({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      consecutiveFailures: 3,
      failed: true,
      notificationsCreated: 2,
    });
    expect(mockedDb.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "calendar_sync_health" },
      update: {
        value: expect.objectContaining({
          sources: expect.objectContaining({
            "source-1": expect.objectContaining({
              consecutiveFailures: 3,
              lastError: "HTTP 500",
              lastFailedAt: "2026-06-02T08:00:00.000Z",
            }),
          }),
        }),
      },
    }));
    expect(mockedDb.user.findMany).toHaveBeenCalledWith({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    expect(mockedDb.notification.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: "admin-1",
          type: "calendar_sync_failure",
          title: "Calendar sync failing: UW Badgers",
          dedupeKey: "calendar_sync_failure:source-1:3:admin-1",
          payload: expect.objectContaining({
            href: "/settings/calendar-sources",
            consecutiveFailures: 3,
          }),
        }),
        expect.objectContaining({
          userId: "admin-2",
          dedupeKey: "calendar_sync_failure:source-1:3:admin-2",
        }),
      ],
    });
  });

  it("does not notify below the repeated-failure threshold", async () => {
    mockedDb.systemConfig.findUnique.mockResolvedValue(null);

    const result = await updateCalendarSyncHealth({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      result: { added: 0, updated: 0, cancelled: 0, skipped: 0, errors: [], error: "HTTP 404" },
      now: new Date("2026-06-02T08:00:00.000Z"),
    });

    expect(result.consecutiveFailures).toBe(1);
    expect(result.notificationsCreated).toBe(0);
    expect(mockedDb.user.findMany).not.toHaveBeenCalled();
    expect(mockedDb.notification.createMany).not.toHaveBeenCalled();
  });

  it("resets hard-failure count after a clean hard sync", async () => {
    mockedDb.systemConfig.findUnique.mockResolvedValue({
      key: "calendar_sync_health",
      value: {
        sources: {
          "source-1": {
            consecutiveFailures: 4,
            lastError: "HTTP 500",
            lastFailedAt: "2026-06-01T08:00:00.000Z",
          },
        },
      },
    });

    const result = await updateCalendarSyncHealth({
      sourceId: "source-1",
      sourceName: "UW Badgers",
      result: { added: 1, updated: 0, cancelled: 0, skipped: 2, errors: [{ uid: "bad", summary: "Bad event", operation: "validate", reason: "Invalid date" }] },
      now: new Date("2026-06-02T08:00:00.000Z"),
    });

    expect(result).toMatchObject({ consecutiveFailures: 0, failed: false, notificationsCreated: 0 });
    expect(mockedDb.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        value: expect.objectContaining({
          sources: expect.objectContaining({
            "source-1": expect.objectContaining({
              consecutiveFailures: 0,
              lastError: null,
              lastSucceededAt: "2026-06-02T08:00:00.000Z",
            }),
          }),
        }),
      },
    }));
    expect(mockedDb.notification.createMany).not.toHaveBeenCalled();
  });

  it("formats Admin Fix Today calendar failure details with repeated failure count", () => {
    expect(calendarSourceFailureDetail("HTTP 500", 3)).toBe("3 consecutive failures / HTTP 500");
    expect(calendarSourceFailureDetail("HTTP 500", 0)).toBe("HTTP 500");
  });
});
