# Audit: scan (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the floor user with a damaged barcode or a dim equipment room has dead-ends inside Scan.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `ScanView` in `ios/Wisconsin/Views/ScanView.swift` (the dedicated 4th tab, role: .search) plus `Core/SearchService.swift`. Excludes `Kiosk/KioskBarcodeCameraView.swift` (separate kiosk surface) and `Search/QRScannerSheet.swift` (used from `GlobalSearchSheet`'s scan button).

**Scope filter:** scan = lookup, not check-in/out. Project rule per `project_scan_role.md`: check-in/out runs through kiosk; scan is a general lookup tool. Web has 3 modes (lookup / checkout / checkin) — iOS scan stays lookup-only by design.

## Web parity baseline

- `/scan` lookup mode — camera scanner, `ItemPreviewDrawer` for results, "Type Code Instead" button, lookup-mode badge in header, "Start the camera above to scan any QR code" hint when paused.
- `/scan?checkout=…&phase=CHECKOUT|CHECKIN` — kiosk-equivalent bulk modes; **stays web/kiosk only on iOS**.
- Sister surface `QRScannerSheet` (used from floating search) has a torch toggle + "Type Code Instead" button — iOS Scan tab has neither.

## P0 — blocks MVP

_None._ Camera permission flow is solid (pre-prompt → system alert → denied state with Settings deep-link); VoiceOver users get a manual-entry fallback; results jump to the right detail view; reduce-motion is respected; the offline banner from `AppTabView` covers the network-down case.

## P1 — polish before ship

- [x] [Gaps] **No torch toggle on the main Scan tab.** `QRScannerSheet` (the floating-search variant) has a torch button via `AVCaptureDevice.torchMode = .on`; the Scan tab does not. Equipment rooms are dim; floor staff routinely scans against shaded labels in storage closets.
      `ios/Wisconsin/Views/ScanView.swift:53-91` — overlay has only a `ProgressView` for the in-flight state.
      Why it matters: the most-used scanner surface (a permanent tab) is *less* capable than the secondary one tucked behind floating search. Floor users learn to avoid the tab and use the floating button, which is the wrong incentive.
      Suggested fix: add a torch button to the bottom overlay (matching `QRScannerSheet:69-78` styling: `Image(systemName: torchOn ? "bolt.fill" : "bolt.slash")` in a `.ultraThinMaterial` capsule). Toggle via `AVCaptureDevice.default(for: .video).torchMode`; auto-off on `scenePhase != .active` and on unmount.

- [x] [Gaps] **No "Type code instead" affordance for sighted users.** Manual entry only appears for VoiceOver users via `ScanManualEntryView`. A sighted user with a damaged sticker (peeling lamination, marker over the QR, etc.) is stuck — they have to abandon the tab, switch to floating search, and type there.
      `ios/Wisconsin/Views/ScanView.swift:55-66` — manual entry only renders inside `if voiceOverEnabled`.
      Why it matters: damaged stickers are common with field gear (rain, dust, abrasion). Web's `/scan` page has a dedicated "Type Code Instead" button. iOS doesn't, even though the same `SearchService` would serve.
      Suggested fix: add a "Type code instead" `.ultraThinMaterial` button in the bottom overlay (next to the torch). On tap, present `ScanManualEntryView` as a sheet at `[.medium]` detent. The same `handleScan(_:)` already handles typed input, so no new API path is needed.

- [x] [Hardening] **Network/server errors surface as "Nothing found".** `handleScan` swallows API failures with `try? await SearchService.shared.search(...) ?? SearchResults()`. If the server is down or the request times out, the user sees the empty-state "This code isn't linked to any item yet." — actively misleading.
      `ios/Wisconsin/Views/ScanView.swift:98`.
      Why it matters: a 5xx mid-shift makes a floor user think a brand-new sticker is broken; they peel it off, start a support ticket, and re-tag — a lot of damage from a confusing copy fork.
      Suggested fix: replace `try?` with explicit `do/catch`. On error, propagate the `error.localizedDescription` (already humanized by `APIError`) into the result sheet's empty/error state with a "Try again" button. Match the existing dashboard / bookings retry pattern.

