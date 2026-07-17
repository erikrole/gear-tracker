# Plan 060: Reuse canonical app-time logic in the kiosk dashboard

> **Executor instructions**: Follow this plan exactly and run every gate. Stop instead of improvising if a STOP condition occurs. Update plan 060 in `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat 189ea5ab..HEAD -- src/lib/app-time.ts src/app/api/kiosk/dashboard/route.ts tests/app-time.test.ts tests/kiosk-dashboard-route.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `189ea5ab`, 2026-07-16

## Why this matters

The kiosk dashboard contains a second timezone engine for UTC offsets, DST-aware day windows, and local date parts. `src/lib/app-time.ts` already owns the institution-timezone boundary contract. Two implementations can diverge at DST transitions and obscure the route's real responsibility.

## Current state

- `app-time.ts` provides `startOfDayInAppTz`, `startOfTodayInAppTz`, and all-day normalization using `env.appTimezone`.
- `kiosk/dashboard/route.ts:20-110` independently defines `timeZoneOffsetMs`, `zonedDateTimeToUtc`, `dayWindowInTimeZone`, `localDateTimeParts`, and `isAllDaySpan`.
- The route uses the duplicate helpers for a two-day event query, the 10 p.m.–6 a.m. night flag, and all-day presentation.
- Server runtimes are UTC. Do not replace these helpers with server-local `setHours` calls.

## Target shape

Promote only the two genuinely reusable operations into `app-time.ts`:

1. A local date/time parts helper with an explicit return type, for example `appTimeParts(instant, timeZone?)`.
2. An all-day-span predicate based on those parts, for example `isAllDaySpanInAppTz(startsAt, endsAt, timeZone?)`.

Use `startOfDayInAppTz(now, 0)` and `startOfDayInAppTz(now, 2)` for the kiosk event window. Use the shared parts helper for the night flag. Naming may differ, but ownership and behavior must match this contract.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/app-time.test.ts tests/kiosk-dashboard-route.test.ts` | all pass |
| Typecheck | `npx tsc --noEmit --pretty false` | exits 0 |
| Lint | `npx eslint src/lib/app-time.ts src/app/api/kiosk/dashboard/route.ts tests/app-time.test.ts tests/kiosk-dashboard-route.test.ts` | exits 0 |
| Build | `npm run build:app` | succeeds |

## Scope

**In scope**:

- `src/lib/app-time.ts`
- `src/app/api/kiosk/dashboard/route.ts`
- `tests/app-time.test.ts`
- `tests/kiosk-dashboard-route.test.ts`

**Out of scope**:

- Kiosk response shape, SQL queries, stats, operational windows, or location scoping
- Calendar sync and stored event timestamps
- Changing `env.appTimezone`
- Replacing `Intl.DateTimeFormat` with a new dependency

## Git workflow

- Suggested branch: `codex/060-kiosk-app-time-reuse`
- Commit if requested: `refactor: reuse app-time logic in kiosk dashboard`

## Steps

### Step 1: Characterize the shared behavior

Extend `tests/app-time.test.ts` before deleting route helpers. Add cases for:

- Local date/time parts in `America/Chicago` during standard and daylight time.
- Two-day windows spanning spring-forward and fall-back boundaries.
- All-day spans that start/end at local midnight.
- Timed and invalid/reversed spans returning false.

Use fixed ISO instants and explicit timezone arguments. Avoid depending on the machine timezone.

**Verify**: the new tests fail only because the new exports do not yet exist, then pass after Step 2.

### Step 2: Add minimal shared helpers

Refactor the private parts parsing in `app-time.ts` into the typed exported helper. Implement the all-day predicate there. Keep `zoneOffsetMs` private unless another consumer genuinely needs it.

**Verify**: `npx vitest run tests/app-time.test.ts` → all pass.

### Step 3: Delete route-local timezone duplication

Import shared helpers into the kiosk route. Replace `dayWindowInTimeZone(now, 2, env.appTimezone)` with shared day-boundary calls, replace local-parts use, and replace the all-day predicate. Remove `env` from the route if it becomes unused.

**Verify**: `rg -n 'timeZoneOffsetMs|zonedDateTimeToUtc|dayWindowInTimeZone|localDateTimeParts|function isAllDaySpan' src/app/api/kiosk/dashboard/route.ts` → no matches.

### Step 4: Run route and repo gates

Run focused tests, TypeScript, lint, app build, and `git diff --check`. Compare representative kiosk payload assertions before and after.

## Test plan

- Put timezone math tests in `tests/app-time.test.ts`.
- Keep route tests focused on the API response and query window.
- Include both DST directions and an ordinary day.

## Done criteria

- [ ] The kiosk route contains no independent timezone-offset/day-window engine.
- [ ] Shared app-time tests cover DST boundaries and all-day classification.
- [ ] Kiosk response behavior is unchanged.
- [ ] Focused tests, TypeScript, lint, app build, and diff check pass.
- [ ] Plan 060 status is updated.

## STOP conditions

- Existing kiosk tests reveal intentional behavior that differs from canonical app-time.
- Reuse would change the event query window or response shape.
- A new date/time dependency appears necessary.
- Verification fails twice.

## Maintenance notes

Institution-timezone boundaries belong in `app-time.ts`. Review future server routes for server-local midnight calculations before adding another helper.

