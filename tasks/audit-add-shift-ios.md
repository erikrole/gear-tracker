# Audit: add shift (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the Add button has no inline spinner (drifts from today's submit-button pattern) and the catch-block haptic uses `Haptics.error()` instead of `Haptics.warning()` (drifts from cross-app form-failure convention).
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `AddShiftSheet` + `ShiftAreaOption` + `ShiftWorkerOption` enums in `ios/Wisconsin/Views/Schedule/AddShiftSheet.swift`. STAFF/ADMIN-only — reachable from `EventDetailSheet`'s top-leading `+` toolbar to add a new shift slot to an event's shift group.

**Surrounding context:** small surface, already largely correct. Token-aware error text. Smart defaults (event's start/end, student worker, video area). Picker enums own canonical labels (which the new `String.shiftAreaLabel` extension shipped earlier today mirrors for free). `interactiveDismissDisabled(isSubmitting)` already shipped.

## P0 — blocks MVP

_None._ The flow is correct end-to-end. Server validation handled. Defaults are sensible. Custom-times toggle correctly gates the picker section.

## P1 — polish before ship

- [x] [UI polish] **Add button has no inline spinner while submitting.** Drifts from today's "inline spinner replaces label" pattern shipped on every other submit button (booking edit, item edit, kiosk completes, create-booking, extend-booking, edit-shift-times, post-trade, etc.).
      `ios/Wisconsin/Views/Schedule/AddShiftSheet.swift:72-76`.
      Suggested fix: render `ProgressView()` in the toolbar item's label when `isSubmitting`, "Add" otherwise. Same pattern as today's other Save / Create / Post / Extend buttons.

- [x] [Hardening] **Catch-block haptic uses `Haptics.error()` instead of `Haptics.warning()`.** Cross-app convention for non-fatal form-save failures is `.warning()` (the user can retry, nothing is broken); `.error()` is reserved for fatal/blocking conditions like phantom kiosk completions. Six other form sheets ship with `.warning()` on catch (`EditAssetSheet`, `EditBookingSheet`, `ExtendBookingSheet`, `CreateBookingSheet`, `EditShiftTimesSheet`-via-parent, `PostTradeSheet`). This sheet is the outlier.
      `ios/Wisconsin/Views/Schedule/AddShiftSheet.swift:99`.
      Suggested fix: `Haptics.warning()` to align.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Discard confirmation when the user has changed the picker selections from defaults. Trade-off: the "Add" intent is a fresh creation (vs. Edit which is mutating preserved data), and the inputs are low-stakes (segmented pickers, a toggle, optional times). Cost of accidental discard = re-tap Cancel + re-open. Other "Add" sheets (CreateBookingSheet) DO confirm because the input is significant; this is closer to the kiosk-activation level of low-stakes input. Skip until a documented friction case.
- [ ] [Polish] **Deferred.** Inline `interactiveDismissDisabled` when picker selections deviate from defaults. Same disposition as above.

## Acceptance criteria status

Per `AREA_SHIFTS.md`:

- [x] AC: STAFF/ADMIN can add a new shift slot to an event.
- [x] AC: area + worker type pickers cover the canonical enum.
- [x] AC: defaults to event's call/end time + student.
- [x] AC: optional custom-times override.
- [x] AC: server error surfaces inline with humanized message.
- [x] AC: success haptic via centralized `Haptics` enum.
- [x] AC: inline spinner on Add — **closed by P1 fix.**
- [x] AC: haptic on failure follows cross-app form convention — **closed by P1 fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (N/A — STAFF iOS surface, no web equivalent)
- [x] Accessibility (Form pickers + DatePicker handle their own a11y; nothing to do)
