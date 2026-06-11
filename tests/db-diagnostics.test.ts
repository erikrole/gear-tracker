import { describe, expect, it } from "vitest";

import {
  buildMigrationHealthRemediation,
  evaluateMigrationHealth,
  isMigrationDiagnosticsHealthy,
  type MigrationDiagnosticsChecks,
  type MigrationHealth,
} from "@/lib/services/migration-health";

const localMigrations = [
  "0001_manual_constraints",
  "0030_add_sport_call_times",
  "0074_student_availability_ad_hoc",
];

describe("db diagnostics migration health", () => {
  it("fails when the database only has old applied migrations", () => {
    const migrationHealth = evaluateMigrationHealth(localMigrations, [
      applied("0001_manual_constraints"),
      applied("0030_add_sport_call_times"),
    ]);
    const checks = healthyChecks({ migrationHealth });

    expect(isMigrationDiagnosticsHealthy(checks)).toBe(false);
    expect(migrationHealth.pending).toEqual(["0074_student_availability_ad_hoc"]);
    expect(buildMigrationHealthRemediation(checks)).toContain(
      'Migrations not yet applied: 0074_student_availability_ad_hoc. Run "npx prisma migrate deploy".',
    );
  });

  it("fails when applied database migrations are missing locally", () => {
    const migrationHealth = evaluateMigrationHealth(localMigrations, [
      applied("0001_manual_constraints"),
      applied("0030_add_sport_call_times"),
      applied("0074_student_availability_ad_hoc"),
      applied("9999_manual_hotfix_missing_locally"),
    ]);
    const checks = healthyChecks({ migrationHealth });

    expect(isMigrationDiagnosticsHealthy(checks)).toBe(false);
    expect(migrationHealth.appliedDbOnly).toEqual(["9999_manual_hotfix_missing_locally"]);
    expect(buildMigrationHealthRemediation(checks)).toContain(
      "Applied database migrations missing locally: 9999_manual_hotfix_missing_locally. Reconcile the missing migration folders before shipping.",
    );
  });

  it("fails when migration history has unresolved failed rows", () => {
    const migrationHealth = evaluateMigrationHealth(localMigrations, [
      applied("0001_manual_constraints"),
      failed("0030_add_sport_call_times"),
      applied("0074_student_availability_ad_hoc"),
    ]);
    const checks = healthyChecks({ migrationHealth });

    expect(isMigrationDiagnosticsHealthy(checks)).toBe(false);
    expect(migrationHealth.unresolvedFailed).toEqual(["0030_add_sport_call_times"]);
    expect(buildMigrationHealthRemediation(checks)).toContain(
      "Unresolved failed migration rows: 0030_add_sport_call_times. Inspect _prisma_migrations before retrying.",
    );
  });

  it("does not fail only because unknown tables exist", () => {
    const migrationHealth = evaluateMigrationHealth(localMigrations, [
      applied("0001_manual_constraints"),
      applied("0030_add_sport_call_times"),
      applied("0074_student_availability_ad_hoc"),
    ]);
    const checks = healthyChecks({
      migrationHealth,
      tables: {
        present: ["users"],
        missing: [],
        extra: ["postgis_metadata"],
      },
    });

    expect(isMigrationDiagnosticsHealthy(checks)).toBe(true);
    expect(buildMigrationHealthRemediation(checks)).toEqual([]);
  });
});

function healthyChecks(overrides: Partial<MigrationDiagnosticsChecks> = {}): MigrationDiagnosticsChecks {
  return {
    migrationTable: {
      exists: true,
    },
    migrationHealth: healthyMigrationHealth(),
    tables: {
      present: ["users"],
      missing: [],
      extra: [],
    },
    enums: {
      present: ["Role"],
      missing: [],
    },
    extensions: {
      present: ["btree_gist"],
      missing: [],
    },
    columns: {
      drift: [],
    },
    ...overrides,
  };
}

function healthyMigrationHealth(): MigrationHealth {
  return {
    ok: true,
    problems: [],
    localCount: localMigrations.length,
    appliedLocalCount: localMigrations.length,
    appliedDbOnly: [],
    pending: [],
    unresolvedFailed: [],
    rolledBack: [],
    newestLocal: localMigrations.at(-1) ?? null,
    newestLocalApplied: true,
  };
}

function applied(migrationName: string) {
  return {
    migration_name: migrationName,
    finished_at: new Date("2026-06-10T12:00:00.000Z"),
    rolled_back_at: null,
    applied_steps_count: 1,
  };
}

function failed(migrationName: string) {
  return {
    migration_name: migrationName,
    finished_at: null,
    rolled_back_at: null,
    applied_steps_count: 0,
  };
}
