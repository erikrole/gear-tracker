# iOS Tabs And Buttons Readiness Plan

Created: 2026-06-03

## Goal

Make the native app's tabs and high-frequency buttons clearer while fixing the booking edit stale-write contract that blocks iOS reservation edits against the hardened API.

## Source Audit

- `AGENTS.md`: plan first, read full touched files before editing, keep slices narrow, verify before done, sync docs.
- `docs/AREA_MOBILE.md`: mobile is student-first, action-first, scan stays one tap away, tap targets stay at least 44 pt, and student flows prioritize owned bookings.
- `docs/AREA_RESERVATIONS.md` and `docs/AREA_CHECKOUTS.md`: booking edits must preserve concurrency safety and checkout custody remains kiosk-owned.
- `docs/AREA_KIOSK.md` and `docs/AREA_SCAN.md`: Scan remains lookup-only outside kiosk custody flows.
- `docs/IOS_PATTERNS.md`: toolbar and row actions should be real `Button`s, errors must surface, and new decoded fields must tolerate production skew.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: manual QA currently calls out Bookings, the mine toggle, and scan one-tap navigation.
- `docs/DECISIONS.md`: mobile is student-first and booking is unified, while students retain broad read visibility without needing a primary Users tab.
- `docs/GAPS_AND_RISKS.md`: iOS power-user list filters remain expected gaps; do not port desktop controls.
- `src/app/api/bookings/[id]/route.ts`: PATCH requires `If-Unmodified-Since` and returns 428 or 409 for missing or stale snapshots.
- `ios/Wisconsin/Core/APIClient.swift`, `ios/Wisconsin/Models/Models.swift`, `ios/Wisconsin/Views/BookingDetailView.swift`, `ios/Wisconsin/Views/AppTabView.swift`, and `ios/Wisconsin/Views/BookingsView.swift`: touched source for this slice.

## Slice Plan

- [x] Fix iOS booking edit PATCH calls to send the booking snapshot timestamp in `If-Unmodified-Since`.
- [x] Decode `Booking.updatedAt` defensively as optional so older production payloads do not break native reads.
- [x] Make the native booking shell describe the active list as `Reservations` or `Checkouts`, not a generic nested Bookings screen.
- [x] Make toolbar controls visible enough for field use: `Mine`/`All` and `New` instead of icon-only mystery controls.
- [x] Default students to their own gear while preserving the ability to switch to all visible bookings.
- [x] Keep Scan one tap away and do not add custody scan actions to phone booking screens.
- [x] Hide the Users tab from the student primary tab bar to keep student field execution to five destinations.
- [ ] Run focused static tests, TypeScript, iOS drift/gap checks, XcodeBuildMCP simulator build, and whitespace checks.
- [ ] Update docs and record verification.

## Acceptance Criteria

- [x] iOS edit booking calls satisfy the current API optimistic-lock contract.
- [x] A stale booking edit surfaces the server's refresh-and-try-again copy instead of silently overwriting.
- [x] Students land on their own reservation/checkout work by default.
- [x] The active booking list title matches the visible segment.
- [x] Toolbar buttons expose their intent without requiring VoiceOver or prior product knowledge.
- [x] Student primary tabs stay action-first and avoid non-field directory clutter.

## Review

Pending verification.
