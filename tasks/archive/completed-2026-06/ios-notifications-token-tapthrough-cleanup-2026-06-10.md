# Completed iOS Notifications Token and Tap-Through Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: iOS Notifications Token Honesty Slice (2026-06-10)
- [x] **Open slice plan** - Started `tasks/archive/completed-2026-06/ios-notifications-token-honesty-plan-2026-06-10.md` for APNs token registration/revocation error handling.
- [x] **Shared API handling** - Route native device-token register/revoke calls through `perform` and `SuccessResponse`.
- [x] **Focused contract coverage** - Add source tests proving `/api/devices` returns success and iOS no longer uses raw `session.data(for:)` for those calls.
- [x] **Docs and verification** - Sync mobile/notification docs and run the iOS verification stack.

**Review**
- 2026-06-10: `APIClient.registerDeviceToken(_:)` and `revokeAllDeviceTokens()` now decode the `/api/devices` `{ success: true }` response through the shared `perform` handler instead of raw `URLSession.data`, so non-2xx responses are real errors and 401s broadcast `sessionDidExpire`.
- 2026-06-10: Focused contract coverage pins both sides of the device-token contract: the route returns success envelopes for register/revoke, and native register/revoke do not drift back to raw `session.data(for:)`.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-notifications-token-honesty.test.ts tests/ios-notifications-tapthrough.test.ts tests/ios-notifications-read-recovery.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.

## Completed: iOS Notifications Tap-Through Slice (2026-06-10)
- [x] **Open slice plan** - Started `tasks/archive/completed-2026-06/ios-notifications-tapthrough-plan-2026-06-10.md` for the narrow shift push routing fix.
- [x] **Shift APNs payloads** - Include event routing context on shift gear-up and shift schedule push payloads.
- [x] **Native Schedule routing** - Switch to the Schedule tab when a tapped push sets `pendingPushEventId`, leaving `ScheduleView` to open the event.
- [x] **Focused contract coverage** - Add source tests for server push payloads and native pending-event tab routing.
- [x] **Docs and verification** - Sync mobile/notification docs and run the iOS verification stack.

**Review**
- 2026-06-10: Shift gear-up and shift schedule pushes now include `eventId`, `assignmentId`, and `shiftId` in the APNs payload. The inbox payloads already carried those fields; the fix closes the native push gap without changing email or in-app notification creation.
- 2026-06-10: `AppDelegate` already stores tapped `eventId` as `AppState.pendingPushEventId`, and `ScheduleView` already consumes that value. `AppTabView` now watches for the pending event, switches to the Schedule tab, and leaves `ScheduleView` to clear/open the event so the tab shell does not consume the navigation intent too early.
- 2026-06-10: Verification passed: `npx vitest run tests/ios-notifications-tapthrough.test.ts tests/ios-notifications-read-recovery.test.ts`, `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, and escalated `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`. The first sandboxed Xcode build failed before compilation on CoreSimulator/DerivedData permissions; the rerun outside the sandbox succeeded. `npm run audit:ios:gaps` still reports the unrelated unregistered `Components/UserAvatarView.swift` warning with 35/35 audit-worthy surfaces covered.
