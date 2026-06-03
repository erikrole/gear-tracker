# Multi-Day All-Day Manual Events Plan

## Goal
Add web support for manual, non-calendar-linked all-day events that span multiple dates, using `Football Media Day Shoot` on July 7-8, 2026 as the proving example.

## Source Checks
- `CalendarEvent` already stores one logical event with `startsAt`, `endsAt`, `allDay`, `sourceId`, location, sport, and crew relations. No schema change is required for a manual multi-day all-day event.
- The Schedule New Event sheet already persists all-day end dates as an exclusive next-midnight boundary. July 7 start plus July 8 end sends an end equivalent to July 9 local midnight.
- `/api/calendar-events` and `/api/shift-groups` currently filter by event start/end in a way that can hide spanning events inside month/week/list windows.
- Schedule month and week views currently place an all-day event only on its start date.
- Event detail, list rows, and booking event chips currently show one-day or timed labels that can make a multi-day all-day event look like a one-day or midnight event.
- Booking event linking already preserves one logical event through `eventIds[]`, `Booking.eventId`, and `BookingEvent`; the default booking window needs all-day-specific handling.

## Thin Slice
- [x] Add shared date helpers for all-day exclusive-end display, day expansion, and compact range labels.
- [x] Update manual event creation copy to make inclusive all-day multi-day entry clear before submit.
- [x] Update calendar-event and shift-group fetch windows to return events/groups that overlap the requested range.
- [x] Render all-day multi-day events on every covered date in schedule month/week views while linking to the same event.
- [x] Update schedule list, event detail, and booking wizard event labels to show the full all-day range.
- [x] Preserve booking linkage semantics while deriving all-day booking defaults from the full event span.
- [x] Add focused tests for date helpers, API overlap filters, manual all-day persistence, and booking default derivation.
- [x] Update area docs and gap notes after verification.

## Verification Plan
- [x] Focused tests for changed behavior.
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [ ] Authenticated browser smoke: Schedule New Event, `/schedule`, created event detail, and booking/reservation create flow linked to the multi-day manual event. Blocked: in-app browser reached `http://localhost:3008/login` and reported title `Sign in · Wisconsin Creative`, but DOM snapshot and screenshot commands timed out. HTTP smoke against the built app confirmed protected routes respond and redirect unauthenticated users to `/login`.

## Shipped
- Shared all-day date helpers in `src/lib/calendar-event-dates.ts`.
- Manual Schedule New Event all-day date labels and preview copy for inclusive multi-day ranges.
- Overlap-based `/api/calendar-events` and `/api/shift-groups` query windows so events and crew coverage remain visible inside multi-day spans.
- Schedule month/week multi-day rendering that repeats the same event record on each covered date.
- Schedule list and event detail range labels for all-day spans.
- Booking wizard linked-event labels, confirmation copy, and all-day event defaults that use the full event span without timed-game buffers.
- Manual non-sport event summaries are preserved when deriving linked booking names.

## Verified
- `npx vitest run tests/calendar-event-dates.test.ts tests/booking-all-day-event-defaults.test.ts tests/calendar-events-route.test.ts tests/calendar-events-query.test.ts tests/schedule-date-validation.test.ts` passed: 5 files, 23 tests.
- `npx tsc --noEmit` passed.
- `npm run db:migrate:check` passed: 74 migrations, no prefix collisions.
- `git diff --check` passed.
- `npx next build` passed.
- HTTP smoke on temporary built app at `http://localhost:3008`: `/schedule`, `/checkouts/new`, and `/reservations/new` returned 307 to `/login` when unauthenticated.

## Deferred
- No ICS/calendar-source sync semantic changes.
- No schema migration. The existing `CalendarEvent` start/end/allDay model already supports this slice.

## Benefits
- Staff can create Football Media Day Shoot as one July 7-8 all-day operational event instead of two unrelated records.
- Crew assignments and coverage stay attached to one event and remain visible on both dates in schedule views.
- Booking operators can link gear to the multi-day event with a full-span default window and range-based review copy.
- Schedule month/week views show each covered date while preserving one event detail link and one booking context.

## Remaining Risks
- Authenticated browser smoke remains blocked by the in-app browser automation connection timing out on DOM snapshot and screenshot after reaching the local login route.
- Existing booking DateTimePicker controls still edit booking windows as timed values; linked all-day events display all-day review copy but booking allocations remain precise start/end timestamps.

## Next Suggested Goal
- Calendar sync trust follow-up: add a compact "last sync source and freshness" signal directly to Schedule filters so staff can distinguish manual events, fresh calendar imports, stale imports, and hidden-source gaps without leaving `/schedule`.
