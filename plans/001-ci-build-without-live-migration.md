# Plan 001: Make CI prove the production app build without live migration state

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- package.json .github/workflows/ci.yml docs/PRISMA_NEON_RUNBOOK.md AGENTS.md scripts/prisma-migrate-deploy.mjs prisma.config.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The GitHub CI build step is currently configured like a clean app-build check, but `npm run build` runs migration deploy first. In a CI environment without a live `DIRECT_URL`, the command fails before `next build` can prove the app compiles. The result is an unreliable gate: either CI is broken, or it must be given live migration credentials just to validate TypeScript and Next production build output.

## Current State

- `.github/workflows/ci.yml:22-29` runs audit, tests, then `npm run build` with `DATABASE_URL` and `SESSION_SECRET` only.
- `package.json:11` defines `"build": "node scripts/prisma-migrate-deploy.mjs && next build"`.
- `prisma.config.ts:4-9` points Prisma CLI at `env("DIRECT_URL")`.
- `scripts/prisma-migrate-deploy.mjs:46-50` exits if fallback migration deploy lacks `DIRECT_URL`.
- `docs/PRISMA_NEON_RUNBOOK.md:7-10` says `DIRECT_URL` is for Prisma CLI and migration deploys; runtime code uses `DATABASE_URL`.
- Advisor verification: a clean-env `npm run build` with only `DATABASE_URL` and `SESSION_SECRET` failed with `PrismaConfigEnvError: Missing required environment variable: DIRECT_URL`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Tests | `npm test` | exit 0, all tests pass |
| Migration folder check | `npm run db:migrate:check` | exit 0, reports migrations OK |
| App build check | `npm run build:app` | exit 0, Next build completes with placeholder env |
| Full build, only with real local env | `npm run build` | exit 0 when valid `DIRECT_URL` is available |

## Scope

**In scope**:
- `package.json`
- `.github/workflows/ci.yml`
- `docs/PRISMA_NEON_RUNBOOK.md`
- `AGENTS.md` only if its build guidance must distinguish app-build CI from migration deploy checks

**Out of scope**:
- Do not add real Neon secrets to CI.
- Do not weaken `scripts/prisma-migrate-deploy.mjs` fallback safety.
- Do not change Prisma schema or migrations.
- Do not remove migration deploy from the Vercel production build path unless the maintainer explicitly approves a deployment workflow change.

## Git Workflow

- Branch: `codex/001-ci-build-without-live-migration`
- Commit message: `fix: make CI validate app build without live migrations`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a migration-free app build script

Add a script to `package.json`:

```json
"build:app": "next build"
```

Keep `"build": "node scripts/prisma-migrate-deploy.mjs && next build"` unchanged so deployment behavior stays aligned with the runbook.

**Verify**: `node -e "const p=require('./package.json'); if (p.scripts['build:app'] !== 'next build') process.exit(1)"` -> exit 0.

### Step 2: Point CI at the app build script

Update `.github/workflows/ci.yml` so the CI build step runs `npm run build:app` with the existing placeholder `DATABASE_URL` and `SESSION_SECRET`. Keep `npm run db:migrate:check` in CI if it is not already present; it is the live-free migration validation this workflow can prove.

Do not set `DIRECT_URL` to a fake value for `npm run build`; that only changes the failure from "missing env var" to "cannot connect to database."

**Verify**: `rg -n "npm run build:app|db:migrate:check|npm run build" .github/workflows/ci.yml` -> shows `build:app`, shows `db:migrate:check`, and does not show CI invoking `npm run build`.

### Step 3: Update build docs

Update `docs/PRISMA_NEON_RUNBOOK.md` to state:

- `npm run build` remains the deploy-equivalent build and requires a real `DIRECT_URL`.
- `npm run build:app` is the migration-free Next production build used by CI.
- `npm run db:migrate:check` is the live-free migration folder sanity check.

If `AGENTS.md` still says every executor must always run `npm run build`, adjust it narrowly so web-only CI verification can use `npm run build:app` when no live migration URL is available, while deploy verification still uses `npm run build`.

**Verify**: `rg -n "build:app|DIRECT_URL|npm run build" docs/PRISMA_NEON_RUNBOOK.md AGENTS.md` -> the distinction is documented.

## Test Plan

- Existing tests only.
- Run the clean app-build path with no `DIRECT_URL`:

```bash
env -i PATH="$PATH" HOME="$HOME" DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" SESSION_SECRET="0000000000000000000000000000000000000000000000000000000000000000" npm run build:app
```

Expected: exit 0, Next production build completes. If Next requires other non-secret env placeholders, add them to the command and CI env explicitly.

## Done Criteria

- [x] `npx tsc --noEmit` exits 0.
- [x] `npm test` exits 0.
- [x] `npm run db:migrate:check` exits 0.
- [x] Clean-env `npm run build:app` exits 0 without `DIRECT_URL`.
- [x] `.github/workflows/ci.yml` no longer runs `npm run build` in PR CI.
- [x] `npm run build` remains available for environments with real `DIRECT_URL`.
- [x] `plans/README.md` status row updated.

## Review

- 2026-06-11: Added `build:app` as the migration-free Next production build while preserving `build` as the deploy-equivalent migration deploy plus app build.
- 2026-06-11: Updated CI to run `npm run db:migrate:check` and `npm run build:app` with placeholder runtime env instead of invoking live migration deploy.
- 2026-06-11: Updated Prisma/Neon and AGENTS guidance to distinguish deploy verification from live-free app-build verification.
- 2026-06-11 verification: `npx tsc --noEmit`, `npm test`, `npm run db:migrate:check`, CI/doc grep checks, deploy-build script check, and `DIRECT_URL="" npm run build:app` all exited 0.

## STOP Conditions

- `next build` itself requires a live database connection after migration deploy is removed from the command.
- The maintainer wants CI to validate live migration health with a protected Neon secret instead of a live-free app build.
- Fixing this requires editing deployment configuration outside this repo.

## Maintenance Notes

Reviewers should verify the split does not hide real deploy failures. CI should prove the app bundle, while deployment or a protected migration-health job proves live database migration state.
