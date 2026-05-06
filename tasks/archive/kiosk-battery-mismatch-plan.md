# Kiosk Battery Mismatch Plan

Last updated: 2026-05-06

## Goal

Make kiosk battery scan failures explain the actual operator problem:

- Wrong battery type.
- Unit already scanned for pickup.
- Unit already checked out elsewhere.
- Unit not checked out on this booking during return.
- Unit retired or lost.

## Slice 1 — Backend Response Polish

- [x] Keep derived numbered battery QR handling inside `bulk-unit-scans.ts`.
- [x] Detect derived unit QRs for active numbered SKUs even when the SKU is not on the booking.
- [x] Add clearer pickup errors for wrong type, duplicate scans, already checked-out units, and unavailable units.
- [x] Add clearer return errors for units not checked out on this booking or already returned.
- [x] Add focused service tests.
- [x] Sync kiosk/bulk docs and run safe verification.

## Out of Scope

- iOS UI layout changes.
- Admin override redesign.
- New schema fields.

## Review

Shipped 2026-05-06. Derived numbered unit scans now parse active numbered SKUs beyond the booking SKU list, so kiosk pickup/return can distinguish wrong battery type from normal serialized lookup. Pickup now gives clearer duplicate, already checked-out-elsewhere, lost, and retired feedback. Return now gives clearer wrong-type, checked-out-elsewhere, not-on-this-booking, already-returned, lost, and retired feedback. Verification passed with `npx vitest run tests/bulk-unit-kiosk-scans.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.
