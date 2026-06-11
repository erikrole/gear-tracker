# Plan 008: Normalize custom API limit parsing

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- src/app/api/audit/route.ts src/app/api/my-shifts/route.ts src/lib/http.ts tests/settings-audit-pagination.test.ts tests/student-field-contracts.test.ts tests`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

Most API routes use `parsePagination`, which clamps `limit` to a positive default and max. Two custom limit parsers do not enforce a positive lower bound. Negative limits can flow into Prisma `take` and produce confusing empty, reversed, or error behavior instead of stable API semantics.

## Current State

- `src/lib/http.ts:77-88` implements `parsePagination` with `rawLimit > 0`, max 200, and non-negative offset.
- `src/app/api/audit/route.ts:53` computes `limitParam` with `Math.min(parseInt(...) || PAGE_SIZE, MAX_PAGE_SIZE)`, which allows negative values.
- `src/app/api/audit/route.ts:104-108` uses `limitParam` for `take`, `hasMore`, and `slice`.
- `src/app/api/my-shifts/route.ts:40` computes `limit` with `Math.min(Number(...) , 20)`, which allows negative values.
- `src/app/api/my-shifts/route.ts:57-60` passes that value to Prisma `take`.
- `tests/settings-audit-pagination.test.ts` covers client-side audit pagination recovery but not route limit parsing.
- `tests/student-field-contracts.test.ts:137-145` statically pins `/api/my-shifts` gear-context behavior but not its query validation.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused audit tests | `npx vitest run tests/settings-audit-pagination.test.ts` plus any new audit route test | exit 0 |
| Focused my-shifts tests | `npx vitest run tests/student-field-contracts.test.ts` plus any new route test | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Full tests | `npm test` | exit 0 |
| Build check | `npm run build:app` if Plan 001 has landed, otherwise `npm run build` with valid local env | exit 0 |

## Scope

**In scope**:
- `src/app/api/audit/route.ts`
- `src/app/api/my-shifts/route.ts`
- `src/lib/http.ts` only if adding a shared `parseLimit` helper is cleaner
- Tests for negative, zero, missing, and over-max limits

**Out of scope**:
- Do not change audit cursor semantics.
- Do not change `/api/my-shifts` response shape or gear-context query.
- Do not alter unrelated paginated routes that already use `parsePagination`.

## Git Workflow

- Branch: `codex/008-normalize-api-limit-parsing`
- Commit message: `fix: normalize API limit parsing`

## Steps

### Step 1: Add or reuse a shared positive-limit helper

Preferred shape:

```ts
export function parsePositiveLimit(raw: string | null, defaultLimit: number, maxLimit: number): number {
  const parsed = parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maxLimit) : defaultLimit;
}
```

Put it in `src/lib/http.ts` near `parsePagination`, or keep local helpers if that avoids unnecessary churn.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 2: Fix `/api/audit`

Replace the current `limitParam` expression with the shared positive-limit helper using default 50 and max 100. Preserve existing behavior for missing, invalid, and over-max positive values.

Expected behavior:

- missing limit -> 50
- `limit=0` -> 50
- `limit=-1` -> 50
- `limit=999` -> 100

**Verify**: focused audit route tests pass.

### Step 3: Fix `/api/my-shifts`

Use the same helper with default 5 and max 20.

Expected behavior:

- missing limit -> 5
- `limit=0` -> 5
- `limit=-1` -> 5
- `limit=999` -> 20

**Verify**: focused my-shifts route tests pass.

## Test Plan

Add route-level tests, not just source-string tests:

- `/api/audit?limit=-1` calls `db.auditLog.findMany` with positive `take`.
- `/api/audit?limit=999` caps at 100.
- `/api/my-shifts?limit=-1` calls `db.shiftAssignment.findMany` with `take: 5`.
- `/api/my-shifts?limit=999` caps at `take: 20`.

Use existing auth and DB mock patterns from nearby route tests.

## Done Criteria

- [x] Negative and zero limits cannot reach Prisma `take` in `/api/audit`.
- [x] Negative and zero limits cannot reach Prisma `take` in `/api/my-shifts`.
- [x] Over-max positive values still cap to the documented max.
- [x] Focused route tests cover both endpoints.
- [x] `npx tsc --noEmit` exits 0.
- [x] `npm test` exits 0.
- [x] Build check exits 0.
- [x] `plans/README.md` status row updated.

## Review

- Completed 2026-06-11 on branch `codex/008-normalize-api-limit-parsing`.
- Added `parsePositiveLimit` to `src/lib/http.ts` and reused it from `parsePagination`, `/api/audit`, and `/api/my-shifts`.
- `/api/audit` now maps missing, invalid, zero, and negative limits to 50, caps positive over-max values at 100, and still requests `limit + 1` rows for older-page `hasMore` detection.
- `/api/my-shifts` now maps missing, invalid, zero, and negative limits to 5 and caps positive over-max values at 20.
- Verification: `npx vitest run tests/api-limit-parsing.test.ts tests/settings-audit-pagination.test.ts tests/student-field-contracts.test.ts`, `npx tsc --noEmit`, `npm test` (198 files, 1165 tests), `npm run build:app`, and `git diff --check` all passed.

## STOP Conditions

- Existing clients intentionally depend on `limit=0` returning zero rows.
- Prisma negative `take` behavior is being used deliberately for reverse pagination in either route.
- Test setup for either route requires broad mocking unrelated to limit parsing.

## Maintenance Notes

Future routes with a single `limit` parameter should use the shared helper instead of repeating local `Math.min(Number(...), max)` expressions.
