import { describe, expect, it } from "vitest";

// The migration check is a plain ESM Node script, but the inspector is exported for regression coverage.
// @ts-expect-error no declaration file for local .mjs script modules
import { inspectMigrationDirectories } from "../scripts/check-migration-prefixes.mjs";

describe("inspectMigrationDirectories", () => {
  it("passes valid migration folders", () => {
    const result = inspectMigrationDirectories([
      migration("0078_add_shift_indexes"),
      migration("0079_add_booking_notes"),
    ]);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.migrationCount).toBe(2);
  });

  it("fails duplicate numeric prefixes unless the prefix is allowlisted", () => {
    const result = inspectMigrationDirectories([
      migration("0080_add_events"),
      migration("0080_add_event_indexes"),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Migration prefix collision 0080: 0080_add_events, 0080_add_event_indexes",
    );
  });

  it("keeps the historical applied 0077 collision allowlisted", () => {
    const result = inspectMigrationDirectories([
      migration("0077_bulk_unit_label_tracking"),
      migration("0077_add_bulk_sku_image_rehost_attempts"),
    ]);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails folders missing migration.sql", () => {
    const result = inspectMigrationDirectories([
      migration("0081_add_users_index"),
      migration("0082_add_assets_index", false),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing migration.sql: 0082_add_assets_index");
  });

  it("fails malformed folder names", () => {
    const result = inspectMigrationDirectories([
      migration("0083_add_shift_index"),
      migration("add_booking_index"),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid migration directory name: add_booking_index");
  });
});

function migration(name: string, hasMigrationSql = true) {
  return { name, hasMigrationSql };
}
