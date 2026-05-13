import { describe, expect, it } from "vitest";

// The health checker is a plain ESM Node script, but the comparison logic is exported for tests.
// @ts-expect-error no declaration file for local .mjs script modules
import { evaluateMigrationHealth } from "../scripts/prisma-migrate-health.mjs";

const localMigrations = [
  "0063_allow_manual_calendar_events_source_null",
  "0064_add_kiosk_session_expiry",
  "0065_add_booking_completed_at",
];

describe("evaluateMigrationHealth", () => {
  it("passes when every local migration is applied in Neon", () => {
    const health = evaluateMigrationHealth(localMigrations, [
      applied("0063_allow_manual_calendar_events_source_null"),
      applied("0064_add_kiosk_session_expiry"),
      applied("0065_add_booking_completed_at"),
    ]);

    expect(health.ok).toBe(true);
    expect(health.pending).toEqual([]);
    expect(health.unresolvedFailed).toEqual([]);
    expect(health.appliedDbOnly).toEqual([]);
    expect(health.newestLocalApplied).toBe(true);
  });

  it("fails when a local migration is pending", () => {
    const health = evaluateMigrationHealth(localMigrations, [
      applied("0063_allow_manual_calendar_events_source_null"),
      applied("0064_add_kiosk_session_expiry"),
    ]);

    expect(health.ok).toBe(false);
    expect(health.pending).toEqual(["0065_add_booking_completed_at"]);
    expect(health.newestLocalApplied).toBe(false);
  });

  it("fails when Neon has an unresolved failed migration row", () => {
    const health = evaluateMigrationHealth(localMigrations, [
      applied("0063_allow_manual_calendar_events_source_null"),
      failed("0064_add_kiosk_session_expiry"),
      applied("0065_add_booking_completed_at"),
    ]);

    expect(health.ok).toBe(false);
    expect(health.pending).toEqual(["0064_add_kiosk_session_expiry"]);
    expect(health.unresolvedFailed).toEqual(["0064_add_kiosk_session_expiry"]);
  });

  it("fails when Neon has an applied migration missing from the repo", () => {
    const health = evaluateMigrationHealth(localMigrations, [
      applied("0063_allow_manual_calendar_events_source_null"),
      applied("0064_add_kiosk_session_expiry"),
      applied("0065_add_booking_completed_at"),
      applied("0066_missing_locally"),
    ]);

    expect(health.ok).toBe(false);
    expect(health.appliedDbOnly).toEqual(["0066_missing_locally"]);
  });

  it("ignores rolled-back rows as applied migration history", () => {
    const health = evaluateMigrationHealth(localMigrations, [
      applied("0063_allow_manual_calendar_events_source_null"),
      rolledBack("0064_add_kiosk_session_expiry"),
      applied("0065_add_booking_completed_at"),
    ]);

    expect(health.ok).toBe(false);
    expect(health.pending).toEqual(["0064_add_kiosk_session_expiry"]);
    expect(health.rolledBack).toEqual(["0064_add_kiosk_session_expiry"]);
  });
});

function applied(migrationName: string) {
  return {
    migration_name: migrationName,
    finished_at: new Date("2026-05-12T12:00:00.000Z"),
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

function rolledBack(migrationName: string) {
  return {
    migration_name: migrationName,
    finished_at: null,
    rolled_back_at: new Date("2026-05-12T12:00:00.000Z"),
    applied_steps_count: 0,
  };
}
