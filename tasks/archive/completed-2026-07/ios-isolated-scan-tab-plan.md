# iOS Isolated Scan Action Plan

Status: Active
Started: 2026-06-29

## Goal

Make native iOS scan/search match the newer Apple tab-bar pattern by using SwiftUI's built-in tab bar with Scan isolated as the dedicated trailing search-role tab.

## Plan

- [x] Audit mobile, scan, search, decisions, gaps, schema, crash lessons, and current tab source.
- [x] Replace the custom bottom bar with SwiftUI's native value-based `Tab(...)` API.
- [x] Keep the compact iPhone tab set to Home, Bookings/My Gear, Items, Schedule, and Scan so the system does not hide Scan behind More.
- [x] Mark Scan with `role: .search` and pinned placement so the system owns the trailing Scan affordance.
- [x] Move secondary destinations into regular-width sidebar-only sections so Users, Guides, and Licenses do not create compact overflow.
- [x] Add compact-safe Profile/Settings > Directory access for Guides, Users, and Licenses.
- [x] Add an app-state scan navigation request so Home shortcuts select Scan without hardcoding tab tag `3`.
- [x] Keep scan lookup-only and kiosk custody boundaries unchanged.
- [x] Update source-contract tests and mobile/iOS readiness docs.
- [x] Run focused tests, iOS drift/gap checks, whitespace check, Wisconsin simulator build, and iOS 27 simulator screenshot proof.

## Notes

- iOS shows the system More tab when six compact tabs are present. Staff-only Users was removed from the compact iPhone tab shell so Scan remains visible, then restored as a regular-width sidebar-only destination plus a compact Settings directory destination.
- This slice does not change API payloads, Prisma schema, kiosk custody routes, or the iOS deployment target.

## Review

- 2026-06-29: Corrected after user feedback. `AppTabView` now uses SwiftUI's native value-based `Tab(...)` API. The compact iPhone tab shell is Home, Bookings/My Gear, Items, Schedule, and Scan; Scan is `role: .search` with pinned placement, producing the native grouped tab bar plus isolated trailing Scan button on iOS 27. The custom bottom bar and hidden-system-tab fallback were removed. Regular-width layouts now use `.sidebarAdaptable` with sidebar-only Guides, Users, and Licenses destinations, and compact iPhone exposes those destinations from Profile/Settings > Directory. `AppState.presentScanLookup()` lets Home's all-clear state select Scan without hardcoding tab tag `3`. Verification passed with focused Vitest, `npm run ios:xcode:verify`, `npm run verify:docs`, focused whitespace check, and iOS 27 simulator screenshot `/private/tmp/wisconsin-native-tabbar-final.png`.
