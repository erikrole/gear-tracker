# iOS Native Guides Page Plan

## Slice
Build a read-only native SwiftUI Guides page for the Wisconsin iOS app, replacing the current web fallback in Profile/Settings and the regular-width Resources sidebar destination.

## Scope
- Native list and reader only.
- Use existing `/api/resources` and `/api/resources/[id]` read contracts.
- No create, edit, delete, mark-verified, Contacts directory, or sport-assignment management.
- Keep compact iPhone navigation inside Settings > Directory and regular-width iPad exposure as a sidebar-only Resources destination.

## Checklist
- [x] Audit current Resources docs, API shape, iOS shell, Settings directory, and source-contract tests.
- [x] Add Swift resource models and API client reads.
- [x] Build `GuidesView` with loading, error, empty, pull-to-refresh, native search, focus filtering, and read-only article rendering.
- [x] Replace Guides web fallbacks in `AppTabView` and `ProfileView`.
- [x] Add focused source-contract coverage for the native Guides route.
- [x] Sync Mobile and Resources area docs plus task review notes.
- [x] Run focused tests and iOS verification gates.

## Verification Plan
- `npx vitest run tests/ios-guides-native-page.test.ts tests/ios-tabbar-stability.test.ts tests/ios-settings-first-class.test.ts`
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- `npm run ios:project:check`
- `git diff --check`
- `npm run verify:docs`
- `npm run ios:xcode:verify`
