# Audit: extend booking (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the loading state is a full-screen overlay (drift from the inline-spinner pattern shipped across the rest of the app today), no discard confirmation if the user nudged the date and then taps Cancel, the date picker stays interactive while the API call is in flight, and preset buttons miss the `StatusTone` token discipline.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `ExtendBookingSheet` in `ios/Wisconsin/Views/ExtendBookingSheet.swift`. Recent slice 6 (2026-05-07) added quick-extend chips (+1 day / +3 days / +1 week) matching web's `BookingDetailPage.tsx` presets; this is the focused follow-up audit.

**Surrounding context:** extend is the primary self-help action on an active checkout — student or staff hitting the wall on a booking's end date and pushing it out. Reachable from the booking-detail action panel which today also picked up the ownership gate (per the booking-detail pass shipped earlier). Server validates the new end date.

## P0 — blocks MVP

_None._ The extend round-trip works. Date picker is correctly bounded to `currentEndsAt...` so a regression isn't possible. Quick presets correctly offset from the picker's current value when the user has already nudged it (mirrors web's `handleQuickExtend`). Haptics fire on preset tap, success, and error. Error shows in an inline section, not a modal alert.

## P1 — polish before ship

- [x] [UI polish] **Loading state uses a full-screen `Color.black.opacity(0.1)` overlay + bare `ProgressView`.** Drifts from the inline-spinner-on-button pattern shipped across booking-detail edit, item-detail edit, kiosk completes, and create-booking today. The overlay is barely visible (10% black) and reads as "stuck rendering" rather than "submitting." Inline spinner on the Extend button is the established convention.
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:89-94`.
      Suggested fix: drop the `.overlay { ... }`. Render the ProgressView inside the Extend toolbar item's label when `isLoading`, "Extend" otherwise. Match the booking-detail / create-booking patterns shipped today.

- [x] [Flows] **No discard confirmation when the user has changed the date.** A user taps "+3 days" (changes `newEndsAt`), then realizes they want to abandon and taps Cancel — sheet dismisses with no warning, choice is lost. `EditBookingSheet` (in the same booking-detail file) DOES have a discard confirm; this sheet should match.
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:78-80`.
      Suggested fix: if `newEndsAt > currentEndsAt` on Cancel tap, fire a `confirmationDialog("Discard changes?", ...)` with destructive Discard + Keep Editing. Mirror the EditBookingSheet pattern.

- [x] [Hardening] **Sheet is interactively dismissable during the API call.** Swipe-down on the sheet while `isLoading` is true cancels the dismiss-but-not-the-task — the API completes in the background, the parent's `onSuccess()` callback STILL fires (the closure is captured), but the user has the visual experience of "I cancelled" while the booking actually got extended. Surprising.
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:27-95`.
      Suggested fix: `.interactiveDismissDisabled(isLoading || newEndsAt != currentEndsAt)`. Combined with the discard confirm above, the user explicitly chooses to discard or wait.

- [x] [Hardening] **Date picker stays interactive while the API call is in flight.** User taps Extend, then before the response lands they change the date — the API call is for the OLD `newEndsAt` value (captured at extend()'s call site), but the picker now shows a NEW value that didn't get sent. After success, parent reloads, `currentEndsAt` updates to the OLD value. User confused about which value won.
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:57-65, 38-55`.
      Suggested fix: gate the entire Form's interaction on `!isLoading` via `.disabled(isLoading)` on the picker section + preset buttons (which already have `.disabled(isLoading)` ✓ on each preset, but the picker doesn't).

- [x] [UI polish] **Preset buttons render with no tint.** `.buttonStyle(.bordered)` defaults to accent color which is fine, but the cross-app pattern is to route through `Color.statusText(.blue)` for "active" semantics. Minor.
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:39-52`.
      Suggested fix: `.tint(Color.statusText(.blue))` on each preset button.

- [x] [A11y] **Preset buttons announce just "+1 day, button" — no information about the resulting date.** A blind user can't anticipate what the tap will do without already knowing the current end date.
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:41-49`.
      Suggested fix: `.accessibilityLabel(...)` per preset that includes the resulting date label, e.g., "Extend by 1 day, to {date}". Computes off `newEndsAt > currentEndsAt ? newEndsAt : currentEndsAt` (same base as the action) so it stays accurate after the user has already nudged.

- [x] [A11y] **Extend toolbar button has no explicit label** so VO reads "Extend, button" — fine, but missing the result context. While tapping, the inline spinner replaces the text; VO should announce "Extending booking" rather than "Loading."
      `ios/Wisconsin/Views/ExtendBookingSheet.swift:81-87`.
      Suggested fix: `.accessibilityLabel(isLoading ? "Extending booking" : "Extend booking")`.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** "+2 hours" / "+4 hours" sub-day presets for short extensions. Web only has day-grain; iOS could add hours but that's diverging without a documented floor ask. Skip until requested.
- [ ] [Polish] **Deferred.** Show the resulting date as a caption next to each preset chip ("+3 days · Wed Mar 11"). Useful but adds visual density; the picker already shows the value once tapped. Skip.
- [ ] [Polish] **Deferred.** Conflict pre-check on the extended date window — server enforces, client could fire `checkAvailability` on date change. The cost is the same call as create-booking does. Worth doing if collision rates become a documented issue.
- [ ] [Polish] **Deferred.** Cancel-during-loading actually cancels the API task. Today the task continues to completion. Bandwidth-only win on a typically-fast call. Skip.

## Acceptance criteria status

Per `AREA_BOOKINGS.md` and the prior bookings audit:

- [x] AC: extend the end date of an active booking.
- [x] AC: date picker bounded to `currentEndsAt...`.
- [x] AC: quick presets (+1 day / +3 days / +1 week) per slice 6.
- [x] AC: server error surfaces with humanized message.
- [x] AC: success haptic; error haptic.
- [x] AC: loading state matches today's inline-spinner convention — **closed by P1 spinner fix.**
- [x] AC: unintentional dismiss with unsaved change is gated — **closed by P1 discard + dismissDisabled fixes.**
- [x] AC: picker can't drift from the value being submitted — **closed by P1 disable fix.**
- [x] AC: VoiceOver users hear what each preset does — **closed by P1 a11y fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web has same preset semantics; aligned)
- [x] Accessibility
