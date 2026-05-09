# Audit: post trade (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the haptic on post-success bypasses the centralized `Haptics` enum, the Post button has no inline spinner, and `ShiftPickerRow` uses `onTapGesture` (instead of a `Button`) with no combined accessibility element.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `PostTradeSheet` + `ShiftPickerRow` in `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift`. Reachable from `TradeBoardSheet`'s `+` toolbar (today's pass) — student picks one of their upcoming shifts to put on the trade board.

**Surrounding context:** discard confirm + `interactiveDismissDisabled` already ship from prior work. The `eligibleShifts` filter correctly limits to future active shifts. The `shift.area.shiftAreaLabel` title-case shipped earlier today is already wired here. Error rendering uses `Color.statusText(.red)` ✓.

## P0 — blocks MVP

_None._ The flow works end-to-end. Cancel-with-unsaved confirms + dismiss-disabled. Server error surfaces inline. Post button correctly disables when nothing's selected.

## P1 — polish before ship

- [x] [Hardening] **Direct `UINotificationFeedbackGenerator()` call bypasses the centralized `Haptics` enum.** Same drift fixed today on link sticker wizard + trade board.
      `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift:133`.
      Suggested fix: `Haptics.success()` on success path; `Haptics.warning()` in the catch (post failure was previously silent).

- [x] [UI polish] **Post button has no inline spinner while posting.** Drifts from today's "inline spinner replaces label" pattern shipped on every other submit button (booking detail edit, item detail edit, kiosk completes, create-booking, extend-booking, edit-shift-times).
      `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift:71-77`.
      Suggested fix: render `ProgressView()` in the toolbar item's label when `isPosting`, "Post" otherwise. Matches the Save / Create / Extend patterns.

- [x] [A11y / Flows] **`ShiftPickerRow` uses `onTapGesture` instead of a `Button`.** VoiceOver doesn't reliably register `onTapGesture`-only views as actionable; the row also walks each Text element separately rather than reading as one combined entry. Same shape of fix shipped on AssetPickerRow today.
      `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift:41-46, 95-120`.
      Suggested fix: wrap the row in a `Button` (with `.buttonStyle(.plain)` to preserve the look), add `.accessibilityElement(children: .combine)` + an explicit row label ("Video shift, Football vs Western Illinois, Friday Sep 11 9:00 AM to 1:00 PM"), apply `.accessibilityAddTraits(.isSelected)` when the row is selected, and `.accessibilityHidden(true)` on the trailing checkmark icon.

- [x] [A11y] **Selected checkmark `Image` reads as "checkmark circle fill" to VoiceOver.**
      `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift:114-117`.
      Suggested fix: incorporated into the row-Button fix above via `.accessibilityHidden(true)` on the icon — the `.isSelected` trait carries the state.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** `eligibleShifts` empty state could include a small CTA pointing at where to find shifts (the Schedule tab). Today it just says "No upcoming active shifts available to post." — fine for MVP.
- [ ] [Polish] **Deferred.** Consume the returned `ShiftTrade` from `postShiftTrade(...)` and pass it to the `onPosted` callback (instead of the original `MyShift`). Caller (`TradeBoardSheet`) just reloads its own list, so the actual trade object isn't needed today.
- [ ] [Polish] **Deferred.** Notes character counter / max length hint. Server enforces; no documented overflow issue.

## Acceptance criteria status

Per `AREA_SHIFTS.md`:

- [x] AC: students can post one of their upcoming shifts for trade.
- [x] AC: only future active shifts are eligible (filter).
- [x] AC: optional notes field appears after selecting a shift.
- [x] AC: discard confirm + dismiss-disabled when there's unsaved input.
- [x] AC: server error surfaces inline.
- [x] AC: success haptic via centralized `Haptics` enum — **closed by P1 fix.**
- [x] AC: inline spinner on Post button — **closed by P1 fix.**
- [x] AC: VoiceOver users hear each row as a combined element with selected state — **closed by P1 fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (N/A — students-only iOS surface)
- [x] Accessibility
