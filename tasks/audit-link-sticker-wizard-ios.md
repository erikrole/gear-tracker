# Audit: link sticker wizard (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but it bypasses the centralized `Haptics` enum (raw `UINotificationFeedbackGenerator()` calls), the search step swallows API errors via `try?` (showing "no results" on server failure), and several decorative icons leak names to VoiceOver.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `LinkStickerWizard` + four step views (`ScanStepView`, `PickItemStepView`, `ConfirmStepView`, `SuccessStepView`) + `StepIndicator` + `AssetPickRow` + `ScannerRepresentable` in `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift`. Reachable from `ProfileView` → Tools → Link Sticker Codes (STAFF/ADMIN-only utility for binding sticker codes to assets).

**Surrounding context:** Dev-tool surface used during sticker rollouts — staffer scans a freshly printed sticker, picks the asset to bind it to, confirms, and the wizard recycles to the next sticker. Multi-step state machine; success step has a "Scan Next Sticker" loop affordance.

## P0 — blocks MVP

_None._ The state machine is correct (force-unwraps on `selectedAsset!` in steps 3 and 4 are guarded by Step 2's `pick(_:)` setting it before transition). Camera permission flow handles authorized / denied / unsupported. Manual-entry alert covers no-camera devices. Server failure on `updateAssetQR` surfaces inline in the Confirm step with the humanized message. Pick-step stale-write race is correctly guarded by `Task.isCancelled` checks before/after the API call.

## P1 — polish before ship

- [x] [Hardening] **Direct `UINotificationFeedbackGenerator()` calls bypass the centralized `Haptics` enum.** `Core/Haptics.swift` is the single source of truth for haptics across the app; this wizard reaches into UIKit directly.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:236, 478, 481`.
      Why it matters: when we evolve haptic strength / pattern / a11y reduce-motion behavior centrally, the wizard won't pick up the change. Cross-app token discipline.
      Suggested fix: replace each call site with the corresponding `Haptics.success() / .error() / .warning()` wrapper.

- [x] [Hardening] **`PickItemStepView` search swallows errors with `try?`.** Server failure during the asset search leaves `results = []` indistinguishable from "no matches" — same shape of bug fixed on global search today.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:367-382`.
      Suggested fix: explicit `do/catch`; capture an error message in a new state; render an error row with Retry when the catch fires + results are empty.

- [x] [A11y] **`StepIndicator` reads as separate circles + labels.** VoiceOver walks "1 Scan, 2 Item, 3 Link" piece by piece without communicating which step is current. A combined element with an explicit "Step 2 of 3: Item" label is friendlier.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:68-115`.
      Suggested fix: `.accessibilityElement(children: .ignore)` on the outer HStack + an explicit label "Step \(currentIndex + 1) of \(steps.count): \(steps[currentIndex].1)".

- [x] [A11y] **`AssetPickRow` not a combined element.** VoiceOver reads "archivebox, displayName, tag, serial, chevron right" — five pieces. Combine + hide decoratives + explicit "name, tag" label.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:385-407`.
      Suggested fix: `.accessibilityElement(children: .combine)` + `.accessibilityHidden(true)` on the leading archivebox icon and trailing chevron + explicit row label.

- [x] [A11y] **Several decorative icons leak names** — `qrcode` in the scanned-code chip, `xmark.circle.fill` clear button (the latter has no explicit a11y label so VO reads "x mark circle fill"), `checkmark.circle.fill` in the success step.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:188, 199, 501`.
      Suggested fix: `.accessibilityHidden(true)` on truly decorative icons; explicit `.accessibilityLabel("Clear scanned code")` on the X button.

- [x] [UI polish] **Torch button label format** — `Label("Torch On" / "Torch", systemImage:)` exposes the icon name to VoiceOver. Same family of fix today.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:213-222`.
      Suggested fix: `.accessibilityLabel(torchOn ? "Turn off flashlight" : "Turn on flashlight")` so VO reads the action, not the icon.

- [x] [Hardening] **`selectedAsset!` force-unwraps in `ConfirmStepView` and `SuccessStepView` calls.** Today the state machine guarantees these are non-nil at those steps, but a defensive guard would survive future refactors of the wizard's transition logic.
      `ios/Wisconsin/Views/DevTools/LinkStickerWizard.swift:35, 43`.
      Decision: **Skip.** The risk of a state-machine regression is low, and the explicit `!` documents the contract. Leave for now; defensive guards could obscure the intent.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Warn if the asset already has a QR code linked. Today `updateAssetQR` overwrites silently; the staffer might unintentionally re-link an asset. Would require fetching the asset detail (which has `qrCodeValue`) instead of the list-shape `Asset` (which doesn't). Trade-off: extra API call vs. the safety check. Skip until a documented incident.
- [ ] [Polish] **Deferred.** "Recently linked" history within the session. The success step already shows "N linked this session" but doesn't list them. Could be useful for "did I link X to the right asset?" verification. Out of scope for MVP.
- [ ] [Polish] **Deferred.** Bulk linking (queue multiple stickers, then resolve assets in batch). The current one-at-a-time flow scales fine for the documented usage.

## Acceptance criteria status

This is a dev-tools utility without a dedicated AREA doc; AC inferred from the slice 142 ProfileView change log:

- [x] AC: STAFF/ADMIN can reach the wizard from Profile.
- [x] AC: 4-step flow (Scan → Pick Item → Confirm → Success).
- [x] AC: torch + manual entry as scan fallbacks.
- [x] AC: search assets by name / tag / serial.
- [x] AC: confirm step shows scanned code + selected asset before save.
- [x] AC: success step recycles to scan next sticker.
- [x] AC: error surfaces with humanized message on save failure.
- [x] AC: haptics centralized via `Haptics` enum — **closed by P1 fix.**
- [x] AC: search server-error distinguishable from no-match — **closed by P1 fix.**
- [x] AC: VoiceOver users hear actions, not icon names — **closed by P1 a11y fixes.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (staff-only iOS utility; no web equivalent — sticker provisioning happens on the floor)
- [x] Accessibility
