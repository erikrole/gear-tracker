#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const migrationsDir = join(process.cwd(), "prisma", "migrations");

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("Missing DIRECT_URL for Prisma migration health inspection.");
    process.exit(1);
  }

  if (!existsSync(migrationsDir)) {
    console.error(`Missing migrations directory: ${migrationsDir}`);
    process.exit(1);
  }

  const localMigrations = readLocalMigrations();
  const sql = neon(connectionString);
  const migrationRows = await sql`
    SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
    FROM _prisma_migrations
    ORDER BY migration_name ASC, started_at ASC
  `;

  const health = evaluateMigrationHealth(localMigrations, migrationRows);
  printHealthReport(health);

  if (!health.ok) {
    process.exit(1);
  }
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function readLocalMigrations() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function evaluateMigrationHealth(localMigrations, migrationRows) {
  const appliedNames = new Set();
  const unresolvedFailed = [];
  const rolledBack = [];

  for (const row of migrationRows) {
    const migrationName = row.migration_name;
    if (row.rolled_back_at) {
      rolledBack.push(migrationName);
      continue;
    }

    if (row.finished_at) {
      appliedNames.add(migrationName);
      continue;
    }

    unresolvedFailed.push(migrationName);
  }

  const localSet = new Set(localMigrations);
  const pending = localMigrations.filter((migrationName) => !appliedNames.has(migrationName));
  const appliedDbOnly = [...appliedNames].filter((migrationName) => !localSet.has(migrationName)).sort();
  const newestLocal = localMigrations.at(-1) ?? null;
  const newestLocalApplied = newestLocal ? appliedNames.has(newestLocal) : true;
  const appliedLocalCount = localMigrations.filter((migrationName) =>
    appliedNames.has(migrationName),
  ).length;

  const problems = [];
  if (pending.length > 0) problems.push(`${pending.length} pending local migration(s)`);
  if (unresolvedFailed.length > 0) problems.push(`${unresolvedFailed.length} unresolved failed migration row(s)`);
  if (appliedDbOnly.length > 0) problems.push(`${appliedDbOnly.length} applied DB migration(s) missing locally`);
  if (!newestLocalApplied) problems.push(`newest local migration is not applied: ${newestLocal}`);

  return {
    ok: problems.length === 0,
    problems,
    localCount: localMigrations.length,
    appliedLocalCount,
    appliedDbOnly,
    pending,
    unresolvedFailed,
    rolledBack,
    newestLocal,
    newestLocalApplied,
  };
}

function printHealthReport(health) {
  console.log("Prisma migration health");
  console.log(`Local migrations: ${health.localCount}`);
  console.log(`Applied local migrations: ${health.appliedLocalCount}/${health.localCount}`);
  console.log(
    `Newest local migration: ${health.newestLocal ?? "none"} (${health.newestLocalApplied ? "applied" : "missing"})`,
  );

  printList("Pending local migrations", health.pending);
  printList("Unresolved failed rows", health.unresolvedFailed);
  printList("Applied DB-only migrations", health.appliedDbOnly);
  printList("Rolled-back rows", health.rolledBack);

  if (health.ok) {
    console.log("OK: local Prisma migrations match Neon migration history.");
    return;
  }

  console.error(`FAIL: ${health.problems.join("; ")}.`);
}

function printList(label, values) {
  if (values.length === 0) {
    console.log(`${label}: none`);
    return;
  }

  console.log(`${label}:`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}
