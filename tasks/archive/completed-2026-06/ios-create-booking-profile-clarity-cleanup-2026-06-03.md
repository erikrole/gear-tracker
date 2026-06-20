# Completed iOS Create Booking and Profile Clarity Cleanup - 2026-06-03

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: iOS Create Booking Control Clarity (2026-06-03)
- [x] Audit mobile, checkout, reservation, iOS patterns, walkthrough, create-booking audit notes, and current `CreateBookingSheet`.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-create-booking-control-clarity-plan-2026-06-03.md`.
- [x] Make Create Booking step actions self-describing.
- [x] Add selected-equipment visibility and one-tap removal.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/ios-create-booking-control-clarity-plan-2026-06-03.md`.
- Current root issue: CreateBookingSheet is functionally hardened, but Step 2 only shows a selected count, so removing already-picked equipment can require finding it again in the search results.
- Implemented: Step 1 advances with Choose Equipment, final submit reads Create Reservation, and Step 2 shows selected equipment with visible Remove controls backed by selected asset snapshots.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

## Completed: iOS Profile Controls Clarity (2026-06-03)
- [x] Audit mobile, users, shifts, notifications, availability brief, walkthrough, profile audit notes, and current `AppTabView`.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-profile-controls-clarity-plan-2026-06-03.md`.
- [x] Make Profile notification and availability controls self-describing.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/ios-profile-controls-clarity-plan-2026-06-03.md`.
- Current root issue: Profile has the right mobile settings, but some high-use controls still rely on short labels or icon-only toolbar actions that are easy to forget in field use.
- Implemented: notification controls now read Pause alerts, Email alerts, and Push alerts; My Availability now exposes Add availability block in the list and Add block in the toolbar.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.
