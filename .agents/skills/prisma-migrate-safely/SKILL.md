---
name: prisma-migrate-safely
description: Schema-first migration workflow for the gear-tracker Prisma + Neon stack. Reads schema, docs, decisions, and gaps, then uses the repo's wrapper-backed migration and health commands instead of raw Prisma status assumptions.
---

# Prisma Migrate Safely

User-only skill that enforces the project's schema-first thin-slice protocol.

For broader deploy recovery or Neon drift diagnosis, prefer `/gt-migrate` from the `gear-tracker-workflows` plugin.

## When to invoke
The user runs `/prisma-migrate-safely <feature>` when they're about to add or change a Prisma model.

## Steps

1. **Pre-implementation audit** (AGENTS.md rule #7)
   - Read `prisma/schema.prisma` end-to-end. List existing models, enums, and cascade rules touched by the proposed change.
   - Grep `docs/DECISIONS.md` and `docs/GAPS_AND_RISKS.md` for prior decisions or open gaps about this feature area.
   - Read the relevant `docs/AREA_*.md` and any `docs/BRIEF_*.md` for the feature.
   - Surface findings to the user **before** editing the schema.

2. **Schema edit (one complete edit per AGENTS.md rule #15)**
   - Apply the schema change in a single `Edit` of `prisma/schema.prisma`.
   - Confirm cascade rules, `@map`, indexes, and `onDelete` policies match siblings.

3. **Generate + apply migration**
   - Run: `npx prisma format`
   - Run: `npx prisma migrate dev --name <feature>_<short_change>`
   - If it fails, STOP and report — do not retry the same migration with a different name.

4. **Migration health and sanity build**
   - Run: `npx prisma validate`
   - Run: `npm run db:migrate:check`
   - Run: `npm run db:migrate:health` when live Neon migration state matters
   - Run: `npx next build` for app-only compilation
   - Run: `npm run build` when deploy-shaped migration behavior is in scope
   - If build fails, fix before declaring done (AGENTS.md rule #8).

5. **Doc Sync on Ship** (AGENTS.md rule #12 — non-negotiable)
   - Update the matching `docs/AREA_*.md` change log with one line describing the schema change.
   - If this closes an entry in `docs/GAPS_AND_RISKS.md`, mark it resolved.
   - Verify `tasks/<feature>-plan.md` exists and check off the schema slice.

6. **Commit**
   - Conventional commit `feat:` or `chore:` (rule #9) bundling schema + generated migration + AREA doc update in one commit.
   - Stage only in-scope files. Push only when the user requested shipping to the remote.

## Guardrails
- Never edit an applied migration's SQL file (`prisma/migrations/*/migration.sql`). The PreToolUse hook will block this.
- Neon serverless: avoid long-running data backfills inside the migration — use a separate script for backfills > a few seconds (Vercel 10s/60s timeout).
- Treat blank Prisma schema-engine failures against Neon as a deploy-path issue first. Check the repo wrapper and health commands before assuming the schema is wrong.
