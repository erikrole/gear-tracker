# Plan 003: Report calendar sync changes truthfully

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- src/lib/services/calendar-sync.ts 'src/app/(app)/settings/calendar-sources/calendar-source-sync-copy.ts' tests/calendar-sync.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: plans/002-bound-calendar-source-sync-fetches.md
- **Category**: correctness
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

Calendar sync currently reports unchanged rows as updated. That makes manual sync toasts and cron summaries overstate what happened. Operators need the sync result to distinguish "we saw the feed and nothing changed" from "we refreshed event rows."

## Current State

- `src/lib/services/calendar-sync.ts:141-149` defines `SyncResult` with `added`, `updated`, `cancelled`, `skipped`, `errors`, optional `diagnostics`, and optional `error`.
- `src/lib/services/calendar-sync.ts:558-562` calculates `updated = toUpdate.length + unchanged.length`.
- `tests/calendar-sync.test.ts:527-535` confirms unchanged events belong in `unchanged` and need no update.
- `src/app/(app)/settings/calendar-sources/calendar-source-sync-copy.ts:28-40` renders `result.updated` as "event(s) refreshed" and says "no event changes" only when all counts are zero.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/calendar-sync.test.ts` | exit 0 |
| UI copy/source tests | `npm test -- calendar` if a matching test filter exists, otherwise `npm test` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build check | `npm run build:app` if Plan 001 has landed, otherwise `npm run build` with valid local env | exit 0 |

## Scope

**In scope**:
- `src/lib/services/calendar-sync.ts`
- `src/app/(app)/settings/calendar-sources/calendar-source-sync-copy.ts`
- `tests/calendar-sync.test.ts`
- Existing calendar-source UI/source tests if present

**Out of scope**:
- Do not change ICS parsing.
- Do not change event diff rules.
- Do not change shift generation counts.
- Do not rename database fields.

## Git Workflow

- Branch: `codex/003-calendar-sync-truthful-counts`
- Commit message: `fix: report calendar sync changes accurately`

## Steps

### Step 1: Decide and encode the result contract

Use this contract unless the maintainer says otherwise:

- `updated` means rows that were actually changed in the database.
- `unchanged` is a new optional count for rows seen in the feed that required no update.
- Existing consumers that ignore `unchanged` continue to work.

Update `SyncResult` with `unchanged?: number` or required `unchanged: number`. Required is cleaner inside the service, optional may reduce downstream churn. Choose one and keep it consistent.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 2: Fix the service count

Change the sync calculation from:

```ts
const updated = toUpdate.length + unchanged.length;
```

to:

```ts
const updated = toUpdate.length;
const unchangedCount = unchanged.length;
```

Return the unchanged count under the contract from Step 1.

**Verify**: `npx vitest run tests/calendar-sync.test.ts` -> existing tests still pass before adding new assertions.

### Step 3: Update UI copy

Update `calendar-source-sync-copy.ts` so:

- `updated` renders as "event updated" or "events updated" if it means actual DB changes.
- `unchanged` does not create a fake change summary.
- When only unchanged rows are present, the message remains equivalent to "no event changes" while still allowing health diagnostics elsewhere to show the feed was read.

Avoid a response-shape break for route callers.

**Verify**: run the focused UI/source tests if they exist, otherwise `npm test`.

## Test Plan

Add tests that prove:

- An unchanged event does not increase `updated`.
- A changed event does increase `updated`.
- `unchanged` is returned or represented per the chosen contract.
- Toast/copy helper says "no event changes" when added, updated, cancelled, and skipped are zero, even if unchanged is positive.

## Done Criteria

- [x] `updated` equals the number of actual changed existing rows, not changed plus unchanged.
- [x] UI copy no longer calls unchanged events refreshed.
- [x] `npx vitest run tests/calendar-sync.test.ts` exits 0.
- [x] `npx tsc --noEmit` exits 0.
- [x] `npm test` exits 0.
- [x] Build check exits 0.
- [x] `plans/README.md` status row updated.

## Review

- 2026-06-11: Added `unchanged` to `SyncResult` and changed saved-source sync so `updated` is only `toUpdate.length`.
- 2026-06-11: Updated Settings calendar-source sync copy from "events refreshed" to "events updated" and kept unchanged-only syncs under "no event changes."
- 2026-06-11: Added focused coverage for unchanged sync copy and the updated result contract.
- 2026-06-11 verification: focused calendar tests, TypeScript, full tests, live-free `build:app`, migration-prefix check, and whitespace diff all exited 0.

## STOP Conditions

- A downstream consumer depends on `updated` meaning "seen in feed" rather than "changed in database."
- Changing the count requires a migration or historical reporting backfill.
- Plan 002 has not landed and the same files have drifted substantially.

## Maintenance Notes

Reviewers should read sync result copy as an operator trust surface. Counts should describe actual state transitions, while diagnostics can describe feed visibility.
