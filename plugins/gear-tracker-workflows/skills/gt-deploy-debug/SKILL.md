---
name: gt-deploy-debug
description: Gear Tracker deployment debugging workflow. Use when the user runs /gt-deploy-debug, Vercel fails, production deploys break, Prisma or Neon blocks build, cron fails, or logs need investigation.
---

# /gt-deploy-debug

Treat deploy failure as the task. Find the real blocker and fix the smallest safe slice.

## Required Reads

1. `package.json`
2. `vercel.json`
3. `docs/PRISMA_NEON_RUNBOOK.md` when present
4. `docs/GAPS_AND_RISKS.md`
5. Current failing deployment logs or local reproduction output
6. `scripts/prisma-migrate-deploy.mjs`
7. `scripts/prisma-migrate-health.mjs`
8. Touched route/service/schema files

## Triage Order

1. Classify failure:
   - Install/dependency
   - Prisma/Neon migration
   - TypeScript or Next compile
   - Runtime route failure
   - Cron or auth failure
2. Reproduce locally with the narrowest command.
3. If DB-related, run `npm run db:migrate:health` before assuming schema code is wrong.
4. If compile-related, run `npx tsc --noEmit` and `npx next build`.
5. If cron-related, check `vercel.json`, route wrapper, bearer auth, and partial-failure behavior.
6. Patch the root cause.
7. Sync docs if behavior changed.

## Verification

- Relevant focused tests
- `npm run db:migrate:health` for DB deploy issues
- `npm run build` for deploy-shaped closeout
- Vercel logs or redeploy proof when available

## Stop Conditions

- Live environment access is required and unavailable.
- Two deploy/debug attempts fail without new evidence.
- Fix requires destructive DB changes.
