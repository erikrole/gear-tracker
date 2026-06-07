# iOS Booking Detail Control Clarity Plan

Created: 2026-06-03

## Goal

Make the native Booking Detail edit affordance and locked-state behavior obvious without relying on a disappearing pencil icon.

## Source Audit

- `docs/AREA_MOBILE.md`: mobile is student-first, role-adaptive, action-first, and scan stays one tap away.
- `docs/AREA_CHECKOUTS.md`: pending-pickup/open checkout custody is kiosk-owned; `OPEN` checkouts can be extended.
- `docs/AREA_RESERVATIONS.md`: reservation edits are role/state gated, audited, and conflict-checked.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: Booking Detail QA still calls out an edit pencil and ownership-gated action panel.
- `tasks/audit-booking-detail-ios.md`: the disappearing edit pencil was already noted as confusing once a student booking moves to `PENDING_PICKUP` or `OPEN`.
- `ios/Wisconsin/Views/BookingDetailView.swift`: edit is currently a top-right pencil only, and students see no local explanation when edit is no longer allowed.

## Scope

- Rename the edit toolbar action visibly as `Edit`.
- Add a small locked-state notice for users who can act on the booking but can no longer edit details.
- Preserve the existing action panel, Extend flow, Cancel flow, kiosk pickup/return copy, optimistic-lock edit contract, and authorization gates.

## Non-Goals

- Do not add custody scan actions to phone Booking Detail.
- Do not add desktop booking filters or admin action menus.
- Do not change API payloads.

## Checklist

- [x] Make Booking Detail edit action visibly named when available.
- [x] Add an edit-locked explanation for owner-access bookings that are no longer editable.
- [x] Add static contract coverage for edit label and lock notice.
- [x] Sync mobile, checkout, reservation, walkthrough, gaps/task docs.
- [x] Verify with focused tests, iOS drift, iOS audit, TypeScript, XcodeBuildMCP simulator build, and diff checks.

## Review

Implemented the focused Booking Detail clarity slice in `ios/Wisconsin/Views/BookingDetailView.swift`. The edit affordance now renders as a labeled `Edit` toolbar action when editing is allowed. Users who can act on a booking but cannot edit details now see an `Editing locked` notice that points to Extend Return Date or kiosk pickup/return as appropriate.

No API payloads changed. The existing optimistic-lock PATCH contract, action panel ownership gate, Extend flow, Cancel flow, and kiosk custody boundary are unchanged.

Verification passed: `npx vitest run tests/student-field-contracts.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and XcodeBuildMCP simulator build for scheme `Wisconsin`.
