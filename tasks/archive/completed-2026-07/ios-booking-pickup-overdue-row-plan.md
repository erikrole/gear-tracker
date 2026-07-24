# iOS Booking Pending Pickup Row Plan - 2026-07-23

## Goal

- Make a booked reservation visibly become due for pickup in the native Bookings list as soon as its scheduled pickup time passes.

## Route

- Owner area: Mobile Operations
- Secondary area: Reservations
- Ledger: `tasks/archive/completed-2026-07/ios-booking-pickup-overdue-row-plan.md`

## Source Checks

- `BookingsView.BookingRow` kept every `BOOKED` reservation purple and hid its status after `startsAt`.
- The requested treatment is derived display state and must not change the API payload, stored lifecycle state, actions, permissions, or kiosk behavior.

## Stop Conditions

- Stop if the fix requires mutating a reservation or treating it as checkout custody.
- Stop if display derivation changes row action eligibility or navigation payloads.

## Slices

- [x] Derive a live Pending Pickup presentation for `BOOKED` reservations whose `startsAt` has passed.
- [x] Order reservations by pickup time and checkouts by due-back time.
- [x] Refresh the full row on the existing minute cadence.
- [x] Add focused source-contract coverage and sync area docs.

## Verification

- [x] Focused iOS booking row source-contract tests.
- [x] Native project and affected-target build.
- [x] Docs and whitespace checks.

## Review

- Shipped: Due booked reservations turn orange and say `Pickup was due ...` without changing lifecycle or custody state.
- Deferred: Exact production-backed row confirmation requires an authenticated installed client.
