# Schedule Event Classification Plan - 2026-07-09

## Goal
- Restore a left-edge color rail that distinguishes Home, Away, Neutral, and Non-game events at a glance.
- Make manual event creation preserve an explicit game or non-game classification so media days cannot silently render as neutral-site games.

## Route
- Owner area: Schedule (`docs/AREA_SHIFTS.md`)
- Ledger: `tasks/todo.md`
- Existing references: `tasks/archive/schedule-ownership-pass.md`, `tasks/archive/completed-2026-06/schedule-list-triage-ui-plan.md`

## Source Checks
- `CalendarEvent` already represents non-game events through `opponent = null`; Event detail uses the same contract and no schema migration is needed.
- `NewEventSheet` currently defaults to Non-game but only shows the type control after a sport is selected and posts no explicit event type.
- `POST /api/calendar-events` currently accepts independent `sportCode`, `isHome`, and `opponent` values, so incomplete game payloads can collapse into the non-game representation.
- `venueToneFromEvent` currently maps every `isHome = null` event to Neutral even when `opponent = null`.
- The former List view rail used `VENUE_TONES[*].railClass`; it was removed during the 2026-07-09 row-layout pass.

## Stop Conditions
- Stop if current API consumers require opponent-free game creation.
- Stop if explicit Non-game classification requires a new persisted field instead of the existing opponent-null contract.
- Stop if peer Schedule surfaces cannot consume a fourth shared event tone without changing their data contracts.

## Slices
- [x] Slice 1: Harden the manual-event form and POST contract around explicit Home, Away, Neutral, and Non-game values.
- [x] Slice 2: Extend shared event-tone classification to Non-game and restore the List view rail on desktop and mobile.
- [x] Slice 3: Add focused route, helper, filter, and source-contract regression coverage.
- [x] Slice 4: Sync Schedule docs and close verification.

## Verification
- [x] Focused Vitest for calendar-event creation, venue classification, and Schedule source contracts.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated browser smoke for `/schedule`, including New event and list rails, or record why blocked.

## Review
- Shipped: Manual creation now submits an explicit event type; the API requires sport/opponent for games, derives `isHome`, preserves optional sport context for non-games, and locks the manual classification. Shared event tones and filters distinguish Non-game, and List rows restore desktop/mobile color rails.
- Verified: 32 Schedule/Dashboard Vitest files (164 tests), focused ESLint, TypeScript, migration-prefix guard, codemap/docs verification, whitespace, and `npm run build:app`.
- Deferred: None.
- Blocked: Authenticated local visual proof. A fresh local server rendered the expected protected-route redirect, but the in-app browser had no localhost session and Chrome's signed-in Schedule session was production-host scoped. No production mutation was attempted.
- Proof artifacts: Test/build output in the current Codex task; no screenshot claimed.
- Next slice or stop: Stop. The requested slice is complete.
