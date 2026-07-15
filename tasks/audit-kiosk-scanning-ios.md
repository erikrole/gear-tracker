# Audit: kiosk scanning (iOS) - 2026-07-13

**MVP verdict:** REPORTED SCAN FAILURE FIXED AND VERIFIED ON HARDWARE. The connected canonical M2 iPad Air receives HID item scans again after the checkout details handoff.

**Audit type:** source and history diagnosis, focused contract tests, dedicated kiosk target simulator/device builds, and install/launch on the connected canonical M2 iPad Air running iPadOS 26.5.2. The former iPadOS 17 kiosk is retired and is not a verification target.

## Diagnosis

### P0 root cause: shared HID focus acquisition could fail silently and stay dead

The shared `HIDScannerField` depends on an invisible `UITextField` becoming first responder. Its `ensureScannerFocus` method called `becomeFirstResponder()` but ignored the returned `Bool`. When UIKit rejected the attempt during a SwiftUI mount or screen transition, the method scheduled no retry because the focus gate was open. The field remained mounted but unfocused, so scanner keystrokes went nowhere.

This exactly matches the report:

- `HIDScannerField` never invokes `onScan`.
- `KioskCheckoutView.handleScan` never runs.
- No API request begins.
- No success, duplicate, or error banner appears.

The July 6 focus-ownership change added a second permanent-block path. `HIDScannerFocusGate` stored visible editor identities in a process-global `Set<ObjectIdentifier>` and removed them only after a matching `textDidEndEditing` notification. `allowScannerFocusNow()` cleared only the timer. If a SwiftUI-owned editor left the hierarchy without the expected end notification, `canAcquireScannerFocus` remained false and the 300 ms retry loop ran forever without exposing state to the screen.

Evidence:

- `ios/Wisconsin/Shared/HIDScannerField.swift:10-35` owns the process-global gate and cannot clear tracked editor ownership from the checkout handoff.
- `ios/Wisconsin/Shared/HIDScannerField.swift:46-72` relies on balanced begin/end notifications to maintain that gate.
- `ios/Wisconsin/Shared/HIDScannerField.swift:122-127` attempts focus only from the representable update.
- `ios/Wisconsin/Shared/HIDScannerField.swift:174-190` retries only while the gate is closed; a failed `becomeFirstResponder()` call while the gate is open is treated as success.
- `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:625-637` performs a text-input-to-hidden-scanner handoff across a SwiftUI state transition, which is the vulnerable timing window.
- Pickup and return mount the same shared hidden field, so the defect is not limited to direct checkout: `ios/Wisconsin/Kiosk/KioskPickupView.swift:53-63` and `ios/Wisconsin/Kiosk/KioskReturnView.swift:52-62`.

The most likely regression point is commit `122b5a6a` (`fix: HID scanner can no longer steal the iPad keyboard mid-typing`, 2026-07-06), which introduced the global editor-ownership set and retry coordinator. The earlier implementation used only a time gate.

## Implemented correction

- `ensureScannerFocus` now treats the return value from `becomeFirstResponder()` and the resulting `isFirstResponder` state as authoritative. A rejected attempt enters the existing single-work-item retry loop.
- Visible editor ownership is weakly tracked. Every gate read prunes editors that disappeared or no longer own first responder, so a missing UIKit end-editing notification cannot block the scanner forever.
- The coordinator reports focus transitions once and clears readiness when scanner capture is disabled.
- Checkout, pickup, and return render the shared `KioskScannerReadinessBadge`. It shows `Scanner reconnecting` until the hidden sink truly owns first responder, `Scanner ready` when capture is live, and scan-recency feedback after input arrives.
- Hardware follow-up found a presentation defect in `KioskScanTarget`: its `PhaseAnimator` translated the corner-bracket shape on entrance, while the transient reconnecting state painted the whole target orange. The brackets are now static and neutral before the first scan; the readiness badge alone owns reconnecting orange.

### P1 resolved: the kiosk previously had no observable scanner-ready state

The scanner representable exposes `onFocusChange`, but the kiosk checkout, pickup, and return screens do not use it. They show scanning instructions even when the hidden sink is not first responder. The existing troubleshooting badge is driven by `lastScanAt`, not current focus ownership, so it cannot distinguish an idle scanner from a dead capture field.

This turns the focus defect into a silent failure instead of a visible recovery state.

### P1 partially resolved: source contracts now pin the recovery branches

`tests/ios-kiosk-scanner-focus.test.ts` now pins the failed-`becomeFirstResponder()` retry branch, stale editor pruning, focus reporting, and readiness UI wiring across checkout, pickup, and return. It remains a source contract rather than an executable UIKit focus test, so the actual HID scan on the connected iPad remains the final behavioral proof.

