# iOS Swift 6 and Xcode 26.6 Fixes Plan - 2026-07-17

## Goal
- Restore a clean Wisconsin build under Xcode 26.6 by resolving the reported Swift 6 concurrency errors and accepting the current recommended project settings.

## Route
- Owner area: Mobile Operations
- Ledger: this bounded plan
- Existing plan/archive references: `tasks/audit-app-shell-ios.md`, `tasks/app-review-release-candidate-plan.md`

## Source Checks
- `ios/project.yml` is the source for the generated Xcode project and is pinned to Xcode 26.0 while the installed toolchain is Xcode 26.6.
- `GearStore` is main-actor isolated and uses SwiftData predicates and sort descriptors whose imported SDK key-path types trigger Swift 6 sendability diagnostics.
- `CheckoutReturnLiveActivityManager` is main-actor isolated, but passes the same non-Sendable ActivityKit activity across an async update and a separate token-observation call.

## Stop Conditions
- Stop if regenerating the project would remove or rewrite unrelated active iOS work.
- Stop if the fixes require weakening strict concurrency for the target instead of isolating the SDK compatibility boundary.

## Slices
- [x] Update the XcodeGen compatibility version and regenerate the checked-in project.
- [x] Resolve SwiftData key-path sendability by adopting Swift 6 for the generated project.
- [x] Restructure existing Live Activity handling so the non-Sendable activity is not reused after an async send.
- [x] Run project drift, focused source-contract tests, iOS audit gates, and affected target builds.

## Verification
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] focused Live Activity source-contract test
- [x] Wisconsin simulator build
- [x] Wisconsin generic-device build
- [x] `git diff --check`

## Review
- Shipped: Xcode 26.6 project metadata, Swift 6 language mode, SwiftData key-path compatibility, and safe existing Live Activity updating.
- Verified: XcodeGen drift, iOS drift, iOS gap audit, focused Live Activity contracts, simulator build, generic-device build, and diff whitespace.
- Deferred: Physical-device runtime behavior was unchanged and was not exercised.
- Blocked: None. Xcode noted that a connected device was passcode protected while probing notification services, but both generic builds passed.
- Proof artifacts: Terminal output from `npm run ios:xcode:verify` and the focused Vitest run.
- Next slice or stop: Stop. The reported compiler diagnostics are resolved.
