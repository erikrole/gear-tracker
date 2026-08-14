import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("usage analytics source contract", () => {
  it("keeps report access owner-specific and separate from role", () => {
    const access = source("src/lib/usage-analytics.ts");
    const route = source("src/app/api/reports/usage/route.ts");
    expect(access).toContain("USAGE_ANALYTICS_OWNER_EMAILS");
    expect(route).toContain("canViewUsageAnalytics(user)");
    expect(route).not.toContain("requirePermission");
    expect(route).not.toContain("requireRole");
  });

  it("counts normalized web and native surfaces without content fields", () => {
    const web = source("src/components/ProductUsageTracker.tsx");
    const api = source("src/app/api/product-events/route.ts");
    const native = source("ios/Wisconsin/Core/APIClient.swift");
    expect(web).toContain('eventName, platform: "web", surface');
    expect(native).toContain('platform: "ios"');
    expect(native).toContain('request(path: "/api/product-events"');
    expect(api).not.toContain("searchQuery");
    expect(api).not.toContain("recordId");
    expect(api).not.toContain("pathname");
  });
});
