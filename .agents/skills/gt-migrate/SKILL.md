---
name: gt-migrate
description: Canonical Gear Tracker Prisma and Neon workflow for schema design, migration creation or review, database constraints and indexes, manual-schema reconciliation, empty-database bootstrap parity, migration drift or failure diagnosis, CI migration safety, and explicitly authorized deployment or recovery. Use whenever work touches prisma/schema.prisma, prisma/migrations, Prisma-inexpressible PostgreSQL objects, Neon migration history, or deploy-shaped builds. Supersedes prisma-migrate-safely.
---

# GT Migrate

Use the repository's Prisma and Neon tooling. Treat schema editing, migration
creation, live inspection, deployment, and recovery as separate permissions.

## Establish state

1. Read `AGENTS.md`, `docs/NORTH_STAR.md`, `tasks/INDEX.md`, `tasks/todo.md`,
   `tasks/lessons.md`, `git status --short`, and the active task ledger before
   editing. Preserve unrelated dirty work and recheck status before closeout.
2. Classify the request:
   - **Design or audit:** read-only unless the user also requests implementation.
   - **Create or revise a migration:** local file changes only.
   - **Drift or health diagnosis:** read-only live inspection.
   - **Deploy or recover:** live mutation requiring explicit authorization and
     an exact target.
3. Read `prisma/schema.prisma` completely for schema work. Also read
   `prisma.config.ts`, relevant `package.json` scripts,
   `docs/PRISMA_NEON_RUNBOOK.md`, and the active plan.
4. Read the owning `docs/AREA_*.md` or `docs/BRIEF_*.md`, relevant decisions and
   gaps, direct service/API consumers, focused tests, and adjacent migrations.
5. For migration SQL, also inspect `scripts/prisma-migrate-deploy.mjs`,
   `scripts/prisma-migrate-health.mjs`, `scripts/bootstrap-empty-database.mjs`,
   and migration-prefix checks. For deploy or recovery, inspect live health
   before proposing a mutation.

Do not print connection strings or secrets. Resolve the intended database host
and environment without echoing credentials. `DATABASE_URL` is the pooled
runtime connection; `DIRECT_URL` is the Prisma CLI, health, and migration
connection. Do not send DDL through the pooled runtime URL.

## Classify migration history

- **Applied in any in-scope environment:** immutable. Add a new corrective
  migration.
- **Local and confirmed unapplied everywhere in scope:** may be revised before
  deployment. Recheck health after long or concurrent work.
- **Attempted or failed in a target environment:** preserve the exact deployed
  artifact and checksum. Inspect partial effects before deciding whether to
  retry unchanged SQL or add a corrective migration; do not treat it as safely
  editable local work.
- **Applied in Neon but missing locally:** stop. Recover the exact migration
  directory and name from source history; do not rename or recreate it.
- **Manual database shape missing from migration history:** add an explicit,
  idempotent reconciliation migration. Preserve the provenance in docs; do not
  fabricate an old migration.
- **Failed, rolled-back, or checksum-sensitive history:** inspect the exact
  `_prisma_migrations` rows and SQL before acting. Never use `prisma migrate
  resolve` as a generic retry.

## Audit before editing

Record in the active plan:

- Touched models, enums, tables, columns, defaults, nullability, mappings,
  indexes, constraints, and relation names.
- `onDelete` and `onUpdate` behavior, especially for historical actor IDs.
- Existing manual SQL, PostgreSQL-only objects, bootstrap behavior, and migration
  provenance.
- Direct write paths, imports, repair scripts, native/API contracts, and current
  live row validity.
- Expected lock scope, row count, backfill cost, deployment order, rollback or
  stop conditions, and exact verification.

Prefer database uniqueness over race-prone prechecks. For new constraints,
preflight existing rows and confirm every write path already satisfies the
invariant.

## Implement

1. Make one coherent Prisma edit. Match sibling naming, `@map`, relation names,
   indexes, defaults, and deletion behavior.
2. Use the repository commands only against a disposable or explicitly
   designated development database:
   - Generate: `npm run db:migrate:new -- --name <feature>_<short_change>`
   - Create only: `npm run db:migrate:raw -- --name <feature>_<short_change>`
   Never point `prisma migrate dev` at production or a shared Neon branch to
   unblock generation.
3. If the historical chain prevents normal generation, do not switch to a live
   database. Use a controlled before/after `prisma migrate diff`, or author the
   smallest additive SQL with focused contract tests and record why.
