# iOS Reservation Post-Create and Conflict Recovery Plan

## Goal

- Make every production reservation entry point open the newly created reservation.
- Return create-time availability conflicts to Gear with all selections preserved and a visible recovery explanation.

## Route

- Owner area: Reservations
- Secondary area: Mobile Operations and Schedule
- Ledger: `tasks/archive/completed-2026-07/`
- Existing reference: `tasks/archive/completed-2026-07/ios-reservation-gear-review-polish-plan.md`

## Source Checks

- Bookings, Items, and Item Detail already consume the created booking ID and navigate to Booking Detail.
- Event Detail previously discarded the created booking ID.
- `APIClient.perform` previously flattened HTTP 409 into `APIError.serverError`, so Create Reservation could not select a conflict-specific recovery route.
- Create Reservation owns its view model for the life of the sheet, so moving from Review back to Gear preserves serialized and bulk selections.

## Stop Conditions

- Stop if adding a typed 409 case changes server payload or booking mutation semantics.
- Stop if Event Detail does not own the NavigationStack that presents Create Reservation.

## Slices

- [x] Add a typed client conflict error while retaining existing user-facing error text.
- [x] Route create-time conflicts back to Gear, refresh the advisory preflight, and show a selection-preserving recovery message.
- [x] Make Event Detail navigate to the newly created reservation and replace its stale reserve prompt.
- [x] Add focused native source-contract coverage and sync area docs.

## Verification

- [x] Focused reservation and API source-contract tests: 54 passed.
- [x] Full native source-contract suite: 235 passed across 56 files.
- [x] `npm run drift:ios`: no anti-patterns across 79 Swift files.
- [x] `npm run audit:ios:gaps`: 51 of 51 audit-worthy surfaces covered.
- [x] `npm run verify:docs`: codemaps current.
- [x] Wisconsin generic iOS Simulator build: `BUILD SUCCEEDED`.
- [x] `git diff --check`.

## Review

- Shipped: consistent Event Detail completion routing and structured availability-conflict recovery.
- Verified: source contracts, drift, audit coverage, docs, diff hygiene, and simulator compilation.
- Deferred: authenticated runtime walkthrough and physical-device visual proof.
- Blocked: none.
- Next slice or stop: stop; the requested recovery slice is complete.