## API and backend boundary

The checkout, pickup, and return handlers all show explicit feedback after `onScan` fires, including caught API errors. A backend rejection therefore does not fit the immediate silent symptom as closely as pre-handler focus loss. Production runtime logs could have confirmed whether scan requests reached Vercel, but the connected Vercel account returned 403 for runtime-log access. No absence-of-traffic claim is made.

The current uncommitted five-minute idle polling and heartbeat changes are not the direct cause of HID keystrokes disappearing. They could increase first-request latency after Neon scales down, but a request timeout would eventually reach the existing error banner. The reported zero-feedback path occurs before that.

## Acceptance status

- [x] Hardware HID scan reliably reaches checkout after typed checkout details on the connected M2 iPad Air.
- [ ] Hardware HID scan reliably reaches pickup and return after sheet or keyboard transitions.
- [x] Failed focus acquisition retries until `isFirstResponder == true`.
- [x] Scanner-ready UI reflects actual first-responder ownership.
- [x] Source-contract coverage pins failed acquisition retry and stale editor-gate recovery.
- [ ] An executable UIKit test covers failed acquisition and stale editor-gate recovery.
- [x] Camera and typed recovery still route through the same custody scan handlers.
- [x] Kiosk scan API and session contract tests pass.
- [x] Dedicated `WisconsinKiosk` simulator target builds.

## Verification

- `npx vitest run tests/ios-kiosk-scanner-focus.test.ts tests/ios-kiosk-rapid-scan-atomicity.test.ts tests/kiosk-checkout-scan-badges.test.ts tests/kiosk-checkin-routes.test.ts tests/kiosk-session-auth.test.ts` - 5 files, 20 tests passed.
- `xcodebuild -scheme WisconsinKiosk -destination 'generic/platform=iOS Simulator' -configuration Debug build` from `ios/` - `BUILD SUCCEEDED`; one App Intents metadata warning because the target has no AppIntents dependency.
- `xcodebuild -scheme WisconsinKiosk -destination 'id=00008112-00160582223BA01E' -configuration Debug -allowProvisioningUpdates build` from `ios/` - `BUILD SUCCEEDED` for the connected M2 iPad Air.
- Installed and launched `com.erikrole.WisconsinKiosk` on connected device `00008112-00160582223BA01E` (iPad14,8, iPadOS 26.5.2).
- `npm run ios:xcode:verify:kiosk` - XcodeGen parity, iOS drift, 49/49 audit coverage, simulator build, and generic iOS build passed.
- `npm run verify:docs` - codemaps are current.
- `git diff --check` - passed after implementation and documentation sync.
- Physical HID checkout scan - user-confirmed successful on the connected M2 iPad Air.
- Scanner-target entrance defect - user observed orange brackets translating downward; the follow-up removes bracket `PhaseAnimator` and keeps the no-result target neutral. Corrected-build hardware confirmation pending.
- Corrected scanner-target verification - focused scanner contracts, iOS drift, 49/49 audit coverage, XcodeGen parity, simulator build, generic-device build, docs verification, and `git diff --check` passed. Physical reinstall is pending because the canonical iPad became unavailable to Xcode after the first hardware confirmation.

## Files and contracts read

- `docs/NORTH_STAR.md`
- `docs/AREA_MOBILE.md`
- `docs/AREA_KIOSK.md`
- `docs/DECISIONS.md` (D-030, D-039, D-040 and current index/change material)
- `docs/GAPS_AND_RISKS.md`
- `ios/Wisconsin/App/WisconsinApp.swift`
- `ios/Wisconsin/App/AppDelegate.swift`
- `ios/Wisconsin/Shared/HIDScannerField.swift`
- `ios/Wisconsin/Kiosk/KioskNativeTextField.swift`
- `ios/Wisconsin/Kiosk/KioskCheckoutView.swift`
- `ios/Wisconsin/Kiosk/KioskPickupView.swift`
- `ios/Wisconsin/Kiosk/KioskReturnView.swift`
- `ios/Wisconsin/Kiosk/KioskIdleView.swift`
- `ios/Wisconsin/Kiosk/KioskAPIClient.swift`
- Kiosk scan API routes and `src/lib/services/kiosk-scan.ts`
- Current scanner/session/scan-route tests
- Prior kiosk checkout, pickup, return, battery recovery, debugger, and broad kiosk audit records

## Stop recommendation

Do not change API or custody logic for this symptom. The reported checkout scan failure is closed on hardware. Stop after verifying the static scanner-target follow-up on the connected M2 iPad Air; pickup and return transition checks remain a separate hardware regression pass.
