import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { createAuditEntry } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET, PATCH } from "@/app/api/notifications/route";

const user = {
  id: "cm000000000000000000000001",
  email: "staff@example.com",
  name: "Staff User",
  role: "STAFF" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

function patchRequest(body: string) {
  return new Request("https://app.example.com/api/notifications", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body,
  });
}

function routeParams() {
  return { params: Promise.resolve({}) };
}

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(user);
  });

  it("rejects malformed JSON before writing notifications", async () => {
    const res = await PATCH(patchRequest("{not-json"), routeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("returns 404 and skips audit when mark_read does not update a notification", async () => {
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 0 } as never);

    const res = await PATCH(
      patchRequest(JSON.stringify({
        action: "mark_read",
        id: "cmotbr3cz0001kv8jfsrg0ank",
      })),
      routeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Notification not found");
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "cmotbr3cz0001kv8jfsrg0ank", userId: user.id },
      data: { readAt: expect.any(Date) },
    });
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("audits a successful mark_read mutation", async () => {
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await PATCH(
      patchRequest(JSON.stringify({
        action: "mark_read",
        id: "cmotbr3cz0001kv8jfsrg0ank",
      })),
      routeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(createAuditEntry).toHaveBeenCalledWith({
      actorId: user.id,
      actorRole: user.role,
      entityType: "notification",
      entityId: "cmotbr3cz0001kv8jfsrg0ank",
      action: "notification_marked_read",
    });
  });
});

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(user);
  });

  it("returns caller-scoped filtered and whole-inbox totals with deterministic ordering", async () => {
    vi.mocked(db.notification.findMany).mockResolvedValue([] as never);
    vi.mocked(db.notification.count)
      .mockResolvedValueOnce(2 as never)
      .mockResolvedValueOnce(7 as never)
      .mockResolvedValueOnce(2 as never);

    const res = await GET(
      new Request("https://app.example.com/api/notifications?limit=20&offset=20&unread=true"),
      routeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [], total: 2, inboxTotal: 7, limit: 20, offset: 20, unreadCount: 2 });
    expect(db.notification.findMany).toHaveBeenCalledWith({
      where: { userId: user.id, readAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: 20,
    });
    expect(db.notification.count).toHaveBeenNthCalledWith(2, { where: { userId: user.id } });
    expect(db.notification.count).toHaveBeenNthCalledWith(3, { where: { userId: user.id, readAt: null } });
  });
});
