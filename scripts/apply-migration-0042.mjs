#!/usr/bin/env node
/**
 * Apply migration 0042_booking_events via Neon's HTTP driver, bypassing
 * the native pg wire protocol (which is blocked from this workstation).
 *
 * Records the migration in _prisma_migrations so `prisma migrate deploy`
 * on Vercel later sees it as already applied.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import "dotenv/config";

const require = createRequire(import.meta.url);
const { neon } = require("@neondatabase/serverless");

const MIGRATION_NAME = "0042_booking_events";
const MIGRATION_PATH = new URL(
  `../prisma/migrations/${MIGRATION_NAME}/migration.sql`,
  import.meta.url,
);

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DIRECT_URL / DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
const checksum = createHash("sha256").update(migrationSql).digest("hex");

console.log(`Applying ${MIGRATION_NAME} (${migrationSql.length} bytes, sha256=${checksum.slice(0, 12)}…)`);

// Strip inline comments and split into statements by terminating semicolons.
// Simple splitter — adequate for this migration (no string literals contain ;).
function splitSql(text) {
  const stripped = text
    .split("\n")
    .map((line) => {
      // Drop leading -- comments on their own lines, keep trailing-of-statement text.
      const trimmed = line.trimStart();
      if (trimmed.startsWith("--")) return "";
      return line;
    })
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Check prior state
const existing = await sql`
  SELECT id, finished_at, rolled_back_at
  FROM _prisma_migrations
  WHERE migration_name = ${MIGRATION_NAME}
`;
if (existing.length > 0) {
  const row = existing[0];
  // If a prior attempt left a bogus "finished" row but the table doesn't exist,
  // clean it up so we can re-run cleanly.
  const tableCheck = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'booking_events'
  `;
  const tableExists = tableCheck.length > 0;
  if (row.finished_at && !row.rolled_back_at && tableExists) {
    console.log(`✓ Already applied at ${row.finished_at}. Nothing to do.`);
    process.exit(0);
  }
  console.log(`⚠ Existing row found but table ${tableExists ? "exists" : "is missing"} — removing row to re-apply.`);
  await sql`DELETE FROM _prisma_migrations WHERE migration_name = ${MIGRATION_NAME}`;
}

const statements = splitSql(migrationSql);
console.log(`Executing ${statements.length} statements…`);

for (const [i, stmt] of statements.entries()) {
  const preview = stmt.split("\n")[0].slice(0, 80);
  console.log(`  [${i + 1}/${statements.length}] ${preview}…`);
  try {
    await sql.query(stmt);
  } catch (err) {
    console.error(`✗ Failed on statement ${i + 1}:`);
    console.error(err.message);
    process.exit(1);
  }
}

// Record the migration in _prisma_migrations so future `prisma migrate deploy`
// runs see it as already applied.
const migrationId = crypto.randomUUID();
const now = new Date().toISOString();

await sql`
  INSERT INTO _prisma_migrations
    (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES
    (${migrationId}, ${checksum}, ${now}::timestamp, ${MIGRATION_NAME},
     NULL, NULL, ${now}::timestamp, ${statements.length})
`;

console.log(`✓ Migration ${MIGRATION_NAME} applied (${statements.length} statements) and recorded.`);
