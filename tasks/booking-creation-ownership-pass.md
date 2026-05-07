# Booking Creation Ownership Pass - 2026-05-07

## Goal
- Make checkout and reservation creation resilient across event-linked, ad hoc, multi-event, and draft-resume paths without changing the shipped wizard model.

## Peer patterns checked
- Bookings list: URL and deep-link state must survive across the booking surface.
- Items detail forms: inline recovery paths should preserve user-entered context instead of forcing a restart.
- Schedule/events: event-linked operations need enough future range for real planning, not only near-term events.
- Items list: use quiet shadcn toolbar/control rhythm, `PageHeader`, `Button` variants, `Switch`, `ToggleGroup`-style segmented steps, exact transitions, and dense bordered surfaces instead of bespoke wizard chrome.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [x] Event detail gear shortcuts: keep using `requesterUserId` and event context deep links into the wizard.
- [x] Future event creation helpers: reuse the 30-day booking event window unless a narrower operational flow is intentional.

## Review
- Shipped: checkout/reservation creation now loads a 30-day event window, labels the window consistently, and saves draft event links through `/api/drafts` with ordered `BookingEvent` rows. Draft resume now returns ordered `events[]` and restores `selectedEvents` in the wizard.
- Verified: `npx tsc --noEmit`, focused Vitest coverage for draft routes and booking creation, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools smoke checks on `/checkouts/new` and `/reservations/new`.
- Deferred: no additional propagation needed in this slice; the event detail/requester deep-link behavior was preserved rather than changed.

## Item-list styling follow-up
- [x] Replace bespoke creation header with the shared `PageHeader` pattern.
- [x] Replace raw toggle, step buttons, and draft dismiss button with shadcn `Switch`/`Button` composition.
- [x] Move Step 1 form rhythm toward the item form/list standard: shared `Label`, bordered quiet surfaces, exact transitions, no `transition-all`, and fewer inline styles.
- [x] Carry the same section-heading and shadcn alert treatment through Step 2 and Step 3.
- [x] Re-run type, focused booking tests, whitespace, build, and browser smoke on checkout/reservation creation.

## Item-list styling review
- Shipped: booking creation now follows the Items list/header/form rhythm more closely: `PageHeader`, shadcn `Badge`, `Button`, `Switch`, shared `SectionHeading`, item-style `FormRow`/`FormRow2Col`, quiet bordered card surfaces, and exact transition classes.
- Verified: browser smoke passed on `/checkouts/new` and `/reservations/new` with no console messages after label association fixes.
- Deferred: the `EquipmentPicker` internals remain unchanged because they are shared with booking detail editing and already have their own picker roadmap.
