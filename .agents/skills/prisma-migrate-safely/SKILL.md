---
name: prisma-migrate-safely
description: Schema-first migration workflow for the gear-tracker Prisma + Neon stack. Reads schema, drafts migration, runs `prisma migrate dev`, and reminds the user to update the matching `docs/AREA_*.md` change log per AGENTS.md rules #7, #10, #12.
disable-model-invocation: true
---

# Prisma Migrate Safely

User-only skill that enforces the project's schema-first thin-slice protocol.

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

4. **Sanity build**
   - Run: `npx prisma generate && npm run build`
   - If build fails, fix before declaring done (AGENTS.md rule #8).

5. **Doc Sync on Ship** (AGENTS.md rule #12 — non-negotiable)
   - Update the matching `docs/AREA_*.md` change log with one line describing the schema change.
   - If this closes an entry in `docs/GAPS_AND_RISKS.md`, mark it resolved.
   - Verify `tasks/<feature>-plan.md` exists and check off the schema slice.

6. **Commit**
   - Conventional commit `feat:` or `chore:` (rule #9) bundling schema + generated migration + AREA doc update in one commit.
   - Push to current branch (per persisted user feedback: always commit + push at end of completed task).

## Guardrails
- Never edit an applied migration's SQL file (`prisma/migrations/*/migration.sql`). The PreToolUse hook will block this.
- Neon serverless: avoid long-running data backfills inside the migration — use a separate script for backfills > a few seconds (Vercel 10s/60s timeout).
