import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

const migration = source("prisma/migrations/0100_badge_catalog_rebalance/migration.sql");
const seed = source("prisma/seed.mjs");
const evaluator = source("src/lib/badges/evaluator.ts");
const queries = source("src/lib/badges/queries.ts");

describe("badge catalog rebalance", () => {
  it("fills the ladder gaps the award data exposed", () => {
    // 13 users had first_checkout, 3 had checkout_5, 0 had checkout_25.
    expect(migration).toContain("'checkout_10'");
    expect(migration).toContain("'on_time_25'");
    expect(migration).toContain("'scan_50'");
  });

  it("wires every new definition to a rule the evaluator can actually award", () => {
    // A definition whose (category, trigger, ruleKey) triple no evaluator call
    // matches is unearnable -- which is how the ten manual badges sat at zero.
    expect(migration).toContain("'damage_free_return'");
    expect(evaluator).toContain('ruleKey: "damage_free_return"');
    expect(evaluator).toContain("checkinReports: { none: {} }");

    expect(evaluator).toContain('ruleKey: "category_collector"');
    expect(migration).toContain('"trigger" = \'checkout:opened\'');

    expect(evaluator).toContain("export async function onShiftsWorked");
    expect(evaluator).toContain('trigger: "shift:completed"');
  });

  it("reports progress from the counter the badge is actually about", () => {
    // category_collector and the damage-free badges hang off triggers that
    // already mean something else, so rule key has to be tested first or a
    // checkout total gets reported as category breadth.
    const chain = queries.slice(
      queries.indexOf("let current: number | null = null;"),
      queries.indexOf("if (current !== null)"),
    );
    expect(chain.indexOf('definition.ruleKey === "category_collector"')).toBeGreaterThan(-1);
    expect(chain.indexOf('definition.ruleKey === "category_collector"')).toBeLessThan(
      chain.indexOf('definition.trigger === "checkout:opened"'),
    );
    expect(chain.indexOf('definition.ruleKey === "damage_free_return"')).toBeLessThan(
      chain.indexOf('definition.trigger === "checkout:opened"'),
    );
    expect(chain).toContain('definition.trigger === "shift:completed"');
  });

  it("revives shift counts without reviving shift streaks", () => {
    const revive = migration.slice(migration.indexOf("-- ── 2."), migration.indexOf("-- ── 3."));
    expect(revive).toContain('"active" = true');
    expect(revive).toContain("'first_shift', 'shift_10', 'shift_50'");
    expect(revive).not.toContain("streak_shifts_5'");

    // Counting from the database is what makes the nightly re-run a no-op.
    expect(evaluator).toContain("tx.shiftAssignment.count");
    // Archived events still count, or a worked-shift total would fall over time
    // and strand someone below a threshold they had already passed.
    const shiftFn = evaluator.slice(evaluator.indexOf("export async function onShiftsWorked"));
    expect(shiftFn.slice(0, shiftFn.indexOf("}\n\nexport"))).not.toContain("archivedAt");
  });

  it("retires the dead manual badges without deleting any award", () => {
    const retire = migration.slice(migration.indexOf("-- ── 4."));
    expect(retire).toContain('"active" = false');
    expect(retire).not.toContain("DELETE");
    for (const key of ["perfect_handoff", "clean_loop", "full_kit_no_misses", "semester_streak", "rookie_run", "reliable_regular", "clutch_cover"]) {
      expect(retire).toContain(`'${key}'`);
    }
    // The two genuine catch-alls stay, and so does the custom-badge path that
    // staff actually reached for.
    expect(retire).not.toContain("'above_and_beyond'");
    expect(retire).not.toContain("'event_hero'");
    expect(migration).not.toContain("custom_");
  });

  it("never deletes a badge definition or award", () => {
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bDROP\b/i);
  });

  it("keeps reseeding aligned with the migrated catalog", () => {
    for (const key of ["checkout_10", "on_time_25", "scan_50", "damage_free_10", "damage_free_50"]) {
      expect(seed).toContain(`key: "${key}"`);
    }
    expect(seed).toContain('description: "Worked a first event shift."');
    expect(seed).toContain('description: "Checked out gear from five different categories."');
    expect(seed).toContain("kind: BadgeKind.COUNT");
    expect(seed).toContain('trigger: "checkout:opened"');
    expect(seed).toContain("ruleKey: definition.ruleKey ?? null");

    const categoryDefinition = seed.slice(seed.indexOf('key: "category_collector"'), seed.indexOf('key: "event_hero"'));
    expect(categoryDefinition).toContain("kind: BadgeKind.COUNT");
    expect(categoryDefinition).toContain('threshold: 5');
    expect(categoryDefinition).not.toContain('trigger: "manual"');

    const retiredKeys = [
      "perfect_handoff",
      "clean_loop",
      "full_kit_no_misses",
      "semester_streak",
      "rookie_run",
      "reliable_regular",
      "clutch_cover",
    ];
    for (const key of retiredKeys) {
      const definitionStart = seed.indexOf(`key: "${key}"`);
      const definitionEnd = seed.indexOf("\n  },", definitionStart);
      const definition = seed.slice(definitionStart, definitionEnd);
      expect(definition).toContain("active: false");
      expect(definition).toContain("Retired: replaced by automatic recognition or unused in practice.");
    }
  });
});