- [x] [Flows] **Camera is visible behind the result sheet at `.medium` detent, but scanning is paused.** After a result lands, `isScanning = false` keeps the scanner stopped until the user dismisses the sheet. The user can see the live camera feed (correct, per `presentationBackgroundInteraction(.enabled(upThrough: .medium))`) but pointing at a new code does nothing. They have to swipe-down → scan → swipe-up to read the result, instead of just lining up the next item.
      `ios/Wisconsin/Views/ScanView.swift:75-91` and `ScanView.swift:94`.
      Why it matters: a floor user with a stack of gear wants a "scan one, glance, scan next" rhythm. Today they get "scan one, glance, dismiss, scan next" — extra friction every single time.
      Suggested fix: re-enable `isScanning = true` after the result lands. The Coordinator's `lastScanned` already dedupes the same code; a NEW code will fire while the sheet is at `.medium`. On the new fire, `handleScan` re-stops scanning and re-opens results with the new payload. Keep the dismiss-resets behavior so the user can intentionally re-scan the same item.

- [x] [UI polish] **Result sheet empty state has no recovery affordance.** Shows just an icon + "This code isn't linked to any item yet." — no way to type a code, no way to retry. The user has to swipe-dismiss and start over.
      `ios/Wisconsin/Views/ScanView.swift:234-240`.
      Suggested fix: add a "Type code instead" `Button` in the `ContentUnavailableView`'s `actions:` slot, opening the same manual-entry sheet as the new toolbar button. When the empty state is from an error (after the hardening fix above), swap the icon + copy and offer "Try again" instead.

## P2 — post-MVP

- [x] [Polish] **Auto-jump on single-result scans.** When `SearchResults` contains exactly one item (one asset, zero bookings, zero users) and the result is unambiguous, jump straight to `ItemDetailView` instead of showing the sheet. Saves a tap on the most common case (sticker scan → one item match). Implemented; preserves multi-result sheet for ambiguous codes.
- [ ] [Parity] **Deferred.** "Look Up" mode badge on the toolbar — web shows a small gray badge to clarify "this is lookup, not check-in/out." On iOS the Scan tab IS lookup by design (kiosk handles in/out), so the badge would be tab-redundant. Skip unless a second mode ever lands on iOS.
- [ ] [Polish] **Deferred.** Recent scans / scan history. Web doesn't have it either; a floor user can re-scan or use floating search. Defer until requested.
- [ ] [Hardening] **Deferred.** Dedupe across rapid different codes — today only the SAME code is deduped via `lastScanned`. If the camera momentarily catches two distinct codes in quick succession, the second one wins. Vision API already debounces internally; defer until it surfaces in the field.
- [ ] [A11y] **Deferred.** Camera-feed live region announcement for VoiceOver — `ScanManualEntryView` is the path for VO users so this isn't a regression, just a courtesy.

## Acceptance criteria status

There is no `AREA_SCAN.md` covering iOS specifically. AC inferred from `AREA_SCAN.md` + `AREA_MOBILE.md` + `project_scan_role.md`:

- [x] AC: scan a sticker → land on the right detail surface (`ItemDetailView` for assets, `BookingDetailView` for bookings).
- [x] AC: camera permission denied is recoverable from inside the app — `ScanDeniedView` deep-links to Settings.
- [x] AC: pre-prompt shown the first time so the system alert isn't a cold ask — `ScanPrePromptView`.
- [x] AC: VoiceOver users have a non-camera path — `ScanManualEntryView`.
- [x] AC: damaged-sticker recovery for sighted users — **closed by P1 manual-entry fix.**
- [x] AC: dim-room recovery — **closed by P1 torch fix.**
- [x] AC: server-error vs. unmatched-code is distinguishable — **closed by P1 hardening fix.**
- [x] AC: rapid-fire scans don't require extra dismissals — **closed by P1 re-enable fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web ↔ iOS — lookup-only by design)
- [x] Accessibility (existing VoiceOver + reduce-motion paths preserved; torch button gets accessibilityLabel)
