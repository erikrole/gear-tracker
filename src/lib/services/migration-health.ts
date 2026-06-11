import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type MigrationHistoryRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at?: Date | string | null;
  applied_steps_count?: number | null;
};

export type MigrationHealth = {
  ok: boolean;
  problems: string[];
  localCount: number;
  appliedLocalCount: number;
  appliedDbOnly: string[];
  pending: string[];
  unresolvedFailed: string[];
  rolledBack: string[];
  newestLocal: string | null;
  newestLocalApplied: boolean;
};

export type MigrationDiagnosticsChecks = {
  migrationTable: {
    exists: boolean;
  };
  migrationHealth: MigrationHealth;
  tables: {
    present?: string[];
    missing: string[];
    extra?: string[];
  };
  enums: {
    present?: string[];
    missing: string[];
  };
  extensions: {
    present?: string[];
    missing: string[];
  };
  columns: {
    drift: { table: string; column: string; status: string }[];
  };
};

const migrationsDir = join(process.cwd(), "prisma", "migrations");

export function readLocalMigrations() {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function evaluateMigrationHealth(
  localMigrations: string[],
  migrationRows: MigrationHistoryRow[],
): MigrationHealth {
  const appliedNames = new Set<string>();
  const unresolvedFailed: string[] = [];
  const rolledBack: string[] = [];

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

  const problems: string[] = [];
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

export function buildMigrationHealthRemediation(checks: MigrationDiagnosticsChecks) {
  const steps: string[] = [];

  if (!checks.migrationTable.exists) {
    steps.push(
      'The _prisma_migrations table does not exist. Run "npx prisma migrate deploy" or create it manually (see docs).',
    );
  } else if (!checks.migrationHealth.ok) {
    if (checks.migrationHealth.pending.length > 0) {
      steps.push(
        `Migrations not yet applied: ${checks.migrationHealth.pending.join(", ")}. Run "npx prisma migrate deploy".`,
      );
    }
    if (checks.migrationHealth.unresolvedFailed.length > 0) {
      steps.push(
        `Unresolved failed migration rows: ${checks.migrationHealth.unresolvedFailed.join(", ")}. Inspect _prisma_migrations before retrying.`,
      );
    }
    if (checks.migrationHealth.appliedDbOnly.length > 0) {
      steps.push(
        `Applied database migrations missing locally: ${checks.migrationHealth.appliedDbOnly.join(", ")}. Reconcile the missing migration folders before shipping.`,
      );
    }
    if (!checks.migrationHealth.newestLocalApplied && checks.migrationHealth.newestLocal) {
      steps.push(
        `Newest local migration is not applied: ${checks.migrationHealth.newestLocal}. Run "npx prisma migrate deploy".`,
      );
    }
    if (checks.migrationHealth.rolledBack.length > 0) {
      steps.push(
        `Rolled-back migration rows found: ${checks.migrationHealth.rolledBack.join(", ")}. Confirm matching replacement migrations are applied.`,
      );
    }
    if (
      steps.length === 0 &&
      checks.migrationHealth.problems.length > 0
    ) {
      steps.push(
        `Migration health failed: ${checks.migrationHealth.problems.join("; ")}.`,
      );
    }
  }

  if (checks.migrationTable.exists && checks.migrationHealth.localCount === 0) {
    steps.push(
      "No local Prisma migration folders were found. Ensure prisma/migrations is included in the deployment bundle.",
    );
  }

  return steps;
}

export function isMigrationDiagnosticsHealthy(checks: MigrationDiagnosticsChecks) {
  return (
    checks.migrationTable.exists &&
    checks.migrationHealth.ok &&
    checks.tables.missing.length === 0 &&
    checks.enums.missing.length === 0 &&
    checks.extensions.missing.length === 0 &&
    checks.columns.drift.length === 0
  );
}
