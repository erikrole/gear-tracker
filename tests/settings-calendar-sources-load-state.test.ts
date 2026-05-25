import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("settings calendar sources load state", () => {
  it("does not report an API load failure as an empty calendar-source list", () => {
    const source = readFileSync("src/app/(app)/settings/calendar-sources/page.tsx", "utf8");

    expect(source).toContain("error: sourcesError");
    expect(source).toContain("hasInitialLoadError");
    expect(source).toContain("Calendar sources could not load.");
    expect(source).toContain("Retry sources");
    expect(source).toContain('title="No calendar sources configured"');
  });

  it("keeps add-source fields connected to explicit labels and form metadata", () => {
    const source = readFileSync("src/app/(app)/settings/calendar-sources/page.tsx", "utf8");

    expect(source).toContain('htmlFor="calendar-source-name"');
    expect(source).toContain('id="calendar-source-name"');
    expect(source).toContain('name="calendarSourceName"');
    expect(source).toContain('htmlFor="calendar-source-url"');
    expect(source).toContain('id="calendar-source-url"');
    expect(source).toContain('name="calendarSourceUrl"');
  });
});
