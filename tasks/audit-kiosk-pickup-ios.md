# Audit: kiosk pickup (iOS) — 2026-05-08

**MVP verdict (pre-fix):** **does NOT ship** — `kioskPickupConfirm` swallows server errors with `try?`, producing phantom-success states where the booking stays `PENDING_PICKUP` server-side but iOS shows the success screen and the student walks off with gear. Plus the camera-feedback / status-token / race-guard gaps from the checkout pass apply identically here.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskPickupView` in `ios/Wisconsin/Kiosk/KioskPickupView.swift` (PENDING_PICKUP → OPEN scan-and-confirm flow) + `KioskAPI.kioskPickupConfirm`/`kioskPickupScan` in `KioskAPIClient.swift`. Fifth kiosk-surface follow-up after activation, idle, student-hub, and checkout.

**Surrounding context:** pickup is the OTHER kiosk write surface besides checkout — staff creates a `PENDING_PICKUP` booking on web, student walks up to kiosk, scans each item to record `scanEvents` server-side, then taps Confirm which transitions PENDING_PICKUP → OPEN. Server validates that every serialized item has a corresponding scan event before allowing the transition; bulk items must hit `checkedOutQuantity == plannedQuantity`.

## P0 — blocks MVP

- [x] [Hardening] **`KioskAPI.kioskPickupConfirm` swallows ALL errors with `try?`.** The line `_ = try? await session.data(for: req)` drops every failure (network, 404, 409 "Scan X before confirming", 5xx, decoding) into the void. The function returns void on success AND on every flavor of failure, so `KioskPickupView.confirmPickup`'s `do/catch` block never sees an error and always routes to `.success`. The booking stays `PENDING_PICKUP` server-side, the student sees "Pickup confirmed!", walks off with the gear, and the booking is now an audit-trail orphan.
      `ios/Wisconsin/Kiosk/KioskAPIClient.swift:117-122`.
      Why it blocks: this is the phantom-success class of bug — same severity as the pre-prior-audit heartbeat 401 swallow. Server returns 409 when iOS thinks all items are scanned but the server's `scanEvents` table disagrees (possible if HID dedupe drops a scan); user sees green and walks off. Or the server returns 5xx on a bad migration; same outcome. There is *no path* to detect the failure on the floor.
      Suggested fix: replace `try?` with the same `perform` codepath every other API method uses. The endpoint returns `ok({ success: true, bookingId })`; decode it via a small DataWrapper-shaped envelope so `perform` propagates 401/404/409/5xx. The parent `do/catch` then surfaces the actual server error.

## P1 — polish before ship

- [x] [Hardening] **Camera-fallback sheet hides scan feedback.** Same parent-banner-behind-sheet bug from the checkout pass. When a staffer opens the camera (HID scanner dead), each scan looks silent — feedback banner lives on the parent view, hidden under the sheet.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:39-44, 104-108`.
      Suggested fix: pipe the local feedback into the camera view via the new `feedbackMessage` + `feedbackTone` parameters shipped on `KioskBarcodeCameraView` today. Add a `cameraTone(for:)` mapper from the local `ScanFeedback` enum to `KioskBarcodeCameraView.Tone`.

- [x] [Hardening] **Late HID scans during the `isConfirming` window race the confirm API.** Same shape as checkout's race: a stuck scanner trigger fires a scan after Confirm is tapped; the scan hits `kioskPickupScan` (writing a new scanEvent) but doesn't make the confirm payload. Outcome is benign for pickup (server confirm uses scanEvents which DO include the late one) but UX-wise the user sees "already confirmed" or "not in this pickup" feedback overlapping the success transition.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:181-203`.
      Suggested fix: short-circuit `handleScan` with a "Hold on — confirming pickup" feedback when `isConfirming` is true. Mirrors the checkout fix.

- [x] [Hardening] **Generic error strings hide server detail.** Scan failures show "Scan failed" (no APIError surfacing); confirm failures (post-P0 fix) will show "Could not confirm pickup. Please try again." — but the server's 409 messages are specifically actionable ("Scan {tagName} before confirming pickup", "Scan all {sku} units before confirming pickup"). Hiding those forces the student to figure out what's missing on their own.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:200, 221`.
      Suggested fix: same `(error as? APIError)?.errorDescription ?? fallback` pattern shipped on checkout today. The 409 messages are already humanized at the server.

