# Design Language State And Copy Audit Plan

## Objective

Finish Area 5 by normalizing high-traffic success, error, warning, empty, confirmation, and admin-warning language so messages say what happened, what is blocked, and what the operator can do next.

## Checklist

- [x] Read design-language rules and current goal tracker.
- [x] Read related area docs for Dashboard, Checkouts, Reservations, and Shifts.
- [x] Audit state/copy strings across high-traffic app routes and shared components.
- [x] Patch high-confidence daily-flow drift.
- [x] Update docs and goal trackers.
- [x] Run static verification and browser smoke.

## Findings

- Dashboard draft recovery copy used generic deletion/failure language even though draft rollback is visible and important.
- Booking detail confirmations asked yes/no questions without naming custody, release, or recovery consequences.
- Booking detail error toasts often said only "Failed to save/check in/extend", leaving operators without the next action.
- Shift detail confirmations did not explain whether a worker is removed, a slot reopens, or a shift slot is deleted.
- Shift detail network failures were generic "Network error" toasts and did not state whether the action saved.

## Review

- 2026-05-21: Patched dashboard draft/extend/convert feedback, booking detail extend/cancel/convert/check-in/equipment-copy, and shift detail assignment/shift/trade/archive copy to be specific and operational.
- 2026-05-21: Verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome smoke on `/`, `/bookings`, and `/schedule`. Screenshot evidence: `tasks/design-language-proof-state-copy-dashboard-area5.png`, `tasks/design-language-proof-state-copy-bookings-area5.png`, and `tasks/design-language-proof-state-copy-schedule-area5.png`.
