# Schedule Local Date Ordering Plan - 2026-08-18

## Goal

- Keep the web Schedule list in chronological Central/local display order when all-day events (encoded at UTC midnight) and timed events share the same window.
- Preserve all-day date-only semantics while leaving timed event clock values in the user-facing local timezone.

## Route

- Owner area: Schedule / Events (`/schedule` list view)
- Ledger: this bounded plan; archive under `tasks/archive/completed-2026-08-18/` after closeout.
- Existing related contract: `tasks/multi-day-all-day-events-plan.md` and `tasks/lessons.md` define all-day values as encoded dates, not display instants.

## Source Checks

- `src/app/api/calendar-events/route.ts` returns events ordered by stored `startsAt`, which is an absolute database instant.
- `src/hooks/use-schedule-data.ts` groups filtered entries by `calendarDate(entry.startsAt, entry.allDay)` but currently preserves the API's absolute-instant order.
- `src/lib/format.ts` decodes all-day values through UTC date parts and leaves timed values as local instants; `src/lib/calendar-event-dates.ts` owns related all-day display helpers.
- `src/app/(app)/schedule/_components/ListView.tsx` renders both desktop and mobile date groups from `groupedEntries`.
- Central is the configured app timezone (`APP_TIMEZONE`, default `America/Chicago`); the display contract must not use raw UTC ordering for the list.

## Stop Conditions

- Stop if the current event payload does not include `allDay` or if the list is not the owner of the incorrect ordering.
- Stop if the fix would change persisted event timestamps, API filtering, calendar sync semantics, or worker-facing schedule contracts.
- Do not claim authenticated browser or production proof if the local session is unavailable.

## Slices

- [x] Slice 1: Add a pure display-order helper that compares encoded all-day calendar dates with timed local instants, then apply it before Schedule filtering/grouping.
- [x] Slice 2: Add regression coverage for a late Central timed event followed in UTC by the next day's all-day UTC-midnight event.
- [x] Slice 3: Sync the Schedule changelog and archive this plan after verification.

## Verification

- [x] `npx vitest run tests/calendar-event-dates.test.ts` and the focused Schedule source-contract slice
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [ ] Authenticated browser smoke of `/schedule` at desktop and narrow responsive widths; blocked by missing local `SESSION_COOKIE_NAME` in the dev environment, with the recovery boundary and console error captured.

## Review

- Shipped: Schedule list entries now sort by rendered local/Central display day before date grouping; all-day date encoding, timed display, API ordering, sync, and schedule authority are unchanged.
- Verified: 16 focused tests, focused ESLint, full TypeScript, full lint, `npm run build:app`, regenerated codemaps/docs verification, and `git diff --check` pass. Full lint retains one pre-existing unused-variable warning in `scripts/backfill-signature-artifacts.ts`.
- Deferred: None for this bounded fix.
- Blocked: Authenticated desktop/narrow browser proof is unavailable because local dev fails closed on missing `SESSION_COOKIE_NAME`; no schedule data was mutated.
- Proof artifacts: Focused regression in `tests/calendar-event-dates.test.ts`; browser recovery page showed Error ID `2165316873` and the missing environment variable in console logs.
- Next slice or stop: Stop implementation here; deploy/production and authenticated browser acceptance remain separate gates.
