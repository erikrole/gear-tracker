#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const MIGRATION_NAME = "0061_add_guide_freshness";
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

const columnsExist = async () => {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guides'
      AND column_name IN ('last_verified_at', 'last_verified_by_id')
  `;
  return rows.length === 2;
};

if (existing.length > 0) {
  if (existing[0].finished_at && !existing[0].rolled_back_at && await columnsExist()) {
    console.log(`${MIGRATION_NAME} already applied`);
    process.exit(0);
  }
  console.error(`${MIGRATION_NAME} has an inconsistent migration row; inspect _prisma_migrations before retrying.`);
  process.exit(1);
}

if (!await columnsExist()) {
  const statements = [
    `ALTER TABLE "guides"
      ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "last_verified_by_id" TEXT`,
    `CREATE INDEX IF NOT EXISTS "guides_last_verified_at_idx" ON "guides"("last_verified_at")`,
    `CREATE INDEX IF NOT EXISTS "guides_last_verified_by_id_idx" ON "guides"("last_verified_by_id")`,
    `DO $$
    BEGIN
      ALTER TABLE "guides"
        ADD CONSTRAINT "guides_last_verified_by_id_fkey"
        FOREIGN KEY ("last_verified_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$`,
  ];

  for (const statement of statements) {
    await sql.query(statement);
  }
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
