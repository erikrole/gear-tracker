import { describe, expect, it } from "vitest";
import { resolveSmokeSafety } from "./e2e/smoke-safety";

const credentials = {
  PLAYWRIGHT_EMAIL: "smoke@example.test",
  PLAYWRIGHT_PASSWORD: "test-password",
  PLAYWRIGHT_ROLE: "STAFF",
} as const;

describe("Playwright authenticated target safety", () => {
  it("keeps local no-credential discovery available", () => {
    expect(resolveSmokeSafety({})).toMatchObject({
      baseURL: "http://127.0.0.1:3000",
      hasCredentials: false,
      strictMode: false,
    });
  });

  it("fails CI when credentials are missing even without release mode", () => {
    expect(() => resolveSmokeSafety({ CI: "true" })).toThrow(
      "CI and release Playwright smoke require",
    );
  });

  it("rejects incomplete local credential input instead of silently skipping", () => {
    expect(() => resolveSmokeSafety({ PLAYWRIGHT_EMAIL: credentials.PLAYWRIGHT_EMAIL })).toThrow(
      "complete PLAYWRIGHT_EMAIL",
    );
  });

  it("requires an affirmative isolation opt-in for authenticated runs", () => {
    expect(() => resolveSmokeSafety(credentials)).toThrow("PLAYWRIGHT_TARGET_ISOLATED=1");
  });

  it("rejects the canonical and configured production hosts", () => {
    expect(() => resolveSmokeSafety({
      ...credentials,
      PLAYWRIGHT_BASE_URL: "https://wisconsincreative.com",
      PLAYWRIGHT_TARGET_ISOLATED: "1",
    })).toThrow("refuses production host wisconsincreative.com");

    expect(() => resolveSmokeSafety({
      ...credentials,
      PLAYWRIGHT_BASE_URL: "https://production.example.test",
      PLAYWRIGHT_PRODUCTION_HOSTS: "production.example.test",
      PLAYWRIGHT_TARGET_ISOLATED: "1",
    })).toThrow("refuses production host production.example.test");
  });

  it("accepts isolated local and review targets", () => {
    expect(resolveSmokeSafety({
      ...credentials,
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3000",
      PLAYWRIGHT_TARGET_ISOLATED: "1",
    })).toMatchObject({ hasCredentials: true, role: "STAFF", strictMode: false });

    expect(resolveSmokeSafety({
      ...credentials,
      CI: "true",
      PLAYWRIGHT_BASE_URL: "https://review.wisconsincreative.com",
      PLAYWRIGHT_TARGET_ISOLATED: "1",
    })).toMatchObject({
      baseURL: "https://review.wisconsincreative.com",
      hasCredentials: true,
      strictMode: true,
    });
  });
});
