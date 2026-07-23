import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

/**
 * Every icon name the badge catalog can hand to iOS.
 *
 * Two sources: the seeded definitions in the badge migrations, and the icons an
 * admin can pick when creating a custom badge. Both end up in
 * `BadgeDefinition.icon` as Lucide names, because the catalog was authored for
 * the web.
 */
function catalogIconNames(): string[] {
  const icons = new Set<string>();

  // Seeded rows. The insert lists columns in a fixed order and `icon` is the
  // fifth quoted value on each VALUES row.
  const migrationsDir = path.join(process.cwd(), "prisma/migrations");
  for (const dir of readdirSync(migrationsDir)) {
    if (!/badge/i.test(dir)) continue;
    const sql = readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf8");
    for (const line of sql.split("\n")) {
      const row = line.trim();
      if (!row.startsWith("('seed_badge_") && !row.startsWith("('badge_")) continue;
      const quoted = [...row.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      const icon = quoted[4];
      if (icon) icons.add(icon);
    }
  }

  // Custom-badge picker options.
  const display = source("src/lib/badges/display.ts");
  const picker = display.slice(
    display.indexOf("export const customBadgeIconOptions"),
    display.indexOf("] as const;", display.indexOf("export const customBadgeIconOptions")),
  );
  for (const match of picker.matchAll(/"([A-Za-z0-9]+)"/g)) {
    const icon = match[1];
    if (icon) icons.add(icon);
  }

  return [...icons].filter(Boolean).sort();
}

describe("iOS badge icon coverage", () => {
  it("answers every catalog icon with a real SF Symbol", () => {
    const detail = source("ios/Wisconsin/Views/UserDetailView.swift");
    const map = detail.slice(
      detail.indexOf("var sfSymbolName: String {"),
      detail.indexOf('default: "seal.fill"'),
    );

    const names = catalogIconNames();
    // Sanity: the extractor found the catalog, not an empty set.
    expect(names.length).toBeGreaterThan(15);
    expect(names).toContain("PackageCheck");
    expect(names).toContain("ScanLine");

    // The defect this guards: iOS knew twelve names, the catalog used twenty
    // others, they overlapped on `Trophy`, and every other badge fell through
    // to `seal.fill` -- so a profile showed one glyph repeated.
    const unmapped = names.filter((name) => !map.includes(`case "${name}":`));
    expect(unmapped).toEqual([]);
  });

  it("keeps distinct badges on distinct symbols", () => {
    const detail = source("ios/Wisconsin/Views/UserDetailView.swift");
    const map = detail.slice(
      detail.indexOf("var sfSymbolName: String {"),
      detail.indexOf('default: "seal.fill"'),
    );

    const symbols = [...map.matchAll(/case "[A-Za-z0-9]+": "([a-z0-9.]+)"/g)]
      .flatMap((match) => match[1] ? [match[1]] : []);
    expect(symbols.length).toBeGreaterThan(25);
    // A one-to-one map. Two badges sharing a symbol is a milder version of the
    // same bug: the shelf stops telling them apart.
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
