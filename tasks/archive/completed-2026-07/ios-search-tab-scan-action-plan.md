# iOS Search Tab With Scan Action Plan

Date: 2026-06-30

## Goal
Make the native trailing tab a global Search tab, with scanning available inside Search like a shopping app, while preserving lookup-only scan behavior and kiosk-owned custody boundaries.

## Scope
- Rename the compact trailing tab from Scan to Search.
- Point the tab at `GlobalSearchSheet` as a first-class tab surface.
- Keep QR scan as the toolbar action inside Search.
- Keep Home's all-clear shortcut routing to the same tab.
- Update source-contract tests, mobile docs, and lessons.

## Non-Goals
- No API or Codable payload changes.
- No kiosk pickup/return scan changes.
- No deletion of the existing `ScanView` implementation in this slice.

## Checklist
- [x] Audit current tab, app state, Home shortcut, global search, docs, and tests.
- [x] Patch tab/search wiring.
- [x] Update focused source tests.
- [x] Sync docs and lessons.
- [x] Run focused tests and iOS verification gates.

## Review
- 2026-06-30: Shipped the native Search tab direction. The compact trailing tab now reads `Search` with the system magnifying-glass icon and `role: .search`, and it opens `GlobalSearchSheet(showsCancelButton: false)` directly. QR scanning remains the toolbar action inside Search, so the scanner behaves like a shopping-app scan affordance instead of owning the tab. Home's all-clear recovery routes to Search through `AppState.presentSearch()`, while `presentScanLookup()` remains as a compatibility alias. Kiosk pickup/return custody and scan APIs did not change.

## Verification
- `npm run test -- tests/ios-tabbar-stability.test.ts tests/ios-native-control-cleanup.test.ts tests/ios-home-afm-header-source.test.ts tests/ios-runtime-warning-cleanup.test.ts tests/ios-scan-result-retry.test.ts`
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- `git diff --check`
- `npm run ios:project:check`
- `npm run verify:docs`
- `npm run ios:xcode:verify` outside the sandbox after the sandboxed run failed on CoreSimulator and Swift macro plugin access.
