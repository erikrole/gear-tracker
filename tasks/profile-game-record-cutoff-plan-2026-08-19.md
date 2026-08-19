# Profile Game-Record Cutoff Plan - 2026-08-19

## Goal

- Exclude games before July 1, 2026 from the profile "games staffed" record because the current pre-July data is testing data.
- Keep the existing outcome, assignment, visibility, cancellation, archive, and event-level deduplication rules unchanged.

## Route

- Owner area: Users profile, with CalendarEvent outcome data from Events.
- Ledger: this active plan; no existing game-record plan owns the slice.
- User-facing surface: `/users/{id}` hero and `GET /api/users/{id}` `gameRecord` payload.

## Source Checks

- `src/lib/services/game-record.ts` owns the shared `CalendarEvent.groupBy` filter used by the profile API.
- The current filter counts non-cancelled, visible, non-archived events with a non-null `CalendarEvent.result` and an active assignment for the target user.
- `src/app/api/users/[id]/route.ts` returns the shared game record; the profile hero renders only the total win-loss line.
- `CalendarEvent.startsAt` is the event-time boundary, and the app timezone is America/Chicago unless configured otherwise.
- The live signed-in profile currently shows 2–1 from April 21, May 2, and May 15, 2026 source-outcome events.

## Stop Conditions

- Stop if the requested cutoff is not intended to be July 1, 2026.
- Stop if the profile API has another independent game-record producer that would disagree with the shared service.
- Do not mutate or delete historical CalendarEvent rows; this is a read-scope correction only.

## Slices

- [x] Slice 1: Add a Central-time July 1, 2026 lower bound to `gameRecordEventWhere`.
- [x] Slice 2: Add focused regression coverage for the July 1 boundary, preserving existing tally and dimension coverage.
- [x] Slice 3: Sync the Users area contract and run focused source/build verification.

## Verification

- [x] `npx vitest run tests/game-record.test.ts` — 15 tests passed.
- [x] `npx tsc --noEmit --pretty false` — passed.
- [x] `npm run lint` — passed with one pre-existing unused-variable warning in `scripts/backfill-signature-artifacts.ts:511`.
- [x] `npm run codemap` and `npm run verify:docs` — passed; codemaps are current.
- [x] `git diff --check` — passed.
- [x] `npm run build:app` — passed; Next compiled and generated 233 pages.
- [ ] Authenticated browser smoke confirms the current profile no longer shows the pre-July 2–1 test record.

## Review

- Shipped: The shared profile game-record query now applies an app-timezone `startsAt >= July 1, 2026` boundary; historical CalendarEvent rows were not changed or deleted.
- Verified: Focused game-record tests, TypeScript, lint, codemap/docs verification, diff check, and the app build all passed.
- Deferred: Deployment and post-deploy production profile smoke were not requested and were not performed.
- Blocked: The available authenticated browser session is on production, so it cannot prove the locally changed source before deployment; no local authenticated session was available.
- Proof artifacts: `src/lib/services/game-record.ts`, `tests/game-record.test.ts`, and `docs/AREA_USERS.md`.
- Next slice or stop: Stop here. Deploy and run the authenticated profile smoke only when explicitly requested.
