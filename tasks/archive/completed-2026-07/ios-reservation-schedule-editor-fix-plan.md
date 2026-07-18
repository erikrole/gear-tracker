# Native Reservation Schedule Editor Fix

## Goal

- Make manual pickup and return editing reliable, expose the same controls for event-linked reservations, and seed linked events with practical setup and teardown time.

## Route

- Owner area: Mobile Operations
- Secondary area: Reservations
- Ledger: this plan, then `tasks/archive/completed-2026-07/` after verification
- Existing reference: `tasks/archive/completed-2026-07/ios-reservation-setup-interaction-polish-plan.md`

## Source Checks

- `CreateBookingSheet` currently shows schedule controls only for Manual mode.
- The current combined UIKit date-and-time bridge is unique to this flow and manual pickup edits preserve duration by moving return time implicitly.
- `CreateBookingViewModel.applySelectedEventsToDetails()` currently uses the exact first-event start and last-event end.
- The accepted multi-event brief keeps explicit start and end values user-editable after event selection.

## Stop Conditions

- Stop if the reservation API does not accept explicit dates alongside `eventIds` or if event defaults would overwrite a user-edited window.
- Stop if a picker replacement changes the reservation payload or requires a new deployment target.

## Slices

- [x] Replace the combined picker with explicit native date and 15-minute time controls and keep pickup/return edits independent.
- [x] Show the schedule editor after event selection and default to one hour before the first event through two hours after the last event.
- [x] Preserve prefilled event behavior, conflict refresh, accessibility, and user overrides.
- [x] Update focused contracts and shipped-area documentation.

## Verification

- [x] Focused reservation source-contract tests.
- [x] Full native source-contract suite.
- [x] iOS drift and audit-gap checks.
- [x] Generic iOS Simulator Xcode build.
- [x] `npm run codemap`, `npm run verify:docs`, and `git diff --check`.

## Review

- Shipped: reliable Manual date and 15-minute time controls, independent pickup and return edits, editable Event Linked windows, and one-hour-before/two-hours-after event defaults.
- Verified: 23 focused contracts, all 251 native source contracts, iOS drift and gap audits, generic Simulator build, simulator launch, documentation gates, physical-device signed build, install, and launch.
- Deferred: the live picker tap-through remains a human visual check because simulator UI automation launched successfully but did not reliably switch into Bookings.
- Blocked: none.
- Proof artifacts: `** BUILD SUCCEEDED **` for Simulator and Erik's iPhone; `devicectl` confirmed install and launch of `com.erikrole.Wisconsin`.
- Next slice or stop: stop; wait for physical-device UX feedback.
