#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const MIGRATION_NAME = "0060_add_user_slack_profile_url";
const migrationPath = new URL(
  `../prisma/migrations/${MIGRATION_NAME}/migration.sql`,
  import.meta.url,
);

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DIRECT_URL / DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);
const migrationSql = readFileSync(migrationPath, "utf8");
const checksum = createHash("sha256").update(migrationSql).digest("hex");

const existing = await sql`
  SELECT id, finished_at, rolled_back_at
  FROM _prisma_migrations
  WHERE migration_name = ${MIGRATION_NAME}
`;

const columnExists = async () => {
  const rows = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'slack_profile_url'
  `;
  return rows.length > 0;
};

if (existing.length > 0) {
  if (existing[0].finished_at && !existing[0].rolled_back_at && await columnExists()) {
    console.log(`${MIGRATION_NAME} already applied`);
    process.exit(0);
  }
  console.error(`${MIGRATION_NAME} has an inconsistent migration row; inspect _prisma_migrations before retrying.`);
  process.exit(1);
}

if (!await columnExists()) {
  await sql.query(migrationSql);
}

const now = new Date().toISOString();
await sql`
  INSERT INTO _prisma_migrations
    (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES
    (${randomUUID()}, ${checksum}, ${now}::timestamp, ${MIGRATION_NAME},
     NULL, NULL, ${now}::timestamp, 1)
`;

console.log(`${MIGRATION_NAME} applied and recorded`);
