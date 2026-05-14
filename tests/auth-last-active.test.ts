import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      updateMany: vi.fn(),
    },
  },
}));

import { LAST_ACTIVE_REFRESH_MS, shouldRefreshLastActive } from "@/lib/auth";

describe("last-active tracking", () => {
  const now = new Date("2026-05-13T14:00:00.000Z");

  it("refreshes users with no recorded activity", () => {
    expect(shouldRefreshLastActive(null, now)).toBe(true);
  });

  it("skips users refreshed inside the debounce window", () => {
    const recent = new Date(now.getTime() - LAST_ACTIVE_REFRESH_MS + 1);

    expect(shouldRefreshLastActive(recent, now)).toBe(false);
  });

  it("refreshes users once the debounce window has elapsed", () => {
    const stale = new Date(now.getTime() - LAST_ACTIVE_REFRESH_MS);

    expect(shouldRefreshLastActive(stale, now)).toBe(true);
  });
});
