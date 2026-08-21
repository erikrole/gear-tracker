# macOS companion hardening and polish

Status: ACTIVE — macOS 1.0.2 shipped; cold-restart and full interaction proof remain

## Scope and authority

- Surface: `macos/GearOps`, displayed as Wisconsin Creative.
- Accepted authority: D-047, `plans/062-gearops-menu-bar.md`, Dashboard and Notifications area docs.
- Preserve: read-only custody boundary, Upstash-only post-enrollment reads, last trusted projection, passive booking alerts, existing web deep links, and unrelated dirty iOS/web work.
- Exclude from the implementation slice: server mutations, schema work, and production deployment. Release packaging, signing, notarization, and installation were completed later under explicit shipping authorization.

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
- Companion credentials are issued for 90 days but have no renewal path, so a normally used menu-bar session eventually falls back to the login screen.

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
- [x] Add an Upstash-only rolling credential renewal path; rotate only after the replacement is durable in Keychain and keep failed old-session cleanup retryable.

## Verification

- [x] Focused macOS XCTest suite (62 tests, 0 failures with the local macro sandbox workaround).
- [x] Focused macOS companion Vitest source contracts.
- [x] `xcrun swiftc -parse macos/GearOps/*.swift` and test sources.
- [x] XcodeGen regeneration is reviewed and deterministic.
- [x] Unsigned Debug test compilation, Release archive, and XCTest execution with Xcode 26.6 (all pass with the local macro sandbox workaround).
- [ ] Matched `gt-ui-review` before/after page from deterministic, non-production fixtures.
- [ ] Installed clean Release smoke: menu, Settings focus, launch approval, notifications, VoiceOver, keyboard, Reduce Motion, sleep/wake, sign-out cleanup.
- [x] Signed archive checks: Hardened Runtime, production APNs entitlement authorized by the embedded Developer ID profile, no test frameworks/debug dylibs/test entitlements, strict signature, notarization, and stapling.
- [ ] `npm run verify:docs` (blocked by pre-existing codemap drift in parallel work); [x] scoped `git diff --check` (the full dirty worktree still reports an unrelated iOS blank line).

## Current proof boundary

- Baseline macOS source contracts passed 21/21. The hardened source/security contracts now pass 28/28, including rolling credential renewal, the event-driven pending-revocation retry path, and the no-Neon session route. Companion store/route tests pass 8/8 in the focused run.
- The direct shared `.icon` resource was replaced with the shared compiled `AppIcon.appiconset`; Xcode reaches Swift compilation. `xcodebuild build-for-testing` and `xcodebuild test` pass with `OTHER_SWIFT_FLAGS=-disable-sandbox` to work around the local macro-plugin sandbox; the native suite reports 62/62 passing.
- The shipped archive includes the explicit `AppIcon.icns`, production APNs entitlement, and Developer ID provisioning profile `4f4171d8-f959-4ed5-be70-7cc663253d52`; the installed 1.0.2 build is accepted by Gatekeeper and running from `/Users/role/Applications/Wisconsin Creative.app`. Full menu/Settings/VoiceOver/Reduce Motion/sleep-wake/sign-out smoke and cold-restart acceptance remain unverified.

## Release execution (2026-08-20)

- Source commit: `193ca4f0`; tag: `macos-v1.0.0`; [GitHub release](https://github.com/erikrole/wisconsin-creative/releases/tag/macos-v1.0.0).
- Developer ID profile: `Wisconsin Creative GearOps Developer ID 2026` (`4f4171d8-f959-4ed5-be70-7cc663253d52`), with production APNs entitlement and the installed `Developer ID Application: Erik Role (T26T3G8C7Q)` certificate.
- Notary submission `8aece3a6-de79-447c-8920-2d1f0a105286` was accepted; stapler validation, Gatekeeper (`Notarized Developer ID`), and strict code-signature verification passed.
- Canonical release asset: `Wisconsin-Creative-1.0.0-macos.zip`, SHA-256 `6dbc6dc28fa7f6b40c45290eb3e28bfae4fca6b246c082b536916ccf2b555f94`. The old profile-less asset was removed after its restricted APNs entitlement was killed at launch.
- The corrected app was installed over the prior debug/profile-less copies, which were preserved under `/private/tmp`, and the signed process is running from the installed Release bundle.

## Release execution (2026-08-21)

- Source commit: `0ecf2802`; tag: `macos-v1.0.2`; [GitHub release](https://github.com/erikrole/wisconsin-creative/releases/tag/macos-v1.0.2).
- Notary submission `30a15061-dcdc-4b57-bc77-9a23ec9f2f1c` was accepted; stapler validation, Gatekeeper (`Notarized Developer ID`), and strict code-signature verification passed.
- Canonical release asset: `Wisconsin-Creative-1.0.2-macos-profile.zip`, SHA-256 `10b9231550843c353bd3ffc87b4b61ef2967a9613e7c13277812fae6c950bc6f`.
- The prior installed 1.0.1 bundle was preserved under `/private/tmp`; the signed 1.0.2 build (version 1.0.2, build 3) is installed and running from `/Users/role/Applications/Wisconsin Creative.app`.

## Session persistence follow-up (2026-08-20)

- **Observed contract:** `issueCompanionSession` creates a 90-day bearer credential, while the macOS client has no refresh route. A 401 therefore signs the user out even when the account and local Keychain are otherwise healthy.
- **Bounded fix:** add an authenticated Upstash-only renewal endpoint that issues a replacement credential without touching Neon; the client saves the replacement first, then revokes the old credential through the existing durable pending-revocation path. Projection failures still preserve the last trusted local data, and a failed renewal falls back to the current credential rather than signing out.
- **Verification target:** server route/store tests, macOS source contracts, native renewal/revocation regression coverage, Swift parse/build-for-testing, and focused Vitest suites. A fresh signed/notarized release is a separate shipping action after source verification.
- **Current evidence:** focused Vitest source/security contracts (28 tests), TypeScript, lint, web build, Swift parse, macOS build-for-testing, and the native XCTest suite (62 tests) pass. The installed notarized 1.0.2 build now contains the source fix; cold-restart acceptance remains a user/device gate.

## Restart recovery follow-up (2026-08-21)

- **Observed contract:** the installed 1.0.1 process made only Keychain reads after restart, then showed the sign-in screen; the prior process had continued receiving successful projection responses. A first-unlock/unavailable read was being treated as a confirmed logout and the cached identity was removed.
- **Bounded fix:** startup now preserves the trusted cached identity/projection on a missing credential, observes macOS application/workspace session activation, and retries with explicit missing-credential confirmation after activation or menu presentation. Manual sign-out and a confirmed post-activation miss still clear local state.
- **Verification target:** focused source contracts, Swift parsing, native model regression coverage, and a fresh signed/notarized release followed by a cold-restart acceptance pass.
