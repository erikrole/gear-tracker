# Completed iOS Settings Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: iOS Settings Detail Menus Slice (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/ios-settings-detail-menus-plan.md` for native Settings drill-downs.
- [x] **Notifications detail menu** - Move notification delivery, pause, channel, and category controls out of the root Settings list into a dedicated native Notifications destination.
- [x] **Account & Security detail menu** - Add a native Account & Security destination with account identity, role, password change, optional other-session revocation, and web handoff for full profile/session management.
- [x] **Focused coverage** - Add source-contract tests for the new navigation destinations, notification detail ownership, and password-change UI/API wiring.
- [x] **Docs and verification** - Sync mobile/settings/notification/user docs and run the iOS verification stack.

**Review**
- 2026-06-10: Native Settings now keeps root Account and Notifications as scannable menu rows. Notifications opens a dedicated detail screen with delivery status, OS push recovery, pause controls, email/push channel toggles, and the four category toggles. Account & Security opens a native password-change workflow with account identity, role, show/hide password control, confirm-password validation, and optional sign-out-other-devices behavior through the existing `/api/me/change-password` client.
- 2026-06-10: Full profile editing and active-session review remain linked to web Settings for this slice. No schema, backend contract, or tab-shell architecture changed.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-settings-detail-menus.test.ts tests/ios-settings-first-class.test.ts tests/ios-notification-categories-profile.test.ts tests/student-field-contracts.test.ts tests/ios-forced-password.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

## Completed: iOS Settings First-Class Slice (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/ios-settings-first-class-plan.md` for the native Settings/Profile hub upgrade.
- [x] **Native settings IA** - Refactor Profile into a first-class iOS Settings surface with stronger account, notification, schedule, appearance, tools, and app grouping.
- [x] **Focused coverage** - Add source-contract tests for settings row labels, role-gated entries, and preserved notification controls.
- [x] **Docs and verification** - Sync mobile/settings docs and run the iOS verification stack.

**Review**
- 2026-06-10: Native Profile now presents as Settings, with an account summary, shift/overdue/alert metrics, first-class settings rows, grouped schedule/account/notifications/appearance/tools/app sections, student-only Availability, staff/admin-only Link Sticker Codes, and a named sign-out row.
- 2026-06-10: No API, schema, or notification delivery contract changed. The stable `.tabItem`/`.tag` tab shell remains in place after the previously reproduced `Tab(...)` Schedule crash.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-settings-first-class.test.ts tests/ios-notification-categories-profile.test.ts tests/student-field-contracts.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.
