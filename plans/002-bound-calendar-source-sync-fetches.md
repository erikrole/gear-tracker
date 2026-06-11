# Plan 002: Bound calendar-source sync fetches

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- src/app/api/calendar-sources/test/route.ts src/lib/services/calendar-sync.ts 'src/app/api/calendar-sources/[id]/sync/route.ts' tests/calendar-sync.test.ts AGENTS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The saved calendar-source sync path fetches an external ICS feed inside a Vercel serverless function. The preview endpoint already limits fetch time and response size, but the actual sync path calls `response.text()` with no timeout or byte cap. A slow or oversized feed can consume the function budget, delay cron/manual sync, and make operational failures harder to diagnose.

## Current State

- `src/app/api/calendar-sources/test/route.ts:12-13` defines `FETCH_TIMEOUT_MS = 8000` and `MAX_RESPONSE_BYTES = 5 * 1024 * 1024`.
- `src/app/api/calendar-sources/test/route.ts:50-57` uses `AbortController`.
- `src/app/api/calendar-sources/test/route.ts:77-103` reads the response stream only up to the cap.
- `src/lib/services/calendar-sync.ts:490-502` fetches the saved URL and calls `await response.text()` without a timeout or cap.
- `src/lib/fetch-with-timeout.ts:5-21` already provides a timeout-only fetch wrapper used by booking UI code. Reuse or extend this existing helper where it fits instead of creating a second timeout-only abstraction.
- `src/app/api/calendar-sources/[id]/sync/route.ts:13-17` exposes manual sync with auth and rate limit.
- `AGENTS.md:66-75` says this app deploys to Vercel serverless functions and should keep API routes fast.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/calendar-sync.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Full tests | `npm test` | exit 0 |
| Build check | `npm run build:app` if Plan 001 has landed, otherwise `npm run build` with valid local env | exit 0 |

## Scope

**In scope**:
- `src/app/api/calendar-sources/test/route.ts`
- `src/lib/services/calendar-sync.ts`
- `tests/calendar-sync.test.ts`
- A new helper under `src/lib/services/` or `src/lib/calendar/` if it reduces duplication

**Out of scope**:
- Do not change calendar-source permissions or rate limits.
- Do not redesign ICS parsing.
- Do not change shift generation after sync.
- Do not broaden SSRF hardening beyond reusing the existing `assertPublicHost` behavior.

## Git Workflow

- Branch: `codex/002-bound-calendar-sync-fetch`
- Commit message: `fix: bound calendar source sync fetches`

## Steps

### Step 1: Extract a bounded calendar fetch helper

Create or extend a shared helper used by both the preview route and saved sync path. Start from `src/lib/fetch-with-timeout.ts` if the abstraction still fits; if response-size capping would make that helper too specialized, create a calendar-specific helper that composes `fetchWithTimeout`.

It should:

- Accept URL, user-agent suffix or full user-agent, timeout, and max bytes.
- Use `AbortController` and clear the timeout in `finally`.
- Read `response.body.getReader()` when available.
- Cancel the reader and return a clear error when the byte cap is exceeded.
- Return status, content type, byte size, and decoded text for successful responses.
- Preserve non-OK status handling so UI can display HTTP failures.

Use the preview route's existing behavior as the compatibility baseline.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 2: Use the helper in the preview route

Replace duplicated timeout and stream-reading code in `src/app/api/calendar-sources/test/route.ts` with the helper. Keep response shape unchanged:

```ts
{ ok, status, contentType, byteSize, eventCount, sampleSummaries, error? }
```

**Verify**: `npx vitest run tests/calendar-sync.test.ts` -> exit 0. If no preview tests exist, add route-level coverage in the most appropriate existing calendar-source test file.

### Step 3: Use the helper in saved-source sync

Update `src/lib/services/calendar-sync.ts` so `syncCalendarSource` uses the same bounded helper instead of `await response.text()`. On timeout or over-cap errors, update `calendarSource.lastError` and `lastFetchedAt`, then return `emptyResult` with diagnostics matching the existing failure shape.

Expected failure text should be user-readable and stable enough for tests, for example `Fetch timed out after 8000ms` or `Feed exceeds 5 MB cap.`

**Verify**: `npx vitest run tests/calendar-sync.test.ts` -> tests pass, including new coverage for timeout and over-cap behavior.

## Test Plan

Add focused tests that cover:

- Successful bounded fetch still parses and syncs events.
- Oversized response returns an error, does not parse partial ICS, and records `lastError`.
- Aborted or timed-out fetch returns an error and records `lastFetchedAt`.
- Preview route behavior remains compatible if route tests exist or are added.

Model service-level tests after the existing `splitEventsForSync` and `SyncResult` sections in `tests/calendar-sync.test.ts`.

## Done Criteria

- [x] Saved-source sync no longer calls `response.text()` directly on the external feed.
- [x] Preview and saved sync paths share the same timeout and byte-cap behavior.
- [x] `npx vitest run tests/calendar-sync.test.ts` exits 0.
- [x] `npx tsc --noEmit` exits 0.
- [x] `npm test` exits 0.
- [x] Build check exits 0.
- [x] `plans/README.md` status row updated.

## Review

- 2026-06-11: Added `fetchCalendarText` as the shared bounded calendar feed fetcher with an 8-second timeout, 5 MB cap, stable timeout/oversize errors, and byte-size reporting.
- 2026-06-11: Reused the helper from both `POST /api/calendar-sources/test` and saved-source sync so preview and sync share the same fetch budget.
- 2026-06-11: Saved-source sync records timeout and oversize failures on `lastError`/`lastFetchedAt` and returns the existing hard-error result shape with diagnostics.
- 2026-06-11 verification: focused calendar tests, TypeScript, full tests, live-free `build:app`, migration-prefix check, and whitespace diff all exited 0.

## STOP Conditions

- The runtime target lacks `ReadableStream` support for the helper approach.
- Tests show existing clients depend on reading feeds over 5 MB.
- The fix requires changing the public sync response contract beyond adding error text.

## Maintenance Notes

This is a fetch-budget fix, not a full SSRF redesign. If later work addresses DNS rebinding, update the shared helper rather than adding a second fetch path.
