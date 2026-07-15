import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "scripts/consolidate-battery-families.mjs"), "utf8");

describe("battery-family consolidation script", () => {
  it("defaults to dry run and requires an attributed apply", () => {
    expect(source).toContain('const APPLY = process.argv.includes("--apply")');
    expect(source).toContain('option("--actor-email")');
    expect(source).toContain("--actor-email is required for audit and stock-movement attribution");
  });

  it("pins the four active unit-tracked family names", () => {
    expect(source).toContain('["FX6 Battery", "Gold Mount Battery", "Monitor Battery", "Sony Battery"]');
    expect(source).toContain("families.some((family) => !family.trackByNumber)");
  });

  it("preserves Sony units and printed-label state", () => {
    expect(source).toContain('name: "Sony Battery", active: true, trackByNumber: true, qr: "94e068d1"');
    expect(source).toContain("Sony Battery printed-label state changed");
    expect(source).toContain('"battery_family_preserved"');
  });

  it("moves existing units into permanent non-overlapping sequences", () => {
    expect(source).toContain("unitNumber: { increment: 14 }");
    expect(source).toContain("unitNumber: { increment: 8 }");
    expect(source).toContain("unitNumber: { increment: 4 }");
  });

  it("retains history-bearing records and hard-deletes only guarded history-free rows", () => {
    expect(source).toContain('"serialized_battery_retired"');
    expect(source).toContain("gained operational history and cannot be deleted");
    expect(source).toContain('"battery_family_hard_deleted"');
  });

  it("writes pre-mutation proof and rechecks inside a serializable transaction", () => {
    expect(source).toContain("battery-family-consolidation-${Date.now()}.json");
    expect(source).toContain("const current = await loadState(tx)");
    expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(source).toContain("Post-apply verification failed");
  });
});