- [x] [UI polish] **All status colors are raw `.green/.red/.orange`.** Scanner border (via progress ring), feedback banner, "All items confirmed" copy, item-row checkmark, error text, Confirm button background — all drift from the cross-app `StatusTone` token system.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:85, 101, 125, 173, 247, 295-298`.
      Suggested fix: route through `Color.statusText(.green)` / `.red` / `.orange` everywhere except the kiosk-brand surfaces (Confirm button stays visually distinct via the green completion semantic). Match the checkout pass.

- [x] [UI polish] **Items list doesn't auto-scroll to the just-scanned item.** With >8 items in a pickup, a scan checks off a row that may be off-screen; the staffer can't tell which item just confirmed. Same fix shipped on checkout today.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:158-165`.
      Suggested fix: `ScrollViewReader` wrapping the `LazyVStack`; on a successful scan, scroll to the matching item id with `anchor: .center` (or `.bottom`) so the freshly-checked row lands in the visible area; respect reduce-motion.

- [x] [Flows] **No haptics on scan events.** Same gap pattern as checkout pre-fix — busy gear room, staffer's eye on the scanner gun, not the screen.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:181-211`.
      Suggested fix: `Haptics.success/warning/error` on each scan-feedback branch; `Haptics.success()` on confirm success.

- [x] [Flows] **Confirm-failure error renders as a tiny red caption inside the checklist panel; no recovery affordance.** When confirm fails post-P0-fix, the message lands in the bottom of the right panel, easy to miss. Should bubble up to the same `FeedbackBanner` slot the scan results use.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:172-174, 220-222`.
      Suggested fix: drop the bottom `error` caption; route confirm failures through `showFeedback(.error(message))` so the banner pulses next to the progress ring where the user is already looking. Re-enable Confirm so they can retry.

- [x] [A11y] **Feedback banner doesn't announce; progress ring not a combined element.** A blind staffer setting up the kiosk can't hear scan results; the progress ring exposes raw 40 / 8 numbers without context.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:80-97, 205-210`.
      Suggested fix: `UIAccessibility.post(.announcement, ...)` on every `showFeedback`; `accessibilityElement(children: .combine)` + explicit label "{confirmedCount} of {totalItems} items confirmed" on the ring.

- [x] [A11y] **Confirm button label doesn't expose count.** "Confirm Pickup" gives a VO user no signal about the item count or completion state.
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:114-130`.
      Suggested fix: `accessibilityLabel("Confirm Pickup, \(totalItems) items")` when ready; "Scan {count} more before confirming" when not.

- [x] [A11y] **`PickupItemRow` is not combined; checkmark icon reads as "checkmark circle fill".**
      `ios/Wisconsin/Kiosk/KioskPickupView.swift:240-263`.
      Suggested fix: combine + hide decorative icon + explicit label "{name}, {tag}, {confirmed/pending}".

## P2 — post-MVP

- [ ] [Polish] **Deferred.** **Mid-session resume after back.** Server persists scan events across re-entry, but iOS `confirmedIds` is local `@State` — coming back to the same pickup after a Back tap re-loads with empty local state, forcing the user to re-scan every item. The server-side validation still works on subsequent scans (idempotent) but the user sees 0/8 confirmed and may not realize the data is preserved. **Requires a server change** to expose `scanEvents` via the kiosk checkout-detail endpoint, then load existing confirmed assetIds into `confirmedIds` on `loadDetail`. Logged for the next pickup-flow iteration.
- [ ] [Polish] **Deferred.** Audio chime on scan / confirm. Same disposition as checkout — kiosk speakers commonly muted; haptics covers the role.
- [ ] [Polish] **Deferred.** Bulk-slot scan UX (each #1, #2 unit appears as a separate row). The current model surfaces them as items — works, but a "Bulk: SKU (2 of 5 units)" collapsed group might scale better at high quantities. Defer until a real high-quantity pickup hits production.

## Acceptance criteria status

There is no `AREA_KIOSK_PICKUP` doc; AC inferred from `AREA_KIOSK.md` and `tasks/kiosk-gate-pending-pickup-plan.md`:

- [x] AC: pickup transitions PENDING_PICKUP → OPEN.
- [x] AC: HID scanner + camera fallback both work.
- [x] AC: progress ring shows confirmed / total.
- [x] AC: per-item checklist updates on each successful scan.
- [x] AC: a confirm-API failure does not show a success screen — **closed by P0 fix.**
- [x] AC: camera fallback feels responsive on each scan — **closed by P1 in-camera feedback fix.**
- [x] AC: server error detail reaches the user — **closed by P1 surfacing fix.**
- [x] AC: late scans during confirm don't desync — **closed by P1 race fix.**
- [x] AC: VoiceOver users hear scan and confirm results — **closed by P1 announce fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web kiosk dead; nothing to mirror)
- [x] Accessibility
