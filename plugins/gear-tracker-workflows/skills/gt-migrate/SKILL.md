---
name: gt-migrate
description: Gear Tracker Prisma and Neon migration workflow. Use when the user runs /gt-migrate, changes Prisma schema, investigates migration drift, works with Neon, or needs database deploy recovery.
---

# /gt-migrate

Use the repo's current Prisma and Neon path. Do not fall back to generic Prisma advice.

## Required Reads

1. `AGENTS.md`
2. `prisma/schema.prisma`
3. `prisma.config.ts` when present
4. `package.json` scripts
5. `docs/PRISMA_NEON_RUNBOOK.md` when present
6. Relevant `docs/AREA_*.md`
7. `docs/DECISIONS.md`
8. `docs/GAPS_AND_RISKS.md`
9. Existing migrations under `prisma/migrations`
10. `scripts/prisma-migrate-deploy.mjs`
11. `scripts/prisma-migrate-health.mjs`

## Workflow

1. Confirm whether this is schema design, migration generation, deploy recovery, or drift diagnosis.
2. For schema work, read the full schema and area docs before editing.
3. Apply one coherent schema edit.
4. Generate migration with the repo's current supported path.
5. Never edit an already-applied migration.
6. Use the wrapper-backed deploy and health scripts for Neon truth.
7. Update area docs and gaps in the same slice.

## Commands

- Validate schema: `npx prisma validate`
- Check migration folder prefixes: `npm run db:migrate:check`
- Check live migration health: `npm run db:migrate:health`
- Deploy migrations: `npm run db:migrate:deploy`
- App compile build: `npx next build`
- Full deploy-shaped build: `npm run build`

## Stop Conditions

- Prisma reports a blank schema-engine error and the wrapper path has not been checked.
- Live Neon history disagrees with local migration folders.
- A migration would do long-running data backfill inside Vercel deploy time limits.
- Two migration attempts fail.
