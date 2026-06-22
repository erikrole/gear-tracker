# Testing Guide Refresh

Date: 2026-06-22

Backlog item: `DESLOPPIFY.md` M3

## Scope

Refresh documentation for the current Vitest suite, verification gates, helper patterns, and known-bug naming convention. This is documentation-only unless a documented command is missing or broken.

## Current Inventory

- Test files: 242 `tests/**/*.test.ts`
- Static test-case count: 1,430 `it()` / `test()` declarations
- `BUG:` tests: 2 current tests in `tests/auth-hardening.test.ts`
- Test helpers: `tests/_helpers/assert-transaction.ts`, `tests/_helpers/factories.ts`, `tests/_helpers/mock-db.ts`

## Plan

- [x] Inspect `docs/TESTING.md`, `plans/README.md`, `package.json`, current test inventory, helpers, and `BUG:` usage.
- [x] Replace stale suite counts and known-bug table with current inventory and conventions.
- [x] Document when to run focused Vitest, TypeScript, docs/codemap, migration-prefix, build, and iOS gates.
- [x] Add a reusable test inventory refresh command.
- [x] Sync `plans/README.md`, `DESLOPPIFY.md`, and `tasks/todo.md`.
- [x] Run doc-focused verification and record results.

## Review

- 2026-06-22: Testing guide refresh shipped locally. `docs/TESTING.md` now reflects 242 test files, 1,430 static test declarations, current `BUG:` usage, current helper files, verification gate guidance, and reusable inventory commands. `plans/README.md` now points readers to `docs/TESTING.md` for current inventory instead of historical improve-plan counts. Verification passed with the documented inventory commands, `npm run verify:docs`, `npm run db:migrate:check`, and `git diff --check`.

## Guardrails

- Do not rename test files or change test behavior in this slice.
- Keep `BUG:` convention clear: it can mark either still-open bug-proof tests or fixed-regression tests, but the guide must say which is which.
- Avoid claiming full-suite counts are exact runtime assertions. Static counts are inventory guidance.
