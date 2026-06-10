# Booking Flow Follow-up Plan

Date: 2026-06-10
Owner: Codex
Status: Active

## Scope

This follow-up picks up the booking-flow polish handoff without disturbing the broader visual refresh already in progress.

## Slice 1 - Web Duration Parity

- [x] Confirm iOS already preserves duration when the start date moves.
- [x] Add the same duration-preserving behavior to the web booking wizard.
- [x] Add focused coverage for valid and invalid date-window edits.

## Slice 2 - Authenticated Visual Smoke

- [x] Document the current blocker: seed credentials exist, but there is no first-class browser/Playwright smoke script in `package.json`.
- [x] Use the existing local admin seed (`admin@creative.local`) for manual/browser smoke when the dev server and database are available.
- [ ] Defer a full Playwright harness until the repo adds Playwright as an explicit dev dependency.

## Slice 3 - Native Picker Parity Assessment

- [x] Verify the current iOS sheet supports serialized equipment only.
- [x] Verify `APIClient.createReservation` still sends `bulkItems: []`.
- [x] Add iOS scan-to-add for serialized equipment inside the native booking picker.
- [x] Add first-class bulk/countable item selection to the native booking picker.
- [x] Send typed `bulkItems` through `APIClient.createReservation`.
- [ ] Keep richer advisory availability for bulk/next-use context as a separate native picker hardening slice.

## Verification Plan

- [x] `npx vitest run tests/booking-create-ux.test.ts`
- [x] `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/ios-api-contract.test.ts tests/student-field-contracts.test.ts`
- [x] `npx tsc --noEmit`
- [x] `git diff --check`

## Review

- 2026-06-10: Web Step 1 now preserves duration when the start date moves. Example verified in an authenticated browser smoke: Pickup changed from Jun 10, 2026 7:00 AM to 9:30 AM, and Return by shifted from Jun 11, 2026 7:00 AM to 9:30 AM.
- 2026-06-10: The authenticated smoke used the seeded local admin account and loaded `/checkouts/new` on the local dev server. The page had no visible `\u2026` literals and no console warnings/errors. Screenshot proof: `tasks/booking-flow-followup-checkout-new.png`.
- 2026-06-10: iOS already has duration-preserving `adjustStart(to:)`. iOS scan-to-add, bulk battery selection, and richer advisory availability remain first-class follow-up slices, not small web-followup patches.
- 2026-06-10: Native booking creation now supports scan-to-add from the Equipment step, countable bulk/battery selection with quantity steppers, selected bulk rows in Review, and typed `bulkItems` in the reservation create payload. Richer bulk advisory availability remains a follow-up because serialized conflict hints and server-side shortage enforcement already cover the blocking path.