4. Make reconciliation SQL retry-safe where practical because the Neon HTTP
   fallback applies statements individually:
   - Use guarded or idempotent shape changes when drift is expected.
   - Run data and orphan preflights before replacing constraints.
   - Keep related drop/add operations in one atomic SQL statement.
   - Create replacement integrity before dropping obsolete protection when
     ordering permits.
   - Add splitter coverage when SQL uses dollar-quoted blocks or other syntax
     handled specially by `splitSqlStatements`.
5. Keep long backfills out of migration deploy. Use a bounded, resumable script
   when work can exceed the platform timeout or hold material locks.
6. Do not use `CREATE INDEX CONCURRENTLY` inside a normal Prisma migration
   without an explicit, verified out-of-band plan compatible with both Prisma
   and the repository fallback.
7. Prisma cannot express every PostgreSQL object. When adding or changing check,
   partial, exclusion, expression, or trigram indexes or constraints, mirror the
   final invariant in `scripts/bootstrap-empty-database.mjs`. The bootstrap
   generates the current Prisma schema and marks historical migrations applied,
   so it will otherwise skip migration-only objects.
8. Update focused tests, owning area docs, gaps, codemaps, and the task ledger in
   the same slice.

## Verify in layers

### Local contracts

- `npx prisma format`
- `npx prisma validate`
- `npx prisma generate`
- `npm run db:migrate:check`
- Focused schema, migration, bootstrap, and affected service/API tests
- `npm test` when CI, shipping scope, or the repository verification matrix
  requires the full suite
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run codemap` before `npm run verify:docs` when owned maps changed
- `git diff --check`
- `npm run build:app`

`db:migrate:check` validates folder shape and prefix collisions, not SQL
execution or live drift.

Treat unrelated full-suite failures as separate only after focused proof and
source evidence establish that boundary. Record the exact failures.

### SQL behavior

Execute the migration against a disposable PostgreSQL database representing the
relevant pre-migration shape when practical. At minimum:

- Apply with fail-fast SQL behavior.
- Query `pg_constraint`, `pg_indexes`, and column metadata for exact definitions
  and validation state, not only object names.
- Exercise rejection behavior for new checks or uniqueness rules.
- Test retry/idempotence for reconciliation SQL.

Generated-current-schema execution proves syntax and retry compatibility, not a
complete historical replay. State that limitation.

### Live read-only proof

Run `npm run db:migrate:health` and bounded data preflights. A pending newest
migration is expected before deployment; failed rows or database-only
migrations are not. Do not substitute raw `prisma migrate status` for the
repository health wrapper.

### Deployment

Run `npm run db:migrate:deploy` only when live mutation and the target
environment are explicitly authorized. Then rerun health and verify the changed
columns, constraints, indexes, and application contract. Never infer deploy
permission from “fix,” “verify,” a green build, or migration creation.

Use `npm run build` only for an approved deploy-shaped check because it runs the
migration deploy wrapper. Pull-request CI and ordinary local compilation must
use `npm run build:app`; migration-execution CI needs an isolated disposable
database.

## Recovery rules

- Pending local migration: deploy only with authorization, then rerun health.
- Unresolved failed row: inspect logs and partial database effects; make the SQL
  safely resumable before any `--rolled-back` resolution.
- Compare the deployed artifact checksum with migration history. Do not trust
  `applied_steps_count` as proof of actual schema effects.
- Applied database-only migration: restore the exact local artifact.
- Blank Prisma schema-engine or `P1001`: use the repository health/deploy
  wrappers; do not introduce a one-off live SQL path.
- Partial HTTP fallback: inspect which statements committed before retrying.
- Treat `prisma migrate resolve` as a live history mutation requiring explicit
  target authorization. `--applied` requires exact catalog parity;
  `--rolled-back` permits a retry but does not undo committed DDL.
- Never update `_prisma_migrations` manually.
- Non-empty bootstrap target, unexpected host, or shared data: stop. The guarded
  empty bootstrap is only for a verified isolated empty environment.

## Stop conditions

- Target database or authorization is ambiguous.
- Live history conflicts with local folders or ownership is uncertain.
- Existing rows violate a proposed constraint and cleanup is not bounded.
- Migration generation would require pointing development tooling at shared
  data.
- Lock time, backfill duration, or fallback retry behavior is not understood.
- Schema shape conflicts with accepted decisions, area contracts, API/native
  payloads, or active work.
- The same migration approach fails twice.

## Closeout

Inspect the final diff and record:

- Migration created, revised, applied, or intentionally left pending.
- Target environment and pre/post health, without secrets.
- Local, disposable-PostgreSQL, live preflight, and application proof.
- Bootstrap parity for Prisma-inexpressible objects.
- Deferred deployment, recovery steps, external blockers, and the next bounded
  action.

Use `gt-ship` for staging, commit, push, or PR work unless the user explicitly
requested those actions here.
