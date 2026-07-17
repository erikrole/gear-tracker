# Plan 058: Remove the obsolete hand-written database setup path

> **Executor instructions**: Follow every step and verification gate. Stop on any STOP condition. Update plan 058 in `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat 189ea5ab..HEAD -- package.json package-lock.json scripts/setup-db.mjs scripts/setup-db.sql scripts/bootstrap-empty-database.mjs tests/bootstrap-empty-database.test.ts docs/PRISMA_NEON_RUNBOOK.md docs/CODEMAPS/dependencies.md`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `189ea5ab`, 2026-07-16

## Why this matters

`db:setup` creates a hand-written, outdated subset of the database and seeds an administrative account. Its enum definitions already omit current values such as `COLLABORATOR` and `PENDING_PICKUP`, while hundreds of current schema fields and tables are absent. The guarded `db:bootstrap:empty` command generates the baseline from `prisma/schema.prisma`, restores PostgreSQL-only constraints, and is the documented empty-database path. Keeping both creates a dangerous false choice and three schema representations to maintain.

## Current state

- `package.json` exposes `db:setup` and `db:bootstrap:empty`.
- `scripts/setup-db.mjs:20-49` manually defines old enums.
- `scripts/setup-db.mjs:53-265` and `scripts/setup-db.sql` manually duplicate old DDL.
- `scripts/setup-db.mjs:286-315` seeds an administrative user and should not remain as an undocumented setup shortcut.
- `scripts/bootstrap-empty-database.mjs:74-88` derives baseline SQL from the current Prisma schema and records migration checksums.
- `docs/PRISMA_NEON_RUNBOOK.md:47-58` documents only the guarded bootstrap for isolated empty environments.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/bootstrap-empty-database.test.ts` | all pass |
| Migration structure | `npm run db:migrate:check` | exits 0 |
| Prisma schema | `npx prisma validate` | schema valid |
| Typecheck | `npx tsc --noEmit --pretty false` | exits 0 |
| Docs | `npm run codemap && npm run verify:docs` | generated dependency map no longer lists `db:setup`; exits 0 |

## Scope

**In scope**:

- Delete `scripts/setup-db.mjs`
- Delete `scripts/setup-db.sql`
- Remove `db:setup` from `package.json`
- Refresh `package-lock.json` only if npm changes the root package metadata
- Regenerate `docs/CODEMAPS/dependencies.md`
- Update `docs/PRISMA_NEON_RUNBOOK.md` only if a short explicit warning about the retired command is useful

**Out of scope**:

- `scripts/bootstrap-empty-database.mjs` behavior
- Prisma schema or migration SQL
- Migration squashing, baseline replacement, or production migration history edits
- Seed behavior in `prisma/seed.mjs`
- Running any command that connects to or mutates Neon

## Git workflow

- Suggested branch: `codex/058-remove-obsolete-db-setup`
- Commit if requested: `chore: remove obsolete database setup path`
- Do not run `npm run build`, `db:migrate:deploy`, `db:migrate:health`, or the bootstrap command.

## Steps

### Step 1: Prove the path has no live consumers

Run:

```bash
rg -n 'db:setup|setup-db\.mjs|setup-db\.sql' . --glob '!node_modules/**' --glob '!.git/**'
```

Expected before deletion: only `package.json`, the two setup files themselves, and the generated dependency codemap. If any active runbook, workflow, test, or script calls it, STOP and report the consumer.

### Step 2: Remove the obsolete surface

Delete both setup files and remove the `db:setup` script. Do not alter `db:bootstrap:empty`, `db:seed`, migration deploy, or migration health commands.

**Verify**: `rg -n 'db:setup|setup-db\.mjs|setup-db\.sql' package.json scripts docs .github --glob '!docs/CODEMAPS/dependencies.md'` → no matches.

### Step 3: Refresh generated documentation

Run `npm run codemap`, then `npm run verify:docs`. Inspect the diff and confirm only the retired command/file references disappear.

### Step 4: Run safe schema gates

Run the focused bootstrap unit test, migration prefix check, Prisma validation, TypeScript, and `git diff --check`. None of these should connect to or mutate a live database.

## Test plan

- Keep `tests/bootstrap-empty-database.test.ts` unchanged unless a stale comment mentions the removed setup path.
- The removal is proven by repository reference sweeps plus the existing guarded-bootstrap tests.
- Do not add a source-text test whose only purpose is to assert that deleted files remain deleted.

## Done criteria

- [ ] `db:setup`, `scripts/setup-db.mjs`, and `scripts/setup-db.sql` are gone.
- [ ] The guarded schema-derived bootstrap remains unchanged and tested.
- [ ] No active file references the removed path.
- [ ] Safe schema, type, docs, and diff gates pass.
- [ ] No live database command was run.
- [ ] Plan 058 status is updated.

## STOP conditions

- Any active automation or non-generated runbook invokes the old path.
- Removal appears to require changing Prisma migrations or bootstrap semantics.
- A command requests a real database connection.
- Verification fails twice.

## Maintenance notes

There should be one supported isolated-empty-database path: the guarded schema-derived bootstrap. Normal environments must continue using incremental migrations.

