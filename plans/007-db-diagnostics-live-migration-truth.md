# Plan 007: Make database diagnostics use live migration truth

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- src/app/api/db-diagnostics/route.ts scripts/prisma-migrate-health.mjs 'src/app/(app)/settings/database/page.tsx' docs/AREA_SETTINGS.md docs/PRISMA_NEON_RUNBOOK.md tests`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-ci-build-without-live-migration.md for easier build verification
- **Category**: correctness
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The Database Health page is supposed to tell admins whether the database schema matches Prisma migrations. The API route has hard-coded expected migrations only through `0030`, while the repo currently has 75 local migrations through `0074_student_availability_ad_hoc`. A database missing later migrations can be reported healthy because the route does not compare against the live local migration directory the way `npm run db:migrate:health` does.

## Current State

- `src/app/api/db-diagnostics/route.ts:90-122` hard-codes `EXPECTED_MIGRATIONS` through `0030_add_sport_call_times`.
- `src/app/api/db-diagnostics/route.ts:230-234` only reports migrations missing from that frozen list.
- `src/app/api/db-diagnostics/route.ts:296-302` marks diagnostics healthy when the frozen checks pass.
- `prisma/migrations/` currently contains 75 migration folders, ending at `0074_student_availability_ad_hoc`.
- `scripts/prisma-migrate-health.mjs:49-53` reads local migrations from `prisma/migrations` dynamically.
- `scripts/prisma-migrate-health.mjs:56-102` evaluates pending local migrations, unresolved failed rows, DB-only migrations, and newest-local-applied status.
- `docs/PRISMA_NEON_RUNBOOK.md:22-27` names `db:migrate:health` as the repo source of truth.
- `src/app/(app)/settings/database/page.tsx:67-68` tells admins the page checks the database schema against expected Prisma migrations.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npm test -- db-diagnostics` if a matching test exists, otherwise the new diagnostics test file | exit 0 |
| Migration health unit tests | `npx vitest run tests/prisma-migrate-health.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Full tests | `npm test` | exit 0 |
| Build check | `npm run build:app` if Plan 001 has landed, otherwise `npm run build` with valid local env | exit 0 |

## Scope

**In scope**:
- `src/app/api/db-diagnostics/route.ts`
- `scripts/prisma-migrate-health.mjs` only if shared helpers need to be exported or moved
- New or existing tests covering `/api/db-diagnostics`
- `src/app/(app)/settings/database/page.tsx` only if the response shape changes additively
- `docs/AREA_SETTINGS.md`
- `docs/PRISMA_NEON_RUNBOOK.md` only if diagnostics behavior needs a note

**Out of scope**:
- Do not introduce a new migration.
- Do not use `$queryRawUnsafe` with dynamic user input.
- Do not make the admin diagnostics route depend on a shelling-out child process.
- Do not expose secret connection strings or raw database errors to the browser.

## Git Workflow

- Branch: `codex/007-db-diagnostics-live-migration-truth`
- Commit message: `fix: make database diagnostics detect migration drift`

## Steps

### Step 1: Replace frozen migration expectations

Remove the hard-coded `EXPECTED_MIGRATIONS` list from `src/app/api/db-diagnostics/route.ts`. Read local migration names from `prisma/migrations` at runtime or move the reusable read/evaluate helpers from `scripts/prisma-migrate-health.mjs` into a shared module that both the script and route can call.

The route must compare:

- local migration folders
- applied `_prisma_migrations` rows
- pending local migrations
- unresolved failed rows
- DB-only applied migrations
- newest local migration applied

Match the semantics of `evaluateMigrationHealth` in `scripts/prisma-migrate-health.mjs`.

**Verify**: `npx vitest run tests/prisma-migrate-health.test.ts` -> exit 0.

### Step 2: Preserve the current admin response while adding migration health

Keep existing fields that the settings page reads:

```ts
checks.migrationTable
checks.tables
checks.enums
checks.extensions
checks.columns
remediation
ok
```

Add a migration-health field if needed, for example:

```ts
checks.migrationHealth = {
  localCount,
  appliedLocalCount,
  pending,
  appliedDbOnly,
  unresolvedFailed,
  newestLocal,
  newestLocalApplied
}
```

Set `ok` to false when migration health is not ok.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 3: Add focused diagnostics tests

Create a route or helper test that proves:

- When local migrations include `0074_student_availability_ad_hoc` and DB rows stop at `0030_add_sport_call_times`, diagnostics returns `ok: false`.
- Pending local migrations appear in remediation.
- DB-only applied migrations appear in remediation.
- The route does not mark extra unknown tables as a hard failure unless current behavior intentionally changes.

Mock database calls rather than requiring live Neon.

**Verify**: focused diagnostics test command exits 0.

### Step 4: Update settings docs

Update `docs/AREA_SETTINGS.md` to say Database Health now uses the same local-vs-applied migration truth as `db:migrate:health`, rather than a frozen expected list.

If the UI response shape changed, update `src/app/(app)/settings/database/page.tsx` to render the added migration-health summary without removing existing tables.

**Verify**: `rg -n "db:migrate:health|migration health|Database Health" docs/AREA_SETTINGS.md 'src/app/(app)/settings/database/page.tsx'` -> shows current behavior.

## Test Plan

- New diagnostics route/helper tests for stale DB migration rows.
- Existing `tests/prisma-migrate-health.test.ts`.
- Full Vitest suite.
- Typecheck and build gate.

## Done Criteria

- [x] `/api/db-diagnostics` no longer has a hard-coded migration list ending at `0030`.
- [x] Diagnostics returns `ok: false` when local migrations are pending.
- [x] Diagnostics returns `ok: false` when applied DB migrations are missing locally or unresolved failed rows exist.
- [x] The settings page remains compatible with the response.
- [x] `npx vitest run tests/prisma-migrate-health.test.ts` exits 0.
- [x] Focused diagnostics tests exit 0.
- [x] `npx tsc --noEmit` exits 0.
- [x] `npm test` exits 0.
- [x] Build check exits 0.
- [x] `plans/README.md` status row updated.

## Review

- Completed 2026-06-11 on branch `codex/007-db-diagnostics-live-migration-truth`.
- `/api/db-diagnostics` now reads local migration folders from `prisma/migrations`, compares them with live `_prisma_migrations` rows, and marks diagnostics unhealthy for pending local migrations, unresolved failed rows, DB-only applied rows, or a newest local migration that is not applied.
- Added `src/lib/services/migration-health.ts` for the app route's migration-health comparison and remediation helpers. The CLI script's existing behavior is unchanged and remains covered by `tests/prisma-migrate-health.test.ts`.
- Added a Database Health summary on `/settings/database` while preserving the existing `checks.migrationTable`, `tables`, `enums`, `extensions`, `columns`, `remediation`, and `ok` response shape.
- Added `outputFileTracingIncludes` for `/api/db-diagnostics` and verified `.next/server/app/api/db-diagnostics/route.js.nft.json` includes `prisma/migrations/*/migration.sql`.
- Verification: `npx vitest run tests/db-diagnostics.test.ts tests/prisma-migrate-health.test.ts`, `npx tsc --noEmit`, `npm test` (197 files, 1157 tests), `npm run build:app`, and `git diff --check` all passed.

## STOP Conditions

- The route cannot safely read `prisma/migrations` in the deployed serverless runtime.
- Sharing logic with `scripts/prisma-migrate-health.mjs` would require converting too much script-only code into app code.
- A live database check is required to validate behavior and no safe test double can cover the route.

## Maintenance Notes

Reviewers should reject any replacement that just updates the hard-coded list to `0074`. The point is to remove manual drift from the diagnostics surface.
