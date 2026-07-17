import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_POLLING_IDLE_MS,
  getOperationalPollingState,
} from "@/hooks/use-operational-polling-activity";

describe("operational polling activity", () => {
  const now = 1_000_000;

  it("keeps polling active only for a visible, online, recently active user", () => {
    expect(getOperationalPollingState({
      enabled: true,
      visible: true,
      online: true,
      lastActivityAt: now - OPERATIONAL_POLLING_IDLE_MS + 1,
      now,
    })).toBe("active");

    expect(getOperationalPollingState({
      enabled: true,
      visible: true,
      online: true,
      lastActivityAt: now - OPERATIONAL_POLLING_IDLE_MS,
      now,
    })).toBe("idle");
  });

  it("prioritizes disabled, hidden, and offline states", () => {
    const base = { lastActivityAt: now, now };

    expect(getOperationalPollingState({ ...base, enabled: false, visible: true, online: true }))
      .toBe("disabled");
    expect(getOperationalPollingState({ ...base, enabled: true, visible: false, online: true }))
      .toBe("hidden");
    expect(getOperationalPollingState({ ...base, enabled: true, visible: true, online: false }))
      .toBe("offline");
  });

  it("uses a two-minute idle window and resumes from browser activity", () => {
    const source = readFileSync("src/hooks/use-operational-polling-activity.ts", "utf8");

    expect(OPERATIONAL_POLLING_IDLE_MS).toBe(120_000);
    expect(source).toContain('"pointerdown", "pointermove", "keydown", "touchstart", "wheel"');
    expect(source).toContain('window.addEventListener("focus", recordActivity)');
    expect(source).toContain('window.addEventListener("online", recordActivity)');
    expect(source).toContain('document.addEventListener("visibilitychange", onVisibilityChange)');
  });
});
