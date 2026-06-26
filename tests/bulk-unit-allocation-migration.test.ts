import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bulk unit active allocation migration", () => {
  it("adds a partial unique index for one active allocation per numbered unit", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/0084_unique_active_bulk_unit_allocation/migration.sql"),
      "utf8",
    );

    expect(sql).toContain("CREATE UNIQUE INDEX \"booking_bulk_unit_allocations_one_active_unit_key\"");
    expect(sql).toContain("ON \"booking_bulk_unit_allocations\"(\"bulk_sku_unit_id\")");
    expect(sql).toContain("WHERE \"checked_out_at\" IS NOT NULL");
    expect(sql).toContain("AND \"checked_in_at\" IS NULL");
    expect(sql).toContain("HAVING COUNT(*) > 1");
    expect(sql).toContain("RAISE EXCEPTION");
  });
});
