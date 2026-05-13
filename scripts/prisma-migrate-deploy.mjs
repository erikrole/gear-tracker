#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const blankSchemaEnginePattern = /Error:\s*Schema engine error:\s*$/m;

const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
});

if (deploy.status === 0) {
  process.stdout.write(deploy.stdout);
  process.stderr.write(deploy.stderr);
  process.exit(0);
}

const deployOutput = `${deploy.stdout ?? ""}${deploy.stderr ?? ""}`;
if (!blankSchemaEnginePattern.test(deployOutput)) {
  process.stdout.write(deploy.stdout ?? "");
  process.stderr.write(deploy.stderr ?? "");
  process.exit(deploy.status ?? 1);
}

process.stdout.write(deploy.stdout ?? "");
process.stderr.write(deploy.stderr ?? "");
console.warn(
  "Prisma schema engine failed without details; falling back to Neon HTTP migration apply.",
);

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DIRECT_URL or DATABASE_URL for Neon HTTP migration fallback.");
  process.exit(1);
}

const sql = neon(connectionString);

await ensureMigrationTable();

const appliedRows = await sql`
  SELECT migration_name
  FROM _prisma_migrations
  WHERE finished_at IS NOT NULL
    AND rolled_back_at IS NULL
`;
const applied = new Set(appliedRows.map((row) => row.migration_name));
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let appliedCount = 0;
for (const migrationName of migrations) {
  if (applied.has(migrationName)) continue;

  const migrationPath = join(migrationsDir, migrationName, "migration.sql");
  if (!existsSync(migrationPath)) {
    console.error(`Missing migration.sql for ${migrationName}`);
    process.exit(1);
  }

  const migrationSql = readFileSync(migrationPath, "utf8");
  const statements = splitSqlStatements(migrationSql);
  if (statements.length === 0) {
    await recordMigration(migrationName, migrationSql, 0);
    continue;
  }

  console.log(`Applying ${migrationName} via Neon HTTP fallback`);
  for (const statement of statements) {
    await sql.query(statement);
  }
  await recordMigration(migrationName, migrationSql, statements.length);
  appliedCount += 1;
}

if (appliedCount === 0) {
  console.log("Neon HTTP fallback found no pending migrations.");
} else {
  console.log(`Neon HTTP fallback applied ${appliedCount} migration(s).`);
}

async function ensureMigrationTable() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function recordMigration(migrationName, migrationSql, steps) {
  const checksum = createHash("sha256").update(migrationSql).digest("hex");
  const now = new Date().toISOString();
  await sql`
    INSERT INTO _prisma_migrations
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES
      (${randomUUID()}, ${checksum}, ${now}::timestamp, ${migrationName}, NULL, NULL, ${now}::timestamp, ${steps})
  `;
}

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        if (quote === "'" && next === "'") {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }

    if (char === "/" && next === "*") {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }

    if (char === "'" || char === '"') {
      current += char;
      quote = char;
      continue;
    }

    if (char === "$") {
      const tag = readDollarTag(source, index);
      if (tag) {
        current += tag;
        index += tag.length - 1;
        dollarTag = tag;
        continue;
      }
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

function readDollarTag(source, start) {
  const end = source.indexOf("$", start + 1);
  if (end === -1) return null;
  const tag = source.slice(start, end + 1);
  return /^\$[A-Za-z_][A-Za-z0-9_]*\$$|^\$\$$/.test(tag) ? tag : null;
}
