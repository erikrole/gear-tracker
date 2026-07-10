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
});
