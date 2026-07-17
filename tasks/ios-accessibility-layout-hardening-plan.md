# iOS Accessibility Layout Hardening Plan - 2026-07-17

## Goal
- Keep common Wisconsin workflows readable and operable at iOS accessibility text sizes without changing the compact normal-size design.

## Route
- Owner area: Mobile.
- Ledger: this plan plus `tasks/audit-ios-apple-design-full.md`.
- Existing references: `tasks/archive/completed-2026-07/ios-app-store-toggle-row-polish-plan.md` and `tasks/app-review-release-candidate-plan.md`.

## Source Checks
- Maximum Dynamic Type runtime proof on iPhone 16 in dark mode confirmed fragmented or obscured content in Welcome, Profile, Settings, Notifications, Browse, Account & Security, and Bookings.
- The failures share rigid horizontal compositions, single-line identity text, fixed accessories, or a fixed header/footer competing with scrollable content.
- Schedule's empty state and Search's primary empty state remained usable in the same matrix.
- App Accessibility claims remain unset for the first submission, but obvious broken layouts still create App Review completeness and interface-quality risk.

## Stop Conditions
- Stop if an adaptive layout changes navigation, roles, API behavior, booking lifecycle, notification preferences, or onboarding persistence.
- Stop if a normal Dynamic Type regression cannot be avoided while fixing accessibility sizes.
- Do not upload, submit, change App Store metadata, or mutate isolated review data in this slice.

## Slices
- [x] Make shared Settings/Browse rows and identity headers switch to a vertical reading order at accessibility sizes.
- [x] Make Welcome header, body, and footer share the viewport without overlap at accessibility sizes.
- [x] Make notification pause choices readable without narrow pill columns.
- [x] Give booking rows an accessibility-size composition that preserves title, status, timing, and location.
- [x] Add focused source-contract coverage for the adaptive-layout rules.
- [x] Sync Mobile and App Review audit evidence after runtime verification.

## Verification
- [x] Focused iOS source-contract tests.
- [x] Complete native iOS source-contract suite.
- [x] Maximum Dynamic Type runtime smoke in dark and light appearance on iPhone 16.
- [x] Normal Dynamic Type runtime regression smoke on the same surfaces.
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:xcode:verify`
- [x] `npm run verify:docs`
- [x] `npm run build:app`
- [x] `git diff --check`

## Review
- Shipped: Adaptive layouts for Welcome, Profile, Settings, Notifications, Bookings, and item rows, plus focused regression coverage.
- Verified: 50 native source-contract files with 201 tests; iPhone maximum and normal text-size runtime smoke; iPhone and 13-inch iPad simulator builds; generic-device compilation; project drift, audit coverage, docs, and production web build gates.
- Deferred: Exhaustive maximum Dynamic Type polish across every secondary and staff-only screen is explicitly outside the first-submission gate. App Accessibility claims remain unset.
- Blocked: Physical-device camera, APNs, install/upgrade, and signed-candidate interaction still require connected hardware.
- Proof artifacts: `tests/ios-accessibility-layout-hardening.test.ts`, XcodeBuildMCP iPhone/iPad runs, and this plan's verification commands.
- Next slice or stop: Stop broad accessibility expansion. Continue only with confirmed first-submission blockers and normal-size regressions.
