import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "scripts/seed-app-review-demo.mjs"),
  "utf8",
);

describe("App Review demo seed safety", () => {
  it("requires an explicit password and exact database host before seeding", () => {
    expect(source).toContain("APP_REVIEW_DEMO_PASSWORD");
    expect(source).toContain("APP_REVIEW_DEMO_EXPECTED_HOST");
    expect(source).toContain("databaseHost !== expectedHost");
    expect(source).not.toContain('|| "ReviewDemo!2026"');
  });

  it("does not print the reviewer password", () => {
    expect(source).not.toContain("Password: ${password}");
  });

  it("seeds valid campus-login identities for Staff and Student Welcome testing", () => {
    expect(source).toContain('email: "jordan.lee.demo@wisc.edu"');
    expect(source).toContain('email: "alex.rivera.demo@wisc.edu"');
    expect(source).not.toContain("jordan.lee.demo@wisconsincreative.com");
    expect(source).not.toContain("alex.rivera.demo@wisconsincreative.com");
  });

  it("keeps future review data available beyond a typical App Review delay", () => {
    expect(source).toContain("const REVIEW_WINDOW_DAYS = 30;");
    expect(source).toContain("const UPCOMING_RESERVATION_DAYS = 21;");
    expect(source).toContain("daysFromNow(REVIEW_WINDOW_DAYS, 13)");
    expect(source).toContain("daysFromNow(UPCOMING_RESERVATION_DAYS, 10)");
  });
});
