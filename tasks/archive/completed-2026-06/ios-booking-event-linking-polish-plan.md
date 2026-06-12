# iOS Booking Event Linking Polish Plan

## Goal
Make native iOS reservation creation show-ready by adding event linking and upgrading the three-step booking UI to feel deliberate, Apple-like, and field-ready.

## Scope
- Add native event selection to `CreateBookingSheet` without changing server schema or booking lifecycle rules.
- Submit linked events through the existing `eventIds[]` API contract, falling back to legacy `eventId` for prefilled shift/event handoffs.
- Refresh the Details, Equipment, and Confirm steps with calmer hierarchy, stronger selected context, 44pt controls, and clearer review state.
- Keep availability and bulk shortage enforcement server-authoritative.

## Non-Goals
- No checkout creation path on iOS.
- No post-creation event editing.
- No desktop-style power filters or schedule analytics in the picker.
- No schema or migration work.

## Checklist
- [x] Load and manage upcoming events in the booking view model.
- [x] Add a compact event selector on Step 1 with up to 3 linked events.
- [x] Auto-fill title, location, and window from the first/last selected events while preserving manual override after user edits.
- [x] Submit `eventIds[]` for selected events and preserve legacy prefilled `eventId`/`shiftAssignmentId` behavior.
- [x] Polish Details, Equipment, and Confirm UI around a cleaner Apple-style task flow.
- [x] Add focused source-contract coverage for native event linking and visual/flow affordances.
- [x] Sync area docs and task review.
- [x] Verify with focused tests, iOS drift/audit checks, whitespace check, and an iOS build.

## Review
- 2026-06-11: Implemented native event linking in `CreateBookingSheet` with `eventIds[]` submission, event chips, event-aware review, and upgraded step headers. Docs synced. Verification pending.
- 2026-06-11: Verification passed: `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts`, `git diff --check`, `npm run drift:ios`, `npm run audit:ios:gaps` with the pre-existing unregistered `Components/UserAvatarView.swift` warning, and XcodeBuildMCP simulator build on iPhone 17 Pro / iOS 27. `npx tsc --noEmit --pretty false` is blocked by the pre-existing conflicted `tests/booking-create-ux.test.ts` file.
