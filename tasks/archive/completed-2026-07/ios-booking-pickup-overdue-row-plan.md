# iOS Booking Pending Pickup Row Plan - 2026-07-23

## Goal

- Make a booked reservation visibly become overdue for pickup in the native Bookings list as soon as its scheduled pickup time passes.

## Route

- Owner area: Mobile Operations
- Secondary area: Reservations
- Ledger: `tasks/archive/completed-2026-07/ios-booking-pickup-overdue-row-plan.md`
- Existing references: `tasks/audit-bookings-list-ios.md`, `tasks/archive/completed-2026-07/ios-bookings-surface-polish-plan.md`

## Source Checks

- `BookingsView.BookingRow` currently keeps every `BOOKED` reservation purple and hides its status pill even after `startsAt`.
- The row's minute timeline refresh is scoped to timing text, so its rail and status visibility cannot transition with time.
- D-012 and D-040 keep a reservation `BOOKED` until kiosk pickup creates linked checkout custody and completes the reservation.
- The requested missed-pickup treatment is therefore display-only and must not change the API payload, stored lifecycle state, actions, permissions, or kiosk behavior.

## Stop Conditions

- Stop if the fix requires mutating a reservation or treating it as checkout custody.
- Stop if a display derivation changes row action eligibility or navigation payloads.
- Stop if the native list cannot refresh the derived state without adding a polling request.

## Slices

- [x] Derive a live overdue-pickup presentation for `BOOKED` reservations whose `startsAt` has passed.
- [x] Refresh the full row presentation on the existing minute cadence and preserve raw booking state for all actions.
- [x] Add focused source-contract coverage for the time boundary, status copy, rail tone, and lifecycle boundary.
- [x] Sync Mobile and Reservations area docs with the verified display-only behavior.

## Verification

- [x] Focused iOS booking row source-contract tests.
- [x] Full native source-contract suite attempted; 314 tests pass and four unrelated dirty-worktree contracts fail in profile, Schedule, and deep-link work.
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin simulator build and launch.
- [x] `npm run verify:docs` attempted; blocked by pre-existing `docs/CODEMAPS/architecture.md` drift from parallel work.
- [x] `git diff --check`

## Review

- Shipped: Past-due booked reservations turn orange and say `Pickup was due ...` on the native Bookings row without changing their lifecycle or custody state.
- Verified: 18 focused contracts pass; the Wisconsin simulator build and launch, project parity, iOS drift, audit gap inventory, and whitespace checks pass.
- Deferred: None in the implementation.
- Blocked: Exact Trey-row runtime proof is unavailable because the signed-in simulator's current queue does not contain that reservation. Full native source and docs gates retain unrelated dirty-worktree failures recorded above.
- Proof artifacts: XcodeBuildMCP simulator build/run succeeded without warnings; launched-app screenshot captured on the signed-in Home screen.
- Next slice or stop: Stop. Recheck the exact row on the user's production-backed device after installing this build.
