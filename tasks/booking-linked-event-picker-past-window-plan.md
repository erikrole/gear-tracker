# Linked Event Picker Past-Window Fix Plan - 2026-08-20

## Goal

- Keep the shared booking linked-event editor focused on events that are in progress or upcoming.
- Preserve already-linked historical events in the dialog so operators can see and remove existing links without reintroducing unrelated past events.

## Route

- Owner area: Reservations, shared with Checkouts through `EditBookingEventsDialog`.
- Ledger: this active plan; no existing plan owns the dialog-specific picker window.
- Scope: `src/components/booking-details/EditBookingEventsDialog.tsx` and focused source-contract coverage.

## Source Checks

- `EditBookingEventsDialog` currently requests `startDate = now - 7 days` through `endDate = now + 120 days` with `includePast=true`.
- `/api/calendar-events` uses the explicit start/end overlap window, so a start date of `now` excludes events that ended before the picker opened.
- The dialog already merges current booking links into the API result; that fallback preserves historical links needed for unlinking.
- The creation wizard separately uses its documented 30-day upcoming-event window and is not part of this slice.

## Stop Conditions

- Stop if the shared dialog is not the only consumer of this edit-picker behavior or if current linked-event preservation requires a different API contract.
- Stop if authenticated browser evidence shows current linked events cannot be removed after the API window narrows.
- Do not change booking lifecycle, custody, event-link mutation authorization, or schema behavior.

## Slices

- [x] Slice 1: Narrow the edit-dialog calendar query to current/future overlap, preserve current links, add regression coverage, and sync area docs.

## Verification

- [x] Focused linked-event/dialog and calendar-event query tests.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs` when docs/source ownership checks require them.
- [x] `git diff --check`
- [ ] Authenticated browser smoke of the linked-events dialog at desktop and tablet widths, including current-link retention and absence of unrelated past events; record a blocker if the existing session/runtime cannot provide it.

## Review

- Shipped locally: The shared edit dialog now queries from the current moment through its existing 120-day lookahead; unrelated ended events no longer enter the selectable list, and current historical links remain merged for removal. Both Reservations and Checkouts area docs record the boundary.
- Verified: 35 focused picker/calendar tests, `npx tsc --noEmit --pretty false`, `npm run lint` (0 errors; one pre-existing warning), `npm run build:app`, `npm run codemap`, `npm run verify:docs`, and `git diff --check` pass.
- Deferred: Authenticated browser smoke of the changed bundle at desktop and tablet widths.
- Blocked: Local preview on `127.0.0.1:3001` redirected the checkout route to `/login`; the authenticated production tab still serves the pre-fix bundle. No deployment or production mutation was requested.
- Proof artifacts: `tests/booking-linked-event-picker.test.ts`, `tests/calendar-events-route.test.ts`, `tests/schedule-event-where.test.ts`; production baseline DOM showed unrelated Aug 13–19 rows and no console warnings/errors.
- Next slice or stop: Stop source work here. After an authenticated preview/deployment is available, verify current-link retention and absence of unrelated past events, then archive this plan.
