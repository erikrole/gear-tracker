# Personal Calendar All-Day Export Fix Plan - 2026-08-11

## Goal
- Make date-only Schedule assignments subscribe to Apple Calendar as all-day events instead of UTC-midnight timestamps that render as 7 PM to 7 PM in Central time.

## Route
- Owner area: Shift Calendar & Scheduling
- Secondary area: Events and Calendar Sources
- Ledger: this bounded active plan
- Existing plan/archive references: `tasks/todo.md` personal calendar subscription sync hardening; `tasks/ios-shift-calendar-widgets-plan.md`

## Source Checks
- `src/app/api/shifts/ics/[token]/route.ts` currently selects event start/end but not `CalendarEvent.allDay`, then serializes every assignment as UTC `DATE-TIME` values.
- The current Football vs Michigan State Homecoming row is a valid imported all-day event stored from `2026-10-03T00:00:00Z` through the exclusive end `2026-10-04T00:00:00Z`; exporting those instants as date-times causes Apple Calendar in Central time to show 7 PM Friday through 7 PM Saturday.
- D-045 and `docs/AREA_SHIFTS.md` require all-day events to retain date-only boundaries. Explicit Student call-window overrides remain timed.

## Stop Conditions
- Stop if the feed does not expose the event `allDay` flag, if stored all-day boundaries are not valid UTC date boundaries, or if focused tests show an explicit Student call window would be converted to all-day.

## Slices
- [x] Slice 1: export inherited all-day assignment windows with RFC 5545 `VALUE=DATE` start/end properties while preserving timed events and explicit Student call windows.
- [x] Slice 2: add focused feed regressions for imported all-day events and explicit Student call-window overrides.
- [x] Slice 3: synchronize Schedule/Events documentation and close this plan with verification evidence.

## Verification
- [x] `npx vitest run tests/shift-ics-feed.test.ts`
- [x] `npx eslint 'src/app/api/shifts/ics/[token]/route.ts' tests/shift-ics-feed.test.ts`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Feed-level runtime proof for the affected all-day assignment, or record why the private token proof is unavailable.

## Review
- Shipped: inherited all-day worker assignments now serialize as RFC 5545 date values and receive a one-step component revision bump so existing subscribers accept the corrected representation; timed events and explicit Student call windows retain UTC date-time output.
- Verified: 9 focused feed tests, focused ESLint, TypeScript, codemap generation/check, docs verification, whitespace check, and the production app build pass.
- Deferred: production deployment and Apple Calendar's post-deploy subscription refresh require explicit shipping authorization and Apple's refresh cycle.
- Blocked: none.
- Proof artifacts: read-only current-data inspection confirmed Football vs Michigan State Homecoming is stored as an all-day `2026-10-03` through exclusive `2026-10-04` event; rendering the affected assignment through the locally fixed private-feed route produced the bumped `SEQUENCE:1786376148`, `DTSTART;VALUE=DATE:20261003`, and `DTEND;VALUE=DATE:20261004` without exposing its token.
- Next slice or stop: stop locally; ship through `gt-ship` only when explicitly requested.
