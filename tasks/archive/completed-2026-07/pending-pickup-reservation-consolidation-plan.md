# Pending Pickup Reservation Consolidation Plan - 2026-07-23

## Goal

- Make Pending Pickup mean one thing operationally: a booked reservation whose scheduled pickup time has arrived but whose kiosk handoff has not happened.
- Start the configured no-show clock at the reservation's `startsAt`, cancel and release it after the window, and stop creating new staged `PENDING_PICKUP` checkout records.

## Route

- Owner area: Reservations
- Secondary areas: Mobile Operations, Dashboard, Items, Kiosk, Settings
- Ledger: `tasks/archive/completed-2026-07/pending-pickup-reservation-consolidation-plan.md`
- Existing reference: `tasks/archive/completed-2026-07/ios-booking-pickup-overdue-row-plan.md`

## Source Checks

- Normal app/web creation produces `BOOKED` reservations and direct checkout creation is blocked outside kiosk.
- Kiosk pickup accepts due `BOOKED` reservations, stages scans on the reservation, atomically creates linked `OPEN` checkout custody, and completes the reservation.
- The previous no-show service expired only legacy `CHECKOUT/PENDING_PICKUP` rows even though the setting lives under Reservation Rules.
- `PENDING_PICKUP` remains in the Prisma enum and installed clients, so removing it before legacy rows drain would break rollout compatibility.

## Stop Conditions

- Stop if reservation expiry would restore checkout stock movements that were never created for a reservation.
- Stop if expiry cannot atomically cancel the reservation, deactivate serialized allocations, cancel open scan sessions, and write system audit evidence.
- Stop if a read-model change would make a due reservation disappear from kiosk pickup.
- Stop before deleting the enum or legacy kiosk confirmation path without a verified zero-row production check.

## Slices

- [x] Make kiosk-created checkout records open directly as custody instead of creating a new staged state.
- [x] Expand no-show expiry to due `BOOKED` reservations while retaining legacy staged-checkout cleanup.
- [x] Derive started booked reservations as Pending Pickup in operational read models.
- [x] Make native Bookings and Item Detail use the consolidated Pending Pickup language without mutating raw reservation state.
- [x] Update Reservation Rules copy, decisions, area docs, gaps, and focused tests.

## Verification

- [x] Focused booking creation, no-show expiry, status, dashboard, and native source-contract tests.
- [x] TypeScript, lint, production web build, docs, and whitespace gates.
- [x] Native project and affected-target build.

## Review

- Shipped: Pending Pickup now means a due booked reservation awaiting kiosk fulfillment. New kiosk checkouts open directly as custody, and the configured no-show window starts at reservation `startsAt`.
- Deferred: Delete the raw `PENDING_PICKUP` enum and legacy kiosk branches only after a production zero-row check. Tracked as GAP-61.
- Next slice or stop: Stop. Compatibility deletion is a separate production-data migration.
