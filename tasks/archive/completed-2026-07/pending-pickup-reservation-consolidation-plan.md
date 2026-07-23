# Pending Pickup Reservation Consolidation Plan - 2026-07-23

## Goal

- Make Pending Pickup mean one thing operationally: a booked reservation whose scheduled pickup time has arrived but whose kiosk handoff has not happened.
- Start the configured no-show clock at the reservation's `startsAt`, cancel and release it after the window, and stop creating new staged `PENDING_PICKUP` checkout records.

## Route

- Owner area: Reservations
- Secondary areas: Mobile Operations, Dashboard, Items, Kiosk, Settings
- Ledger: `tasks/pending-pickup-reservation-consolidation-plan.md`
- Existing references: `tasks/archive/completed-2026-07/ios-booking-pickup-overdue-row-plan.md`, D-035, D-040

## Source Checks

- Normal app/web creation already produces `BOOKED` reservations and direct checkout creation is blocked outside kiosk.
- Kiosk pickup already accepts due `BOOKED` reservations, stages scans on the reservation, atomically creates linked `OPEN` checkout custody, and completes the reservation.
- The existing no-show service only expires legacy `CHECKOUT/PENDING_PICKUP` rows even though the setting lives under Reservation Rules.
- Started `BOOKED` reservations currently derive as `RESERVED`, while dashboard Pending Pickup counts and rows only read raw `PENDING_PICKUP` checkouts.
- `PENDING_PICKUP` remains in the Prisma enum and installed client models, so removing the enum before legacy rows drain would break rollout compatibility.

## Stop Conditions

- Stop if reservation expiry would restore checkout stock movements that were never created for a reservation.
- Stop if expiry cannot atomically cancel the reservation, deactivate serialized allocations, cancel open scan sessions, and write system audit evidence.
- Stop if a read-model change would make a due reservation disappear from kiosk pickup.
- Stop before deleting the enum or legacy kiosk confirmation path without a verified zero-row production migration.

## Slices

- [x] Harden `createBooking` so kiosk-created checkout records open directly as custody instead of creating a new staged state.
- [x] Expand no-show expiry to due `BOOKED` reservations while retaining legacy staged-checkout cleanup.
- [x] Derive started booked reservations as Pending Pickup in item and dashboard operational read models.
- [x] Make native Bookings use the consolidated Pending Pickup language without mutating raw reservation state.
- [x] Update Reservation Rules copy, decisions, area docs, gaps, focused tests, and closeout evidence.

## Verification

- [x] Focused booking creation, no-show expiry, status, dashboard, and native source-contract tests.
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for touched TypeScript.
- [x] `npm run build:app`
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin simulator build and launch.
- [x] `npm run verify:docs`
- [x] `git diff --check`

## Review

- Shipped: Pending Pickup now means a due booked reservation awaiting kiosk
  fulfillment. New kiosk checkouts open directly as custody, and the configured
  no-show window starts at reservation `startsAt`. The native Bookings list
  orders reservations by pickup and checkouts by due-back time, and a missed
  handoff reads `Pickup was due ...`.
- Verified: 77 focused tests, TypeScript, focused ESLint, production web build,
  native project/drift/audit gates, Wisconsin simulator build and launch,
  authenticated Bookings runtime inspection, docs verification, and diff check.
- Deferred: Delete the raw `PENDING_PICKUP` enum and legacy kiosk branches only
  after a production zero-row check. Tracked as GAP-61.
- Blocked: None.
- Proof artifacts:
  `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_21e889f9-f425-4b27-858c-2686145ef1ba.jpg`
- Next slice or stop: Stop. The compatibility deletion is a separate
  production-data migration.
