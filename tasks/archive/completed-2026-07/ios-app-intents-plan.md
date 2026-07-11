# iOS App Intents Plan

Scope: expose the smallest useful native App Intents surface for the main `Wisconsin` app.

## Audit Notes

- Current source has no live `AppIntent`, `AppShortcut`, or `AppShortcutsProvider` types.
- Existing app routes already support the right launch points: Search/scan in `GlobalSearchSheet`, reservations in `BookingsView`, and schedule in `AppTabView`.
- This slice must not add background booking, custody, check-in, checkout, return, or shift mutations. Kiosk remains the custody surface.

## Slice

- [x] Add a central App Intent handoff so intents can request one destination and the app scene consumes it.
- [x] Add open-app shortcuts for Scan Gear Code, Show My Gear, Show Today's Schedule, and Create Reservation.
- [x] Route Scan into the existing QR scanner cover and Create Reservation into the existing reservation sheet.
- [x] Add source-contract tests that pin shortcut metadata, handoff routing, and the no-mutation boundary.
- [x] Sync mobile/gaps docs and run focused verification.

## Review

- 2026-07-03: Implemented an open-app-only App Intents slice. The four shortcuts route through `GearTrackerAppIntentHandoff` and `AppState.pendingAppIntentDestination`, then land in the existing tab, scanner, and reservation-sheet flows. Source-contract coverage pins shortcut metadata, app routing, and the no-mutation boundary.
- 2026-07-03: Verification passed: `npx vitest run tests/ios-app-intents.test.ts`, `git diff --check` on touched files, `npm run drift:ios`, `npm run audit:ios:gaps` with the pre-existing 7 unregistered iOS inventory entries and 0 missing audits, `npm run ios:project:check`, `npm run verify:docs`, XcodeBuildMCP `build_sim` for `Wisconsin` on iPhone 17 Pro, and `npm run build:app`.
