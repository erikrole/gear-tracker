import { describe, expect, it } from "vitest";
import { createQueryClient, getQueryClient, shouldPersistQueryKey } from "@/lib/query-client";

describe("shouldPersistQueryKey", () => {
  it("persists dashboard and booking detail cache roots", () => {
    expect(shouldPersistQueryKey(["dashboard"])).toBe(true);
    expect(shouldPersistQueryKey(["booking", "booking-1"])).toBe(true);
  });

  it("does not persist broad list, settings, or user-scoped roots", () => {
    expect(shouldPersistQueryKey(["bookingList", "CHECKOUT", "/api/checkouts"])).toBe(false);
    expect(shouldPersistQueryKey(["fetch", "/api/settings/escalation"])).toBe(false);
    expect(shouldPersistQueryKey(["me"])).toBe(false);
    expect(shouldPersistQueryKey(["form-options"])).toBe(false);
  });

  it("ignores non-string query roots", () => {
    expect(shouldPersistQueryKey([null])).toBe(false);
    expect(shouldPersistQueryKey([{ scope: "dashboard" }])).toBe(false);
  });
});

describe("query client lifecycle", () => {
  it("creates isolated server clients", () => {
    expect(getQueryClient()).not.toBe(getQueryClient());
  });

  it("creates fresh explicit clients", () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});
