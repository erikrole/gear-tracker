# iOS Settings First-Class Slice

Last updated: 2026-06-10

## Goal
Upgrade the native Profile sheet into a first-class iOS Settings hub without changing backend contracts, schema, or the stable tab shell.

## Slice
- [x] Turn Profile into a Settings surface with clearer native grouping, stronger account header, and first-class row treatment.
- [x] Keep notification preferences, appearance choice, availability, staff tools, app settings, and sign out role-aware and reachable.
- [x] Add focused source tests for the settings IA and self-describing controls.
- [x] Sync mobile/settings docs and record verification results.

## Guardrails
- No API or schema changes in this slice.
- Preserve existing notification preference save behavior, including category defaults.
- Preserve student-only availability entry and staff/admin-only sticker-code tool.
- Do not reintroduce the modern SwiftUI `Tab(...)` shell because the current app has reproduced a Schedule tab crash on that path.

## Verification
- `npx vitest run tests/ios-settings-first-class.test.ts tests/ios-notification-categories-profile.test.ts tests/student-field-contracts.test.ts`
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- `git diff --check`
- `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`

## Review
- 2026-06-10: Native Profile now presents as Settings, with an account summary, shift/overdue/alert metrics, first-class settings rows, grouped schedule/account/notifications/appearance/tools/app sections, student-only Availability, staff/admin-only Link Sticker Codes, and a named sign-out row.
- 2026-06-10: No API, schema, or notification delivery contract changed. The stable `.tabItem`/`.tag` tab shell remains in place after the previously reproduced `Tab(...)` Schedule crash.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-settings-first-class.test.ts tests/ios-notification-categories-profile.test.ts tests/student-field-contracts.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.
