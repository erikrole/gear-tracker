import { describe, expect, it } from "vitest";
import { getVisiblePageSearchResults } from "@/lib/search-pages";

describe("global page search results", () => {
  it("lets students search personal settings but not staff/admin destinations", () => {
    const labels = getVisiblePageSearchResults("STUDENT", "settings", 30).map((result) => result.title);

    expect(labels).toContain("Security");
    expect(labels).toContain("Notifications");
    expect(labels).not.toContain("Settings");
    expect(labels).not.toContain("Data Export");
    expect(labels).not.toContain("Fix Today");
  });

  it("finds settings by operational keywords", () => {
    const results = getVisiblePageSearchResults("ADMIN", "allowlist", 10);

    expect(results.map((result) => result.href)).toContain("/settings/allowed-emails");
  });

  it("finds reports for staff users", () => {
    const results = getVisiblePageSearchResults("STAFF", "missing units", 10);

    expect(results).toContainEqual(expect.objectContaining({
      title: "Missing Units",
      href: "/reports/bulk-losses",
    }));
  });
});
