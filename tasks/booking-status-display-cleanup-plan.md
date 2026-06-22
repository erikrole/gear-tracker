# Booking Status Display Cleanup

Date: 2026-06-22

Backlog item: `DESLOPPIFY.md` M2

## Scope

Centralize user-facing booking status display labels and badge/status visual metadata without changing booking state transitions, API response shapes, or database enums.

## Plan

- [x] Audit D-025, booking detail helpers, booking list helpers, item booking history, and existing status-label tests.
- [x] Add a shared display-only booking status helper.
- [x] Keep existing detail/list imports stable through wrappers or re-exports.
- [x] Migrate item booking history/calendar rows away from local status switches.
- [x] Delete impossible legacy booking-status branches from item history UI.
- [x] Add focused regression and source-contract coverage.
- [x] Sync DESLOPPIFY, relevant area docs, codemaps, and task ledger.
- [x] Run focused Vitest, TypeScript, docs, migration, whitespace, and app-build gates.

## Review

- 2026-06-22: Booking status display cleanup shipped locally. Booking details, booking-list visuals, item booking overview/history, upcoming item reservations, and item schedule agenda rows now use `src/lib/booking-status-display.ts` for labels and badge/status colors. The item tab's local booking status switch and legacy booking states were removed. Verification passed with focused Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

## Guardrails

- Display-only cleanup. Do not alter booking lifecycle rules, permissions, or API status values.
- Preserve D-025 language: DB enum stays unchanged; UI gets user-facing labels.
- Keep scope to booking status display surfaces already named in M2.
