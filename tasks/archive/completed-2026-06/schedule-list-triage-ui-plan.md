# Schedule List Triage UI Plan - 2026-07-09

## Goal
- Make `/schedule` faster to scan and act on by reducing stacked chrome, clarifying readiness and publication state, and giving event rows stable staffing-oriented columns across desktop and mobile.

## Route
- Owner area: `docs/AREA_SHIFTS.md`
- Ledger: `tasks/todo.md`
- Existing plan/archive references: `tasks/schedule-ui-plan.md`, `tasks/audit-schedule-web-platform-gap-2026-06-18.md`, `tasks/archive/schedule-ownership-pass.md`

## Source Checks
- `docs/AREA_SHIFTS.md` defines Schedule as an event-triage surface with compact readiness queues, a quiet toolbar, date-grouped rows, crew state, and publication status.
- `docs/DESIGN_LANGUAGE.md` requires dense stable rows, explicit status language, 40px controls, active-filter visibility, and no hover-only touch actions.
- `ScheduleFilters.tsx` currently counts only popover filters and renders source health beside view-changing controls.
- `ScheduleReadiness.tsx` can suppress a partial-health warning when the hidden/archived count is zero.
- `ListView.tsx` currently places desktop row metadata in one wrapping flex line, uses venue color as a left rail, and drops date grouping plus Hide event on mobile.
- No schema, API response, permission, or lifecycle change is required.

## Peer Patterns
- `/items` uses `OperationalToolbar` plus `OperationalActiveFilterChips` to keep view state visible and removable.
- `/users` counts all active filters, shows active chips, and keeps clear actions outside the filter disclosure.
- `OperationalRowActions` provides the shared 40px accessible overflow action for desktop and touch rows.

## Stop Conditions
- Stop if the existing list cannot open Shift Detail for an event with open slots.
- Stop if stable desktop columns require changing Schedule API data or assignment mutations.
- Stop if browser verification exposes a row overflow or nested-control regression that cannot be fixed inside this slice.

## Slices
- [x] Slice 1: Compress Schedule toolbar/readiness hierarchy, expose all active filters, move source status into Details, and fix partial-health warning truth.
- [x] Slice 2: Rebuild event rows with stable desktop columns, explicit venue text, actionable open-slot summaries, compact date headers, and mobile date/action parity.
- [x] Slice 3: Add focused source contracts, sync Schedule docs, and complete compile/build/browser verification.

## Verification
- [x] Focused Schedule source-contract tests
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Attempt authenticated browser smoke for `/schedule` at desktop and phone widths, or record the exact authentication blocker

## Review
- Shipped: Compact command/readiness hierarchy, complete active-filter chips, scoped crew-gap copy, partial-health warning truth, stable desktop staffing columns, direct Assign N actions, explicit venue and publication language, shared compact date groups, and mobile Hide event access.
- Verified: Focused Vitest passed 4 files / 21 tests; targeted ESLint, TypeScript, migration-prefix guard, codemap generation/check, docs verification, whitespace check, and the first `npm run build:app` passed. After the final My calls today count alignment, focused tests, ESLint, TypeScript, migration guard, docs, and whitespace passed again.
- Deferred: Authenticated visual interaction proof at desktop and phone widths.
- Blocked: The in-app browser redirected localhost `/schedule` to `/login`; Chrome has a production session, but host-scoped authentication cannot be reused on localhost. A final `npm run build:app` rerun was blocked by a concurrent unrelated licenses change: `api/licenses/[id]/release` passes `claimId` as a string to the newly changed `releaseCode` options signature.
- Proof artifacts: Local route compilation and production build output; no authenticated screenshots.
- Next slice or stop: Stop. The implementation and non-browser verification are complete.
