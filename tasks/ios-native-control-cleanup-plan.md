# iOS Native Control Cleanup Plan

Date: 2026-06-30

## Goal
Replace accepted hand-rolled iOS controls with native SwiftUI controls so the app feels closer to Apple system apps while preserving the existing booking, search, item filter, and role-gated behavior.

## Scope
- Global search uses SwiftUI `.searchable` and a toolbar scanner action instead of a custom search row.
- Items filters move from a horizontal custom pill strip into native toolbar buttons and menus.
- Create Booking equipment search uses SwiftUI `.searchable` instead of an inline list `TextField`.
- Booking detail Extend and Cancel use native bordered button styles instead of glass/custom-looking action buttons.

## Deferred
- Guides native page.
- Home card cleanup.

## Checklist
- [x] Audit current SwiftUI surfaces and area docs.
- [x] Patch accepted SwiftUI controls.
- [x] Add focused source-contract coverage.
- [x] Sync mobile/items/reservation/checkout docs.
- [x] Run focused tests and iOS verification gates.

## Review
- 2026-06-30: Shipped the accepted native-control cleanup. Global Search uses SwiftUI `.searchable` plus a toolbar scanner button while preserving recent-search commit behavior. Items removed the horizontal custom control strip and now uses toolbar Favorites plus native Status/Sort menus. Create Booking's Equipment step uses `.searchable` instead of an inline search field. Booking Detail Extend/Cancel use native bordered system buttons instead of glass/custom-looking buttons. Guides native and Home card cleanup stayed deferred.

## Verification
- `npm run test -- tests/ios-native-control-cleanup.test.ts tests/ios-create-booking-picker-parity.test.ts tests/ios-items-empty-state-recovery.test.ts tests/ios-items-row-accessibility.test.ts`
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- `git diff --check`
- `npm run ios:project:check`
- `npm run verify:docs`
- `npm run ios:xcode:verify` outside the sandbox after the sandboxed run failed on CoreSimulator and Swift macro plugin access.
