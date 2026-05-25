import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("settings locations accessibility", () => {
  it("gives row controls location-specific accessible names", () => {
    const source = readFileSync("src/app/(app)/settings/locations/page.tsx", "utf8");

    expect(source).toContain("aria-label={`Toggle ${loc.name} home venue`}");
    expect(source).toContain("aria-label={`Rename ${loc.name}`}");
    expect(source).toContain("id={`location-name-${loc.id}`}");
    expect(source).toContain('name="locationName"');
    expect(source).not.toContain('aria-label="Toggle home venue"');
  });
});
