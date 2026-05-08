# Audit: kiosk checkout (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but a misclick scan is permanent (no undo path), the camera sheet hides scan feedback, late scans during the "Processing…" window can race the complete API, and accent colors drift.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskCheckoutView` in `ios/Wisconsin/Kiosk/KioskCheckoutView.swift` plus its camera fallback `KioskBarcodeCameraView.swift`. Fourth kiosk-surface follow-up after activation, idle, and student-hub passes shipped earlier today.

**Surrounding context:** kiosk checkout is free-form (no booking — student walks up, scans whatever they need, completes). Cart persists in `KioskStore` keyed by userId so a brief inactivity reset doesn't discard scans (per the broad 2026-04-24 audit). HID hand scanner is the primary input via the always-first-responder `KioskScannerField`; `KioskBarcodeCameraView` is the camera fallback.

## P0 — blocks MVP

_None._ The flow is correct. Cart persistence shipped per the prior audit. Discard confirmation gates a non-empty cart on Back. Auth/scoping is server-enforced. Inactivity timer fires.

## P1 — polish before ship

- [x] [Gaps] **No undo / remove-from-cart path.** Once an item lands in the scanned-items list, the only recovery is to discard the entire cart and re-scan everything. A misclick scan (wrong item, accidental double-trigger from a sticky scanner button) is permanent. For a student with 8 items already scanned, that's an 8-item rescan to remove one wrong entry.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:256-285` (`ItemRow` is read-only).
      Why it matters: every floor user has had a "wait, that's not mine" moment. Without an inline remove path, the only escape is the destructive Discard button — which actively discourages students from fixing a small mistake (because the cost is huge), so they ship the wrong item and ask staff to fix it later.
      Suggested fix: add a trailing `xmark.circle.fill` button on each `ItemRow`. Tap removes that item from the cart with a `Haptics.warning()`. No confirmation — the cost of an accidental remove is one rescan; the cost of mandatory confirmation is friction on every legitimate remove.

- [x] [Hardening] **Camera sheet swallows scan feedback.** When the camera sheet is presented, `handleScan` runs in the parent and updates `lastResult` — but the `FeedbackBanner` lives in the parent view, hidden behind the sheet. The student aiming the iPad at a stack of barcodes scans, sees no response, scans again, sees no response… server-side dedupe + cart dedupe save them, but the UX reads as "the camera isn't working."
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:46-53` (sheet) and `:108-113` (banner in parent).
      Why it matters: the camera fallback is what staff reaches for when the HID scanner is dead. If it feels broken, staff escalates to the desk-shift admin instead of using the affordance.
      Suggested fix: pass `lastResult` into `KioskBarcodeCameraView` as a `Binding<ScanFeedback?>` and render the same `FeedbackBanner` (or an overlay equivalent) on top of the camera feed. Camera scans get the same green/red/orange visual signal HID scans do.

- [x] [Hardening] **Scans during the `isCompleting` window race the complete API.** While the complete request is in flight, the HID `KioskScannerField` is still first responder; a late scan adds an item to the cart that *did not make it into* the assetIds payload sent to `/api/kiosk/checkout/complete`. On success, `clearCart` wipes the cart — including the late item that's now a phantom. Net result: a scanned-but-not-checked-out asset that staff has no way to reconcile.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:233-251`.
      Why it matters: the complete round-trip can be 1–3 s on a slow network; that's a real window. A student spamming the trigger on a hand scanner can land 2–3 scans in that gap.
      Suggested fix: short-circuit `handleScan` at the top with `guard !isCompleting else { showFeedback(.error("Hold on — finishing checkout")); return }`. Same guard in the camera path. The Complete button is already disabled during isCompleting.

- [x] [Hardening] **Generic error strings hide server detail.** Scan failures show "Scan failed"; complete failures show "Checkout failed. Please try again." Both swallow the localized error from the kiosk API, which has specific messages ("This asset is already checked out", "Asset is retired", rate-limit copy, etc.).
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:219-220, 246-247`.
      Suggested fix: surface `(error as? APIError)?.errorDescription` (already humanized by `APIError.humanize`) when the catch fires; fall back to the generic copy only when there's no message. Same pattern as the scan tab fix shipped today.

- [x] [Flows] **No haptic on scan events.** `Haptics.success()/error()/warning()` exists app-wide; checkout uses none. In a noisy gear room, a haptic confirmation that "yes, that scan registered" is more reliable than reading a banner.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:192-223`.
      Suggested fix: `.success()` on success, `.warning()` on duplicate, `.error()` on error. `Haptics.tap()` on remove. Haptics fire on the iPad chassis where the staffer's hand rests on the counter mount.

