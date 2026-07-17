import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("full-color CSS token syntax", () => {
  it("does not wrap complete color tokens in hsl()", () => {
    const files = execFileSync("rg", ["--files", "src"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter((path) => /\.(?:css|ts|tsx)$/.test(path));

    const offenders = files.filter((path) => /hsl\(var\(--/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("uses OKLCH mixing for partial-opacity arbitrary shadows", () => {
    const sources = [
      "src/app/(app)/schedule/_components/ListView.tsx",
      "src/app/(app)/schedule/_components/ScheduleFilters.tsx",
      "src/app/(app)/users/[id]/UserBadgesTab.tsx",
    ].map((path) => readFileSync(path, "utf8"));

    for (const source of sources) {
      expect(source).toContain("color-mix(in_oklch");
    }
  });
});
