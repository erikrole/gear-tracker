import { describe, expect, it } from "vitest";
import { resolveActiveShellHref, routeMatches } from "@/lib/shell-navigation";

describe("shell navigation ownership", () => {
  it("selects only the most-specific matching destination", () => {
    expect(resolveActiveShellHref("/items/hygiene", ["/", "/items", "/items/hygiene"])).toBe("/items/hygiene");
    expect(resolveActiveShellHref("/settings/profile", ["/", "/settings"])).toBe("/settings");
  });

  it("matches route segments instead of unrelated prefixes", () => {
    expect(routeMatches("/items/123", "/items")).toBe(true);
    expect(routeMatches("/itemsets", "/items")).toBe(false);
    expect(routeMatches("/", "/")).toBe(true);
    expect(routeMatches("/dashboard", "/")).toBe(false);
  });
});
