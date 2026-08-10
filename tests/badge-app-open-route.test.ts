import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onAppOpened: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  withAuth: (handler: (req: Request, context: unknown) => Promise<Response>) =>
    (req: Request) => handler(req, {
      user: { id: "user-1", role: "STUDENT" },
    }),
}));

vi.mock("@/lib/badges", () => ({
  badges: { onAppOpened: mocks.onAppOpened },
}));

vi.mock("@/lib/rbac", () => ({
  requireRole: mocks.requireRole,
}));

import { POST } from "@/app/api/badges/events/app-open/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onAppOpened.mockResolvedValue(undefined);
});

describe("badge app-open event", () => {
  it("uses authenticated identity and server time", async () => {
    const before = Date.now();
    const response = await (POST as unknown as (req: Request) => Promise<Response>)(
      new Request("http://test/api/badges/events/app-open", {
        method: "POST",
        body: JSON.stringify({ userId: "someone-else", occurredAt: "1999-01-01T02:00:00Z" }),
      }),
    );
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith("STUDENT", ["ADMIN", "STAFF", "STUDENT"]);
    expect(mocks.onAppOpened).toHaveBeenCalledTimes(1);
    const event = mocks.onAppOpened.mock.calls[0]?.[0];
    expect(event.userId).toBe("user-1");
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after);
  });
});
