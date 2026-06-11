# Prisma + Neon Runbook

Last updated: 2026-06-11

## Connection Rules

- `DATABASE_URL` is the pooled Neon runtime URL used by the app and `@prisma/adapter-neon`.
- `DIRECT_URL` is the direct Neon URL used for Prisma CLI work, migration deploys, and migration health inspection.
- Do not run DDL through the pooled runtime URL. The migration fallback refuses to run without `DIRECT_URL`.
- `prisma.config.ts` points Prisma CLI commands at `DIRECT_URL`; runtime code should keep using `DATABASE_URL`.

## Supported Commands

```bash
npm run db:migrate:check
npm run db:migrate:status
npm run db:migrate:health
npm run db:migrate:deploy
npm run build
npm run build:app
```

- `db:migrate:check` verifies local migration prefix uniqueness.
- `db:migrate:status` and `db:migrate:health` run the repo's Neon-backed health checker. They compare local migration folders with live `_prisma_migrations`, fail on pending local migrations, fail on unresolved failed rows, fail on applied DB rows missing locally, and verify the newest local migration is applied.
- `db:migrate:deploy` runs `prisma migrate deploy` first. If Prisma exits with the known blank schema-engine error against Neon, the wrapper applies pending migration SQL through Neon HTTP and records `_prisma_migrations`.
- `build` is the deploy-equivalent build. It runs the deploy wrapper before `next build`, so it requires a real `DIRECT_URL` and fails early if migration state is not deployable.
- `build:app` runs the migration-free Next production build. CI uses it with placeholder runtime env after `db:migrate:check` proves local migration folder sanity without live database credentials.
- `/api/db-diagnostics` uses the same local-vs-applied migration health semantics as `db:migrate:health`. The Next config explicitly traces `prisma/migrations` into that serverless route so the admin Database Health page can compare live `_prisma_migrations` rows against the shipped repo migration folders.

Raw `prisma migrate status` is not the source of truth in this repo because the local Prisma schema engine can fail blank against Neon. Use `npm run db:migrate:status` or `npm run db:migrate:health`.

## Normal Migration Flow

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma format`.
3. Create a migration with Prisma's migrate workflow.
4. Run `npm run db:migrate:check`.
5. Run `npm run db:migrate:deploy`.
6. Run `npm run db:migrate:health`.
7. Run `npm run build`.
8. For live-free CI/app-build verification, run `npm run build:app` with placeholder runtime env.
9. Commit schema, migration SQL, docs, and related code together.

## Recovery Rules

- If health reports pending local migrations, run `npm run db:migrate:deploy` and rerun health.
- If health reports unresolved failed rows, inspect `_prisma_migrations` before retrying. Do not edit an applied migration file to force a match.
- If health reports applied DB-only migrations, stop and reconcile the missing migration folder before shipping.
- If Prisma emits the blank schema-engine failure, let the deploy wrapper fallback handle it. Do not reintroduce one-off migration scripts.
