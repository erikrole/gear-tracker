# Plan 055: Keep Dashboard fast-count failures from looking healthy

> **Executor instructions**: Preserve cached rows and counts on failure. Run every gate and update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9e92580f..HEAD -- src/hooks/use-dashboard-data.ts src/app/\(app\)/page.tsx src/app/api/dashboard/stats/route.ts src/app/\(app\)/dashboard-types.ts tests/dashboard*`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e92580f`, 2026-07-09
- **Execution**: IMPLEMENTED 2026-07-10. Automated regression, full test, lint, TypeScript, migration, docs, and app-build gates pass. The browser harness covers count failure and recovery through request interception, but an authenticated run remains blocked until dedicated isolated credentials are available.

## Why this matters

The Dashboard overlays a 60-second count response on the heavier payload, but ignores both query errors and server `partialFailures`. If the count aggregate fails, the route can return zero fallbacks and the client can overwrite trustworthy cached totals with zeros while the page still looks healthy. Those counts drive overdue and handoff work.

## Current state

- `use-dashboard-data.ts` observes error state only for the full Dashboard query.
- The fast query destructures only `data` and unconditionally overlays it when present.
- `/api/dashboard/stats` uses `Promise.allSettled`, returns zero fallbacks, and includes named `partialFailures`.
- The full Dashboard UI already has freshness/status patterns and preserves visible data on full refresh failure.

## Scope

**In scope**:
- `src/hooks/use-dashboard-data.ts`
- Dashboard response types
- `src/app/(app)/page.tsx` or the existing status component adapter
- Focused Dashboard stats/query tests
- Dashboard docs and closeout ledger

**Out of scope**:
- Rewriting Dashboard queries
- Changing refresh cadence
- Adding a new polling service
- Blanketing the page with repeated toasts

## Steps

1. Extend the fast-stats response type to include `partialFailures` and retain the last fully trustworthy fast snapshot.
   - **Verify**: count aggregate failure cannot replace known nonzero counts with fallback zeros.
2. Observe fast-query error/fetch state and surface one bounded stale/retrying state through the existing Dashboard sync/freshness presentation.
   - **Verify**: cached rows and counts stay visible; the user sees that fresh counts were not confirmed.
3. Treat non-count partial failures (`myShiftsCount`, `myShiftsTodayCount`) narrowly so they do not invalidate unrelated operational totals.
   - **Verify**: tests prove source-specific partial behavior.
4. Browser-smoke a successful refresh, forced count failure, recovery, and tab-focus refresh.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npx vitest run tests/dashboard-stats-route.test.ts tests/dashboard-fast-count-source.test.ts tests/booking-realtime-sync-source.test.ts` | all pass; use current focused filenames |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0 |
| Lint | `npx eslint src/hooks/use-dashboard-data.ts 'src/app/(app)/page.tsx' --max-warnings=0` | exit 0 |
| Build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

## Done criteria

- [x] Failed fast counts never overwrite trusted counts with fallback zeros.
- [x] Fast-query failure is visible but does not blank cached Dashboard data.
- [x] Recovery clears the warning and applies fresh totals.
- [x] Focused tests, full tests, TypeScript, lint, build, docs, and whitespace gates pass.
- [ ] Authenticated browser proof passes against an isolated target.

## STOP conditions

- The full and fast endpoints use incompatible count definitions.
- Correctness requires removing the fast endpoint rather than hardening it.
- The fix would show a false global outage for a shift-count-only partial failure.