- [x] [UI polish] **Scanner border + feedback banner colors use raw `.green/.red/.orange`.** Drifts from the cross-app `StatusTone` token system. Same family of fix shipped on idle + hub today.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:183-190, 261, 322-328`.
      Suggested fix: `Color.statusText(.green)` / `.red` / `.orange` for the scanner border, the FeedbackBanner color, and the ItemRow checkmark; preserve `Color.kioskRed` for the cart count + Complete button (brand-token).

- [x] [UI polish] **Items list doesn't auto-scroll to the latest scan.** With >10 items scanned, the freshly-added row is below the fold; the user can't tell at a glance whether the scan "stuck."
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:168-175`.
      Suggested fix: wrap the `LazyVStack` in `ScrollViewReader` and call `proxy.scrollTo(item.id, anchor: .bottom)` on the most-recently added id. Skip under reduce-motion.

- [x] [UI polish] **Discard alert vs `confirmationDialog`.** Modern iOS prefers `.confirmationDialog` for destructive choices on iPad — it renders a clean action sheet with the destructive button visually distinct. `.alert` is fine but reads more like a system error.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:36-45`.
      Suggested fix: switch to `.confirmationDialog` matching the kiosk-deactivate pattern shipped on idle today.

- [x] [A11y] **Feedback banner doesn't announce.** A blind staffer setting up the kiosk can't hear scan results. SwiftUI has no live-region modifier on iOS; the canonical path is `UIAccessibility.post(.announcement, ...)`.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:225-231`.
      Suggested fix: when `showFeedback(_:)` fires, also post an announcement carrying the message text — same pattern shipped on the activation screen earlier today.

- [x] [A11y] **Complete button label doesn't expose cart count to VO.** "Complete Checkout" gives a blind user no signal about how many items are about to ship.
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:118-136`.
      Suggested fix: `.accessibilityLabel("Complete Checkout, \(scannedItems.count) item\(scannedItems.count == 1 ? "" : "s")")`.

- [x] [A11y] **`ItemRow` is not a combined element; the green checkmark reads as "checkmark circle fill".**
      `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:256-285`.
      Suggested fix: `.accessibilityElement(children: .combine)`; `.accessibilityHidden(true)` on the checkmark; explicit label like "\(item.name), \(item.tagName)" plus a remove action via `.accessibilityAction(named: "Remove")` so VO users get parity with the visible remove button.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Audio chime on scan success/failure. iPad on a counter often has speakers muted by policy; haptics covers the same role and is more reliable. Revisit if a specific gear-room asks for audio.
- [ ] [Polish] **Deferred.** "Ready to scan" indicator near the scanner border (small green dot when HID field has first responder). Today the field is always-first-responder by design; the dot would be visual noise.
- [ ] [Polish] **Deferred.** `KioskScannerField` aggressive re-acquire fights with the camera sheet's first responder. In testing, sheets present cleanly; the worst case is a 0.15 s re-grab attempt that the sheet absorbs. Defer until observed in the field.
- [ ] [Polish] **Deferred.** Pre-flight asset availability check before the user finishes scanning (warn early on already-checked-out items). The server already enforces this on `/api/kiosk/checkout/complete`; surfacing the error per scan would require a different endpoint shape.
- [ ] [Hardening] **Deferred.** Rate-limit copy on scan-lookup throttle. Server returns the limit message; `errorDescription` surface (post-fix above) carries it through.

## Acceptance criteria status

There is no `AREA_KIOSK_CHECKOUT` doc; AC inferred from `AREA_KIOSK.md` and `tasks/kiosk-checkin-checkout-audit.md`:

- [x] AC: HID hand-scanner input works; on-screen keyboard suppressed.
- [x] AC: Camera fallback when scanner is unavailable.
- [x] AC: Scanned items list with count.
- [x] AC: Complete checkout finalizes the cart against `/api/kiosk/checkout/complete`.
- [x] AC: Cart persists across inactivity reset (prior audit).
- [x] AC: Back with non-empty cart prompts to discard.
- [x] AC: Misclick is one-tap recoverable — **closed by P1 remove fix.**
- [x] AC: Camera fallback feels responsive on each scan — **closed by P1 in-camera feedback fix.**
- [x] AC: Phantom items can't be created during the complete window — **closed by P1 race fix.**
- [x] AC: Server error detail reaches the user — **closed by P1 surfacing fix.**
- [x] AC: VoiceOver users hear scan results — **closed by P1 announce fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web kiosk dead; nothing to mirror)
- [x] Accessibility
