# macOS companion hardening and polish

Status: ACTIVE — implementation complete; native/runtime proof pending

## Scope and authority

- Surface: `macos/GearOps`, displayed as Wisconsin Creative.
- Accepted authority: D-047, `plans/062-gearops-menu-bar.md`, Dashboard and Notifications area docs.
- Preserve: read-only custody boundary, Upstash-only post-enrollment reads, last trusted projection, passive booking alerts, existing web deep links, and unrelated dirty iOS/web work.
- Exclude: server mutations, schema work, production deployment, installed-app replacement, signing, notarization, and APNs production proof.

## Problems being closed

- A 60-second network loop contradicts D-047's no-timer contract and spends 1,440 external-cache reads per device per quiet day.
- Duplicate IDs or unsupported projection versions can trap during indexing instead of preserving trusted state.
- Sign-out can discard its only retry credential while remote revocation fails, and private notification/avatar residue remains locally visible.
- Optional notification authorization can delay projection readiness.
- Menu, popover, and Settings derive health/count truth independently.
- Signed-out lifecycle warnings are hidden on the identity step; password retry, focus, Reduce Motion, and headings are incomplete.
- Settings updates can reactivate the accessory app and steal focus.
- Launch-at-login approval looks off, unavailable registration remains interactive, and state does not refresh after System Settings.
- Release configuration does not encode Hardened Runtime, and the installed copy is a Debug/XCTest host rather than a distribution artifact.

## Implementation slices

- [x] Restore once, then refresh through APNs, explicit refresh, or Mac wake; remove periodic network polling.
- [x] Validate projection version, identity uniqueness, access state, and nonnegative counts before state mutation or cache indexing.
- [x] Use cookie-free, non-caching ephemeral transport and device-only Keychain accessibility.
- [x] Make revocation failures durable and retryable without restoring a signed-out account; compensate failed or superseded enrollment.
- [x] Purge delivered/pending notifications and avatar caches at account removal.
- [x] Move notification authorization and APNs registration off the projection critical path.
- [x] Centralize custody count and health presentation for the menu, popover, and Settings.
- [x] Keep lifecycle errors visible, scrub password state on dismissal, refocus failed authentication, and expose real focus treatment.
- [x] Prevent settings focus theft; refresh system-owned state on app activation; represent pending launch approval honestly.
- [x] Respect Reduce Motion, add accessibility headings/live error announcements, and request sound capability for the opt-in sound setting.
- [x] Enable Hardened Runtime for Release without changing signing or distribution authority.

## Verification

- [ ] Focused macOS XCTest suite (testmanagerd communication is blocked by the restricted runner).
- [x] Focused macOS companion Vitest source contracts.
- [x] `xcrun swiftc -parse macos/GearOps/*.swift` and test sources.
- [x] XcodeGen regeneration is reviewed and deterministic.
- [ ] Unsigned Debug test compilation and Release build with Xcode 26.6 (both pass with the local macro sandbox workaround; XCTest execution, signing, and installed Release proof remain open).
- [ ] Matched `gt-ui-review` before/after page from deterministic, non-production fixtures.
- [ ] Installed clean Release smoke: menu, Settings focus, launch approval, notifications, VoiceOver, keyboard, Reduce Motion, sleep/wake, sign-out cleanup.
- [ ] Signed archive checks: Hardened Runtime, production APNs entitlement, no test frameworks/debug dylibs/test entitlements, strict signature, notarization, and stapling. These require separate authorization.
- [ ] `npm run verify:docs` (blocked by pre-existing codemap drift in parallel work); [x] `git diff --check`.

## Current proof boundary

- Baseline macOS source contracts passed 21/21. The hardened source/security contracts now pass 27/27, including the event-driven pending-revocation retry path.
- The direct shared `.icon` resource was replaced with the shared compiled `AppIcon.appiconset`; Xcode reaches Swift compilation. `xcodebuild build-for-testing` passes with `OTHER_SWIFT_FLAGS=-disable-sandbox` to work around the local macro-plugin sandbox, while `xcodebuild test` remains blocked when the runner cannot communicate with `testmanagerd`.
- The currently installed app has compiled icon resources but is a Debug/XCTest test host and is not suitable for staff distribution or final visual acceptance.
