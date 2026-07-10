# Schedule Event Edit Hardening Plan - 2026-07-09

## Goal
- Keep Home, Away, Neutral, and Non-game classification correct after an event is edited, not only when it is created.
- Let Event detail repair missing sport context so the Schedule data-quality queue has a complete recovery path.

## Route
- Owner area: Schedule (`docs/AREA_SHIFTS.md`)
- Primary route: `/events/[id]`
- Ledger: `tasks/todo.md`
- Existing reference: `tasks/archive/completed-2026-06/schedule-event-classification-plan.md`

## Source Checks
- New event creation now requires an explicit event type and requires sport/opponent for games.
- Event detail derives Non-game from `opponent = null`, but its PATCH client/server still accept independent `isHome` and `opponent` changes.
- Event detail cannot edit `sportCode`, so an operator cannot repair missing sport context or safely convert a sportless non-game into a game.
- Calendar sync already preserves `isHome` and `opponent` together when `isHomeLocked` is set.
- Peer form patterns checked: `NewEventSheet` for event classification/sport requirements and Settings Sports for `SPORT_CODES`-backed sport selection.

## Stop Conditions
- Stop if changing sport context requires a schema migration or re-generating historical shifts automatically.
- Stop if another client mutates event classification through the PATCH route without sending the coupled fields.
- Stop if calendar sync does not preserve the locked classification fields together.

## Slices
- [x] Slice 1: Add sport editing and explicit event-type payloads to Event detail.
- [x] Slice 2: Harden PATCH to derive classification server-side and reject incomplete games.
- [x] Slice 3: Remove duplicate edit guards/markup discovered in the touched flow.
- [x] Slice 4: Add regression coverage and sync Schedule docs.

## Verification
- [x] Focused calendar-event route and Schedule source-contract tests.
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint.
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated browser smoke for Event detail edit, or record why blocked.

## Review
- Shipped: Event detail can repair Sport and submits event type, sport, and opponent together. PATCH derives `isHome`, rejects incomplete games and uncoupled opponent edits, and calendar sync preserves locked sport/opponent/venue classification together. Manual events stay labeled Manual and never expose calendar-restore controls.
- Verified: 39 Schedule, calendar, and Dashboard test files (288 tests), focused ESLint, TypeScript, migration guard, codemap/docs verification, whitespace, and `npm run build:app`.
- Deferred: Automatic crew regeneration after a sport edit. Existing staffing is intentionally preserved to avoid silent in-season mutations.
- Blocked: Authenticated local visual proof remains unavailable because available sessions are production-host scoped. The protected route redirect was already confirmed; no production mutation was attempted.
- Proof artifacts: Test/build output in the current Codex task; no screenshot claimed.
- Next slice or stop: Stop. The classification lifecycle is closed from create through edit and sync.
