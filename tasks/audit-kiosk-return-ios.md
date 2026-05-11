# Audit: kiosk return (iOS) — 2026-05-08

**MVP verdict (pre-fix):** **does NOT ship** — `kioskCheckinComplete` swallows server errors with `try?`, exact replica of the pickup-confirm phantom-success bug closed in the prior pass. Plus the same shape of P1 polish gaps (in-camera feedback, scan-during-complete race, status-token drift) the other kiosk surfaces had.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskReturnView` in `ios/Wisconsin/Kiosk/KioskReturnView.swift` (OPEN → COMPLETED scan-and-complete flow with partial-return support) + `KioskAPI.kioskCheckinComplete`/`kioskCheckinScan` in `KioskAPIClient.swift`. Sixth and final kiosk-surface pass after activation, idle, student-hub, checkout, and pickup.

**Surrounding context:** return is the inverse of pickup — student walks up with gear, scans each piece, taps "Complete Return" (or "Return X of Y Items" for partial). Server delegates to `kioskCompleteCheckin` (SERIALIZABLE wrapper, bulk-aware `maybeAutoComplete`, scan-session close, lost-unit handling) and returns `{ returnedItems, totalItems, completed }`. Mid-session resume already works because `loadDetail` pre-populates `returnedIds` from server-marked `item.returned` flags.

## P0 — blocks MVP

- [x] [Hardening] **`KioskAPI.kioskCheckinComplete` swallows ALL errors with `try?`.** Same shape as the pickup-confirm bug closed an hour ago. `_ = try? await session.data(for: req)` drops every failure mode (401/404/409 if the booking isn't OPEN, 5xx on a transaction conflict, network); the parent's `do/catch` never fires; the kiosk routes to `.success` even when the server failed. Booking stays `OPEN`, the student walks off thinking they returned the gear, and the asset shows "checked out" in tomorrow's overdue report.
      `ios/Wisconsin/Kiosk/KioskAPIClient.swift:101-106`.
      Why it blocks: the server uses `SERIALIZABLE` isolation around the bulk-aware checkin; transaction conflicts retry but eventually surface as 5xx. Without error propagation, those become silent phantom-completes — and they happen *exactly* during high-traffic returns when the kiosk is busiest.
      Suggested fix: replace `try?` with `perform`. Server returns `ok({ returnedItems, totalItems, completed })`; decode into a `Response` so 401/404/409/5xx propagate as APIError. Bonus — using the actual server-side counts in the success message ("returned 6 of 8 items") avoids the iOS-local-vs-server drift that exists when items are checked in via a sister kiosk.

## P1 — polish before ship

- [x] [Gaps] **Server returns `{ returnedItems, totalItems, completed }` on success but iOS uses local counts.** The success-screen message reads `"\(returnedCount) of \(totalItems) items returned"` which is the iOS view's optimistic count — not what the server actually flipped. If a sister kiosk checked in an item mid-session, the iOS local count differs from the server's truth.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:243-247`.
      Suggested fix: have `kioskCheckinComplete` return a `Response` value carrying the server counts; use those in the success message and the `completed` flag to choose between "All N items returned. Thanks!" and "{returned} of {total} items returned."

- [x] [Hardening] **Camera-fallback sheet hides scan feedback.** Same parent-banner-behind-sheet issue closed on checkout and pickup.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:39-44, 109-113`.
      Suggested fix: pipe local feedback into `KioskBarcodeCameraView` via the new `feedbackMessage` + `feedbackTone` parameters; add a `cameraTone(for:)` mapper.

- [x] [Hardening] **Scan-during-complete race.** A late HID scan during the `isCompleting` window hits `kioskCheckinScan` (which writes a scanEvent server-side); the success screen takes over before the user sees the scan response — and now there's a phantom return event for an item past the complete deadline.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:208-228`.
      Suggested fix: `handleScan` short-circuits with "Hold on — completing return" while `isCompleting` is true. Mirrors checkout/pickup.

- [x] [Hardening] **Generic error strings hide server detail.** Scan failures show "Scan failed"; complete failures (post-P0 fix) currently default to "Return failed. Please try again." The server's 409s are specifically actionable ("Cannot complete checkin — booking is in COMPLETED state", lost-unit messages) and worth surfacing.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:225, 249`.
      Suggested fix: `(error as? APIError)?.errorDescription ?? fallback` on both catch blocks.

