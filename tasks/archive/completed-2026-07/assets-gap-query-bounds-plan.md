# Assets Gap Query Bounds Plan

Date: 2026-06-22

Backlog source: `DESLOPPIFY.md` C3.

## Goal

Bound `/api/assets?missing=category|department` cleanup queries so the Gap Wizard remains fast as standard items and item families grow.

## Slice

- [x] Audit the missing-field branch, Gap Wizard consumer, Items docs, and existing tests.
- [x] Count standard asset gaps and bulk item-family gaps separately.
- [x] Fetch only the requested page from each source instead of loading all gap rows before slicing.
- [x] Return explicit metadata when category suggestion sampling is capped.
- [x] Keep the existing response shape for the Gap Wizard and counts.
- [x] Add focused route tests for bounded query shape, totals, pagination, and suggestion cap metadata.
- [x] Sync DESLOPPIFY, Items docs, gaps, codemaps, and task queue.
- [x] Run focused tests plus project verification gates.

## Verification Target

- `npx vitest run tests/assets-missing-gaps-route.test.ts`
- `npx tsc --noEmit`
- `npm run verify:docs`
- `npm run db:migrate:check`
- `git diff --check`
- `npm run build:app`

## Review

- 2026-06-22: Assets gap query bounds shipped locally. `/api/assets?missing=category|department` now counts standard assets and bulk SKUs separately, fetches only the requested cleanup page from each source, returns `truncated` plus `suggestionsLimited` metadata, and the Gap Wizard surfaces capped suggestion matching. Verification passed with focused missing-gap route Vitest, category cleanup wizard source-contract Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.
