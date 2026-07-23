#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";
import { splitSqlStatements } from "./prisma-migrate-deploy.mjs";

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const allowedPreexistingTables = new Set(["_prisma_migrations"]);

const postgresOnlySql = `
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE asset_allocations
  ADD CONSTRAINT asset_allocations_no_overlap
  EXCLUDE USING gist (
    asset_id WITH =,
    tsrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (active = true);

CREATE UNIQUE INDEX license_code_claims_one_active_per_user
  ON license_code_claims(user_id)
  WHERE released_at IS NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX booking_bulk_unit_allocations_one_active_unit_key
  ON booking_bulk_unit_allocations(bulk_sku_unit_id)
  WHERE checked_out_at IS NOT NULL AND checked_in_at IS NULL;

ALTER TABLE bulk_skus
  ADD CONSTRAINT bulk_skus_min_threshold_check
  CHECK (min_threshold >= 0);

ALTER TABLE bulk_stock_balances
  ADD CONSTRAINT bulk_stock_balances_on_hand_quantity_check
  CHECK (on_hand_quantity >= 0);

ALTER TABLE bulk_sku_units
  ADD CONSTRAINT bulk_sku_units_unit_number_check
  CHECK (unit_number > 0);

ALTER TABLE booking_bulk_items
  ADD CONSTRAINT booking_bulk_items_quantity_check
  CHECK (
    planned_quantity > 0
    AND checked_out_quantity >= 0
    AND checked_in_quantity >= 0
    AND checked_out_quantity <= planned_quantity
    AND checked_in_quantity <= checked_out_quantity
  );

ALTER TABLE bookings
  ADD CONSTRAINT bookings_time_window_check
  CHECK (ends_at > starts_at);

ALTER TABLE sport_shift_configs
  ADD CONSTRAINT sport_shift_configs_count_range_check
  CHECK (
    home_count BETWEEN 0 AND 20
    AND away_count BETWEEN 0 AND 20
    AND home_staff_count BETWEEN 0 AND 20
    AND home_student_count BETWEEN 0 AND 20
    AND away_staff_count BETWEEN 0 AND 20
    AND away_student_count BETWEEN 0 AND 20
  );

CREATE INDEX IF NOT EXISTS assets_name_trgm_idx ON assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_brand_trgm_idx ON assets USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_model_trgm_idx ON assets USING gin (model gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_asset_tag_trgm_idx ON assets USING gin (asset_tag gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bookings_title_trgm_idx ON bookings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bookings_ref_number_trgm_idx ON bookings USING gin (ref_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin (name gin_trgm_ops);
`;

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function main() {
  if (process.env.EMPTY_DATABASE_BOOTSTRAP !== "confirm") {
    throw new Error("Refusing bootstrap: set EMPTY_DATABASE_BOOTSTRAP=confirm.");
  }

  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Missing DIRECT_URL.");

  const expectedHost = process.env.EMPTY_DATABASE_EXPECTED_HOST?.trim();
  if (!expectedHost) throw new Error("Missing EMPTY_DATABASE_EXPECTED_HOST.");
  const actualHost = new URL(connectionString).hostname;
  if (actualHost !== expectedHost) {
    throw new Error(`Refusing bootstrap: expected host ${expectedHost}, received ${actualHost}.`);
  }

  const sql = neon(connectionString);
  const existing = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  assertBootstrapSafe(existing.map((row) => row.tablename));

  const generated = generateBaselineSql();
  const bootstrapStatements = [
    ...splitSqlStatements(generated),
    ...splitSqlStatements(postgresOnlySql),
  ];
  await sql.transaction(bootstrapStatements.map((statement) => sql.query(statement)));

  await ensureMigrationTable(sql);
  await sql`DELETE FROM _prisma_migrations`;
  for (const migrationName of migrationNames()) {
    const migrationSql = readFileSync(join(migrationsDir, migrationName, "migration.sql"), "utf8");
    await recordMigration(sql, migrationName, migrationSql);
  }

  console.log(`Bootstrapped empty database at ${actualHost} with ${migrationNames().length} reconciled migrations.`);
}

export function assertBootstrapSafe(tableNames) {
  const unexpected = tableNames.filter((name) => !allowedPreexistingTables.has(name));
  if (unexpected.length > 0) {
    throw new Error(`Refusing bootstrap: target is not empty (${unexpected.join(", ")}).`);
  }
}

export function generateBaselineSql() {
  const result = spawnSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    { cwd: process.cwd(), env: process.env, encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Could not generate baseline SQL.\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function migrationNames() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function ensureMigrationTable(sql) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id VARCHAR(36) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function recordMigration(sql, migrationName, migrationSql) {
  const checksum = createHash("sha256").update(migrationSql).digest("hex");
  const now = new Date().toISOString();
  await sql`
    INSERT INTO _prisma_migrations
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES
      (${randomUUID()}, ${checksum}, ${now}::timestamp, ${migrationName}, NULL, NULL, ${now}::timestamp, 1)
  `;
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}
