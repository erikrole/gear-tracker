# iOS Launch Splash and Loading Polish

Written against: `a84e65af`

## Evidence chain

- Surface: main iOS cold launch, strict session restoration, and signed-out Login on iPhone 16 Pro.
- Problem: the system launch frame was a blank color, the 72-pixel mark blurred on Retina, the delayed loader had no explanation, and Login tried both separated and connected email/password treatments without finding a clean hierarchy. The selected direction is progressive disclosure: establish identity first, then ask for the password with recovery directly beneath it.
- Design evidence: the accepted native-first mobile contract, the existing `BrandSplashScene` and Gotham lockup, iOS 26 glass button styles, semantic status colors, and the 2026-08-12 signed-out simulator capture.
- Owner: `ios/Wisconsin/Views/LaunchView.swift` and `ios/Wisconsin/Views/LoginView.swift`.
- Scope and affected surfaces: OS launch configuration, shared Launch/Login/Password Setup backdrop, Motion W image resolution, strict-restore feedback, and Login presentation.
- Result: the exact iPhone 16 Pro simulator confirms a continuous branded launch surface and a compact identity-first Login. The repository's full target build remains independently blocked in `ReportsView.swift`.

## Design decision

Use one approved Motion W lockup and one dark splash base across the system launch frame and native auth destinations. Keep Login's light card, but stage it locally as an email-first flow followed by a focused password step. Passkey remains an identity-independent secondary route on the email step, password recovery sits quietly under the password field, and no account lookup occurs between steps. No auth, routing, API, or launch-duration behavior changes.

## Reuse

- Existing `BrandSplashScene`, `BrandSplashLockup`, `Brand.Radius`, semantic status colors, and native `.glass` / `.glassProminent` button styles.
- Exemplar: the current Login composition and the accepted native auth controls in `NativeAuthViews.swift`.

## Objective

Make the main iOS app feel continuous from the system-owned launch frame through strict session restoration and into a sharper native Login surface, without delaying the accepted optimistic returning-user path or changing authentication authority.

## Scope

- Main `Wisconsin` target only. `WisconsinKiosk` is unchanged.
- Use the approved Motion W identity already available in Wisconsin's asset library.
- Brand the system `UILaunchScreen` so returning users do not jump from a blank color into the app shell.
- Keep the SwiftUI launch lockup aligned with the system frame and replace the anonymous delayed spinner with truthful session-checking feedback.
- Tighten Login card density, material contrast, action hierarchy, error treatment, and in-button loading labels.
- Replace simultaneous email/password presentation with a local email-first step and a password step that summarizes the selected email, offers Change, and places recovery directly under Password.
- Keep the transition local so it cannot reveal whether an email is registered and does not add an API request.
- Preserve password, passkey, recovery, registration, Keychain, Return-key, and email-normalization behavior.
- Preserve cookie-backed session authority, optimistic snapshot routing, forced-password ordering, offline behavior, and Home-owned loading skeletons.

## Files and contracts

- `ios/project.yml` and generated `ios/Wisconsin/Supporting/Info.plist`
- `ios/Wisconsin/Assets.xcassets/Badgers.imageset/`
- `ios/Wisconsin/Assets.xcassets/LaunchLockup.imageset/`
- `ios/Wisconsin/Assets.xcassets/LaunchBackground.colorset/Contents.json`
- `ios/Wisconsin/Views/LaunchView.swift`
- `ios/Wisconsin/Views/LoginView.swift`
- `tests/ios-launch-experience.test.ts` and a focused Login presentation contract
- `docs/AREA_MOBILE.md`, `tasks/todo.md`, and `tasks/INDEX.md`

## Acceptance criteria

- [x] The OS launch frame uses the same background base and centered Wisconsin Creative lockup as the SwiftUI launch view.
- [x] Motion W assets provide native 1x, 2x, and 3x resolution without changing the approved mark.
- [x] Fast restores show no progress flash; slower restores reveal a labeled `Checking your session` state after a short delay.
- [x] Reduce Motion removes launch animation while preserving the same content and routing.
- [x] VoiceOver receives one concise loading status; decorative mark and spinner are hidden from accessibility.
- [x] Login begins with one labeled email field and a stable Continue action, then reveals one labeled password field without making an account-discovery request.
- [x] The password step summarizes the normalized identity, provides a 44-point Change action, and places `Forgot password?` quietly beneath Password.
- [x] Login shows `Signing in…` without collapsing the primary action, keeps passkey as an identity-independent secondary action on the email step, and presents failures as a compact semantic message.
- [x] Login continues to trim and lowercase email, retain Keychain content types, clear stale errors while typing, and expose native recovery and registration sheets.
- [x] Returning snapshots still enter the app shell immediately, with no artificial minimum splash duration.
- [x] Focused source contracts, project drift checks, docs checks, and the exact iPhone 16 Pro build gate are run and reported honestly.

## Verification plan

1. Add focused source contracts for launch-screen wiring, asset scales, shared base color, delayed progress, accessibility, and Login presentation/behavior boundaries.
2. Run the focused launch, Login, passkey, email-guidance, lifecycle, Welcome, forced-password, and target-split suites.
3. Run `npm run ios:project:check`, `npm run drift:ios`, `npm run audit:ios:gaps`, `npm run verify:docs`, and `git diff --check`.
4. Build and launch the `Wisconsin` scheme on `platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5` when the repository compiles.
5. Capture the actual launch transition when runtime proof is available. Keep any unrelated build failure explicit rather than treating source/build success as visual proof.

## Stop conditions

- Stop if the change would wait on `/me` before showing the returning-user shell.
- Stop if it changes API, schema, auth/session authority, onboarding order, Home payloads, or kiosk launch behavior.
- Stop and preserve concurrent usage-analytics edits in shared docs and app-root files.

## Closeout

- Shipped: branded system and SwiftUI launch continuity, Retina launch assets, delayed truthful restore feedback, and a progressive local Login with quiet recovery, identity-independent passkey entry, stable loading copy, semantic errors, and accessible transitions.
- Verified: 45 focused source-contract tests, Xcode project consistency, iOS drift and gap audits, and exact iPhone 16 Pro / iOS 26.5 captures of the centered system frame, SwiftUI handoff, labeled restore state, identity step, password step, and Change path. A source-equivalent harness compiled and ran the changed launch and Login slice.
- Deferred: physical-device launch timing, an interactive VoiceOver pass, and Instruments remain outside this visual slice.
- Blocked: the exact repository target build reaches the unchanged `ReportsView.swift` and fails at lines 75-76 because Swift 6 rejects two non-Sendable `ReportLoadOutcome` values across `async let`; the failure is outside this slice.
- Next stop: no additional launch or Login implementation remains in this slice.
