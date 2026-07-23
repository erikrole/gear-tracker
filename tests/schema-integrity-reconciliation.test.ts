import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/0104_license_claim_history_integrity/migration.sql",
  "utf8",
);
const timestampParityMigration = readFileSync(
  "prisma/migrations/0105_license_expiry_timestamp_parity/migration.sql",
  "utf8",
);
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const emptyDatabaseBootstrap = readFileSync(
  "scripts/bootstrap-empty-database.mjs",
  "utf8",
);

describe("schema integrity reconciliation", () => {
  it("records every manually applied License V2 field in migration history", () => {
    expect(migration).toContain(
      'ALTER TYPE "LicenseCodeStatus" ADD VALUE IF NOT EXISTS \'PARTIAL\'',
    );
    expect(migration).toMatch(
      /ALTER TABLE "license_codes"[\s\S]*?ADD COLUMN IF NOT EXISTS "account_email" TEXT,[\s\S]*?ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP\(3\)/,
    );
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "occupant_label" TEXT',
    );
    expect(migration).toMatch(
      /ALTER TABLE "license_code_claims"[\s\S]*?ALTER COLUMN "user_id" DROP NOT NULL/,
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "license_codes_expires_at_idx"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "license_code_claims_one_active_per_user"',
    );
    expect(migration).toContain(
      'WHERE "released_at" IS NULL AND "user_id" IS NOT NULL',
    );
    expect(migration).toContain(
      "Cannot enforce one active license claim per user",
    );
    expect(migration).toContain(
      "Cannot preserve two-slot license capacity",
    );
  });

  it("reconciles the manual expiry timestamp to Prisma's UTC millisecond contract", () => {
    expect(timestampParityMigration).toContain(
      "current_type = 'timestamp with time zone'",
    );
    expect(timestampParityMigration).toContain(
      'ALTER COLUMN "expires_at" TYPE TIMESTAMP(3) WITHOUT TIME ZONE',
    );
    expect(timestampParityMigration).toContain(
      'USING ("expires_at" AT TIME ZONE \'UTC\')',
    );
    expect(timestampParityMigration).toContain(
      "current_precision IS DISTINCT FROM 3",
    );
    expect(timestampParityMigration).toContain(
      "unexpected type %",
    );
  });

  it("models the optional release actor with history-preserving deletion", () => {
    expect(schema).toMatch(
      /licenseClaimsReleased\s+LicenseCodeClaim\[\]\s+@relation\("LicenseClaimReleasedBy"\)/,
    );
    expect(schema).toMatch(
      /releasedBy\s+User\?\s+@relation\("LicenseClaimReleasedBy", fields: \[releasedById\], references: \[id\], onDelete: SetNull\)/,
    );
    expect(schema).toContain("@@index([releasedById])");
  });

  it("rejects orphaned release actors before adding the foreign key", () => {
    expect(migration).toContain("orphaned released_by_id values exist");
    expect(migration).toContain(
      'WHERE claim."released_by_id" IS NOT NULL',
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "license_code_claims_released_by_id_fkey"',
    );
  });

  it("reconciles claim-holder deletion to SET NULL", () => {
    expect(migration).toMatch(
      /ADD CONSTRAINT "license_code_claims_user_id_fkey"[\s\S]*?ON DELETE SET NULL ON UPDATE CASCADE/,
    );
    expect(migration).toMatch(
      /ADD CONSTRAINT "license_code_claims_released_by_id_fkey"[\s\S]*?ON DELETE SET NULL ON UPDATE CASCADE/,
    );
  });

  it("models printed-label attribution as a history-preserving relation", () => {
    expect(schema).toMatch(
      /bulkUnitLabelsPrinted\s+BulkSkuUnit\[\]\s+@relation\("BulkUnitLabelPrintedBy"\)/,
    );
    expect(schema).toMatch(
      /labelPrintedBy\s+User\?\s+@relation\("BulkUnitLabelPrintedBy", fields: \[labelPrintedById\], references: \[id\], onDelete: SetNull\)/,
    );
    expect(migration).toContain("orphaned label_printed_by_id values exist");
    expect(migration).toMatch(
      /ADD CONSTRAINT "bulk_sku_units_label_printed_by_id_fkey"[\s\S]*?ON DELETE SET NULL ON UPDATE CASCADE/,
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "bulk_sku_units_label_printed_by_id_idx"',
    );
  });

  it("enforces the application-owned inventory and scheduling invariants", () => {
    for (const constraint of [
      "bulk_skus_min_threshold_check",
      "bulk_stock_balances_on_hand_quantity_check",
      "bulk_sku_units_unit_number_check",
      "booking_bulk_items_quantity_check",
      "bookings_time_window_check",
      "sport_shift_configs_count_range_check",
    ]) {
      expect(migration).toContain(`ADD CONSTRAINT "${constraint}"`);
    }
    expect(migration).toContain(
      '"checked_in_quantity" <= "checked_out_quantity"',
    );
    expect(migration).toContain('"ends_at" > "starts_at"');
    expect(migration).toContain('"home_count" BETWEEN 0 AND 20');
  });

  it("keeps Prisma-inexpressible integrity in the empty-database bootstrap", () => {
    expect(emptyDatabaseBootstrap).toContain(
      "CREATE UNIQUE INDEX license_code_claims_one_active_per_user",
    );
    expect(emptyDatabaseBootstrap).not.toContain(
      "CREATE UNIQUE INDEX license_code_one_active_per_user",
    );
    for (const constraint of [
      "bulk_skus_min_threshold_check",
      "bulk_stock_balances_on_hand_quantity_check",
      "bulk_sku_units_unit_number_check",
      "booking_bulk_items_quantity_check",
      "bookings_time_window_check",
      "sport_shift_configs_count_range_check",
    ]) {
      expect(emptyDatabaseBootstrap).toContain(
        `ADD CONSTRAINT ${constraint}`,
      );
    }
  });

  it("keeps pull-request CI database-safe while retaining schema gates", () => {
    expect(ciWorkflow).toContain("- run: npx prisma validate");
    expect(ciWorkflow).toContain("- run: npm run db:migrate:check");
    expect(ciWorkflow).toContain("- run: npm run build:app");
    expect(ciWorkflow).not.toMatch(/- run: npm run build\s*(?:\n|$)/);
  });
});