- [x] [Flows] **Complete-failure error renders in the bottom-of-the-checklist-panel error caption with a "Try again" link, far from where the user is looking.** The user clicked the big Return button at the bottom of the LEFT panel; the error appears in the RIGHT panel, easy to miss.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:183-201, 248-249`.
      Suggested fix: same fix shipped on pickup — drop the right-panel error caption; route complete-failures through `showFeedback(.error(message))` so the banner pulses next to the progress ring. Keep the bottom-panel error reserved for *load* failures (different recovery shape).

- [x] [UI polish] **All status colors use raw `.green/.red/.orange/.blue`.** Progress ring stroke (blue when in-progress, green when done), Overdue label, "All items returned" copy, item-row checkmark, error text, FeedbackBanner — all drift from the cross-app `StatusTone` token system.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:84, 102, 107, 186-189, 197, 280, 329-332`.
      Suggested fix: route through `Color.statusText(_:)` everywhere; `Color.kioskRed` reserved for the Complete button as a brand-emphasis surface (intentional difference from pickup's green Confirm — return is the destructive-ish flow that finalizes the booking).

- [x] [UI polish] **Items list doesn't auto-scroll to the just-returned item.** With many items, a scan checks off a row that's off-screen.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:168-176`.
      Suggested fix: `ScrollViewReader` + `lastReturnedId` state; scroll on change with `anchor: .center`; respect reduce-motion.

- [x] [Flows] **No haptics.** Same gap shipped on the other surfaces.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:208-236`.
      Suggested fix: `.success/.warning/.error` per scan-feedback branch; `.success()` on complete success.

- [x] [A11y] **Feedback banner doesn't announce; progress ring not a combined element.** Same accessibility gap from the other surfaces.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:78-114, 230-236`.
      Suggested fix: `UIAccessibility.post(.announcement, ...)` on every `showFeedback`; combined ring with explicit "{returnedCount} of {totalItems} items returned"; add an "Overdue" badge label when applicable.

- [x] [A11y] **Complete button label doesn't expose the partial / full distinction or the count.** "Complete Return" or "Return 3 of 8 Items" reads visually but VO needs an explicit label for screen readers that don't surface visual button text.
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:120-138`.
      Suggested fix: explicit `accessibilityLabel` matching the visible label state.

- [x] [A11y] **`ReturnItemRow` not combined; checkmark icon reads as "checkmark circle fill"; strikethrough state lost to VO.**
      `ios/Wisconsin/Kiosk/KioskReturnView.swift:273-297`.
      Suggested fix: combine + hide decorative icon + explicit "{name}, {tag}, {returned/pending}" label.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Damage / loss reporting from the kiosk return flow. App `/scan` is lookup-only as of the 2026-05-10 scan ownership pass, so exception reporting should be re-cut as a checkout detail or dedicated staff review flow rather than restored through `/scan?phase=CHECKIN`. Revisit if floor staff actually needs to file damage/loss from the kiosk.
- [ ] [Polish] **Deferred.** "Mark unscanned items as lost" affordance on partial complete. Today the user can complete a partial return; the unreturned items stay open. Whether they're "still out" or "lost" is a staff decision elsewhere. Skip until requested.
- [ ] [Polish] **Deferred.** Audio chime on scan / complete. Same disposition as the other surfaces.
- [ ] [Polish] **Deferred.** Unify Complete button color with pickup's Confirm (pickup ships `Color.statusText(.green)`; return ships `Color.kioskRed`). Both are "completion" actions but use different brand colors. Worth a follow-up consistency conversation, not blocking ship.

## Acceptance criteria status

There is no `AREA_KIOSK_RETURN` doc; AC inferred from `AREA_KIOSK.md` and `tasks/kiosk-checkin-checkout-audit.md`:

- [x] AC: kiosk return transitions OPEN → COMPLETED (or partial: stays OPEN with marked-returned items).
- [x] AC: HID scanner + camera fallback both work.
- [x] AC: progress ring shows returned / total.
- [x] AC: per-item checklist updates on each successful scan.
- [x] AC: mid-session resume — already-returned items pre-populate (`loadDetail:261-263`).
- [x] AC: overdue indicator visible when applicable.
- [x] AC: complete-API failure does not show a success screen — **closed by P0 fix.**
- [x] AC: success-screen counts reflect server truth, not iOS-local optimistic — **closed by P1 server-counts fix.**
- [x] AC: camera fallback feels responsive — **closed by P1 in-camera feedback fix.**
- [x] AC: server error detail reaches the user — **closed by P1 surfacing fix.**
- [x] AC: late scans during complete don't desync — **closed by P1 race fix.**
- [x] AC: VoiceOver users hear scan and complete results — **closed by P1 announce fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web kiosk dead; nothing to mirror)
- [x] Accessibility
