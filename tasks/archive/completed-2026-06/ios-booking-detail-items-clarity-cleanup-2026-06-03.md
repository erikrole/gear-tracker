# Completed iOS Booking Detail and Items Clarity Cleanup - 2026-06-03

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: iOS Booking Detail Control Clarity (2026-06-03)
- [x] Audit mobile, checkout, reservation, walkthrough, booking-detail audit notes, and current `BookingDetailView`.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-booking-detail-control-clarity-plan-2026-06-03.md`.
- [x] Make Booking Detail edit state self-describing.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/ios-booking-detail-control-clarity-plan-2026-06-03.md`.
- Current root issue: Booking Detail still relies on a top-right pencil that disappears when a student-owned booking moves past the editable state.
- Implemented: editable bookings now show a labeled Edit action, and owner-access locked bookings show an Editing locked notice with Extend/kiosk handoff copy.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

## Completed: iOS Items Control Clarity (2026-06-03)
- [x] Audit mobile, items, iOS patterns, walkthrough, items audit notes, and current native item/booking detail controls.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-items-control-clarity-plan-2026-06-03.md`.
- [x] Replace icon-only Items filters with visible labeled controls.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/ios-items-control-clarity-plan-2026-06-03.md`.
- Current root issue: Items list still scopes the whole list through icon-only Favorites and Status controls, which is easy to forget in field use.
- Implemented: Items now shows Favorites and All statuses controls above the list instead of using the top-right icon-only filter cluster.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.
