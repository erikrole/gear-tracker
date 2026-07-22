import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Walks `src` for style-bearing sources.
 *
 * This used to shell out to `rg --files`. Where ripgrep is not installed the
 * spawn throws ENOENT, so the guard did not fail on a real offender -- it
 * failed on the environment, which is the same red either way but stops the
 * check from ever passing honestly. Node's own walk has no such dependency.
 */
function styleSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      found.push(...styleSources(full));
    } else if (/\.(?:css|ts|tsx)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe("full-color CSS token syntax", () => {
  it("does not wrap complete color tokens in hsl()", () => {
    const files = styleSources("src");

    // Guard the guard: an empty sweep must not read as a pass.
    expect(files.length).toBeGreaterThan(100);

    const offenders = files.filter((file) => /hsl\(var\(--/.test(readFileSync(file, "utf8")));
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
