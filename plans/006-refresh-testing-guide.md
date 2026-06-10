# Plan 006: Refresh the testing guide against the current suite

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- docs/TESTING.md tests src/lib/api.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The testing guide is stale enough to mislead future executors. It reports an old suite size and presents fixed bugs as current `BUG:` tests. This increases the chance that a future agent writes tests for obsolete behavior or misses the current regression-test conventions.

## Current State

- `docs/TESTING.md:7` says the suite has 327 tests across 22 files.
- Advisor verification on 2026-06-10: `npm test` passed with 186 test files and 1103 tests.
- `docs/TESTING.md:114-121` lists known bugs such as missing `claimTrade` isolation, bulk scan TOCTOU, double return, and missing Origin CSRF.
- `tests/shift-trades.test.ts:195-208` now has a regression test requiring SERIALIZABLE isolation.
- `src/lib/api.ts:14-27` implements Origin enforcement for mutating requests, and `src/lib/api.ts:102-105` calls it from `withAuth`.
- `tests/bulk-scan-race.test.ts` and `tests/mark-checkout-completed.test.ts` now describe regression behavior rather than accepted broken behavior.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Count current tests | `npm test` | exit 0, note current Test Files and Tests counts |
| Find stale BUG docs | `rg -n "BUG:|Known Bugs|327 tests|22 files|double-claim|TOCTOU|double-return|missing Origin" docs/TESTING.md tests src/lib/api.ts` | only intentional current references remain |
| Typecheck | `npx tsc --noEmit` | exit 0 |

## Scope

**In scope**:
- `docs/TESTING.md`
- Docs-only updates to examples and naming conventions

**Out of scope**:
- Do not rename tests just to make docs prettier unless a stale `BUG:` label is actively misleading.
- Do not change test behavior.
- Do not update unrelated docs.

## Git Workflow

- Branch: `codex/006-refresh-testing-guide`
- Commit message: `docs: refresh testing guide`

## Steps

### Step 1: Replace stale suite-size claims

Run `npm test` and update `docs/TESTING.md` with the live `Test Files` and `Tests` counts from the output. If the guide should avoid constant churn, phrase it as "as of 2026-06-10" and point readers to `npm test` for the current count.

**Verify**: `rg -n "327 tests|22 files" docs/TESTING.md` -> no matches.

### Step 2: Rewrite the bug-test section

Replace "Known Bugs Documented by Tests" with a current convention section:

- `BUG:` may be used only for an intentionally failing or skipped proof of a currently open bug.
- Fixed bugs should be named as regression tests.
- If the suite has no intentional current bug tests, say that directly.

Use current examples:

- `tests/shift-trades.test.ts:195-208` for double-claim regression.
- `tests/bulk-scan-race.test.ts` for TOCTOU regression.
- `tests/mark-checkout-completed.test.ts` for double-return regression.
- `tests/api-wrapper.test.ts` or `src/lib/api.ts` for Origin enforcement regression.

**Verify**: `rg -n "Known Bugs Documented|BUG: uses no transaction|BUG: allows POST|BUG: returns checkedOutQuantity" docs/TESTING.md` -> no stale examples remain.

### Step 3: Refresh the test tree examples

Update any file list in `docs/TESTING.md` that still implies the suite is mostly 22 files or that specific bug files prove broken behavior. Keep it representative rather than exhaustive unless the doc already intends to be exhaustive.

**Verify**: `rg -n "bulk-scan-race|mark-checkout-completed|api-wrapper|shift-trades" docs/TESTING.md` -> references describe regression coverage accurately.

## Test Plan

Docs-only change:

- `npm test` must pass before and after.
- `npx tsc --noEmit` should pass as a sanity check if no source changes are made.

## Done Criteria

- [ ] `docs/TESTING.md` no longer claims 327 tests across 22 files.
- [ ] Fixed bugs are documented as regression coverage, not current broken behavior.
- [ ] `rg -n "BUG:" docs/TESTING.md` returns no stale guidance unless documenting current open-bug convention.
- [ ] `npm test` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

- `npm test` fails before any docs edits.
- The suite intentionally still contains current `BUG:` tests that should remain documented as open issues.
- The testing guide is being replaced by another docs effort in the current dirty tree.

## Maintenance Notes

Future executors should prefer dated suite-size statements or command-derived counts. Exact counts drift quickly in this repo.

