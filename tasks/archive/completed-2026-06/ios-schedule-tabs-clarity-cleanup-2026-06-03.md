# Completed iOS Schedule and Tabs Clarity Cleanup - 2026-06-03

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: iOS Schedule Control Clarity (2026-06-03)
- [x] Audit mobile, shifts, iOS patterns, walkthrough, Schedule audit notes, and current `ScheduleView`.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-schedule-control-clarity-plan-2026-06-03.md`.
- [x] Replace icon-only Schedule toggles with visible labeled controls.
- [x] Add focused contract coverage.
- [x] Sync docs and run focused iOS verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/ios-schedule-control-clarity-plan-2026-06-03.md`.
- Current root issue: Schedule has too many toolbar icons whose meaning must be memorized, especially List/Calendar, My Shifts, Past, Trade Board, and calendar subscribe.
- Implemented: Schedule now shows labeled List/Calendar, My shifts, and Past events controls above content, while toolbar actions read Trades and Calendar.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.

## Completed: iOS Tabs And Buttons Readiness (2026-06-03)
- [x] Audit mobile, reservations, checkouts, kiosk, scan, iOS patterns, decisions, gaps, current native shell, booking detail, API client, model, and booking PATCH route.
- [x] Write active slice plan in `tasks/archive/completed-2026-06/ios-tabs-buttons-readiness-plan-2026-06-03.md`.
- [x] Fix native booking edit optimistic-lock headers.
- [x] Clarify iOS tabs, booking list titles, and toolbar buttons without adding desktop filters.
- [x] Sync docs and run focused native/API verification.

**Review**
- Active tracking was archived to `tasks/archive/completed-2026-06/ios-tabs-buttons-readiness-plan-2026-06-03.md`.
- Root issue: iOS booking edits still PATCH without the required booking snapshot header, while the native Bookings shell uses generic and icon-only controls that make field actions harder to parse.
- Shipped: native booking edits now pass `If-Unmodified-Since` from optional `Booking.updatedAt`; student tabs now read Home, My Gear, Items, Scan, Schedule; Users is staff/admin-only; the booking list titles itself as Reservations or Checkouts; and toolbar actions visibly say Mine/All and New.
- Verified with focused contract tests, TypeScript, iOS drift, iOS audit inventory, XcodeBuildMCP simulator build, and whitespace checks.
