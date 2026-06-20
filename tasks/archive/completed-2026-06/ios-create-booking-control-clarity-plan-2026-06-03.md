# iOS Create Booking Control Clarity Plan

Created: 2026-06-03

## Goal

Make native reservation creation easier to follow in the field by keeping the next action and selected equipment visible.

## Source Audit

- `docs/AREA_MOBILE.md`: iOS must stay student-first, action-first, and avoid desktop power-user controls.
- `docs/AREA_CHECKOUTS.md`: create flows must preserve booking lifecycle and scan recovery contracts.
- `docs/AREA_RESERVATIONS.md`: `New reservation` remains the primary mobile create action.
- `docs/IOS_PATTERNS.md`: `CreateBookingSheet` needs discard safety because equipment/requester/date selections are high-stakes.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: CreateBookingSheet is reached from Bookings, Items list, and Item Detail.
- `tasks/audit-create-booking-ios.md`: prior hardening shipped stale-search guards, asset-load recovery, haptics, and retry.
- `ios/Wisconsin/Views/CreateBookingSheet.swift`: two-step native sheet with details first, equipment second, and selected count only.

## Implementation Slice

- [x] Audit relevant docs, audit notes, and current `CreateBookingSheet`.
- [x] Write this plan before edits.
- [x] Make step actions self-describing.
- [x] Add selected-equipment visibility and one-tap removal.
- [x] Add focused source-level contract coverage.
- [x] Sync mobile, checkout, reservation, and walkthrough docs.
- [x] Run focused verification.

## Guardrails

- No API payload changes.
- Keep this as reservation creation, not a desktop checkout wizard clone.
- Preserve conflict pre-check behavior and defensive retry paths.
- Do not add scan-to-add in this slice; scan remains one tap away in the app shell.

## Verification Plan

- [x] `npx vitest run tests/student-field-contracts.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] XcodeBuildMCP simulator build
- [x] `git diff --check`

## Review

- Step 1 now advances with `Choose Equipment` instead of a generic `Next`.
- Final submission now reads `Create Reservation`.
- Step 2 now keeps selected equipment visible with per-row `Remove` actions, backed by selected asset snapshots so search changes do not hide removal recovery.
- No API payloads changed.
