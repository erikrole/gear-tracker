# Audit: event detail (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but two raw-color drifts (`CoveragePill` and `workerTypeColor`) escaped today's token sweep, `EditShiftTimesSheet` has no in-flight UI / no discard confirm / no haptic, and a few a11y gaps remain.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `EventDetailSheet` + `EventDetailViewModel` + `CoveragePill` + `AreaBlock` + `ShiftRow` + `EditShiftTimesSheet` in `ios/Wisconsin/Views/EventDetailSheet.swift`. Slice 8 (2026-05-07) shipped status-token migration on the embedded "Pending" pill + Approve/Decline mini buttons; this is the focused follow-up.

**Surrounding context:** event detail is the schedule's primary touchpoint — students see "what's the event, what's the call time, can I request a slot," staff see "who's pending, approve/decline, add/remove shifts." Reachable from `ScheduleView` (with `myShift` populated) and `HomeView` (with `myShift` nil — prep gear button hidden). Action handlers all share a single `actionError` alert.

## P0 — blocks MVP

_None._ Auth/role gating is correct (`canManageShifts` for STAFF/ADMIN, `isStudent && isStudentSlot` for student request flow). Confirmation dialogs exist for unassign, request, and delete (with explicit "shift has someone assigned" messaging when applicable). Haptics fire on every action handler (request, unassign, approve, decline, delete, edit-times, duplicate). Pending-request approve/decline appears both in context menu AND inline mini-buttons.

## P1 — polish before ship

- [x] [UI polish] **`CoveragePill` uses raw `.green` / `.orange` / `.red`.** Drifts from the `StatusTone` token system established across the rest of the app today. `pillColor` returns raw `.green/.orange/.red` literals based on coverage percentage.
      `ios/Wisconsin/Views/EventDetailSheet.swift:514-532`.
      Suggested fix: replace `pillColor` with `StatusTone` lookup (`.green` / `.orange` / `.red`) and route through `Color.statusText(_:)` and `Color.statusBackground(_:)` for the foreground + background pair. Mirrors the kiosk + booking-detail status-token sweep.

- [x] [UI polish] **`workerTypeColor` uses raw `.blue` for student slots.** Same family of drift.
      `ios/Wisconsin/Views/EventDetailSheet.swift:808-810`.
      Suggested fix: `Color.statusText(.blue)` for `ST`, keep `.secondary` for `FT` (intentional muted treatment for staff slots).

- [x] [Hardening] **`EditShiftTimesSheet.Save` dismisses synchronously while the parent's API call is mid-flight.** The `onSave` closure takes `Date, Date -> Void`; the sheet's Save button does `isSaving = true; onSave(...); dismiss()` with no await. The parent's `updateShiftTimes(...)` is `async`, so the API call lands AFTER the sheet has dismissed. User sees zero loading state; `isSaving` is set but never rendered visually.
      `ios/Wisconsin/Views/EventDetailSheet.swift:815-863, 300-309`.
      Why it matters: sheet dismisses → user sees "back to event detail" → 1-2 s later the row updates (or not, if the call failed). Unclear whether the change took.
      Suggested fix: change `onSave` signature to `(Date, Date) async -> Void`. Inside the sheet, `await onSave(start, end)` then dismiss. Render `ProgressView` inside the Save button while `isSaving`. Match the inline-spinner pattern shipped today.

- [x] [Flows] **`EditShiftTimesSheet` has no discard confirm if the user has changed times.** A user edits the call time, taps Cancel, the change is lost without warning.
      `ios/Wisconsin/Views/EventDetailSheet.swift:847-849`.
      Suggested fix: track the initial values, compare on Cancel, show a `confirmationDialog("Discard changes?", ...)` when there's a delta. Mirrors `EditBookingSheet` / `EditAssetSheet` / `ExtendBookingSheet`.

- [x] [Flows] **`EditShiftTimesSheet` has no haptic.** Save success and error fire haptics on the parent (`updateShiftTimes`), but the sheet itself dismisses with no tactile signal — and after my P1 fix above, the Save button can fire its own success haptic before the parent's redundant one.
      Suggested fix: drop the parent-handler haptic; let the sheet's awaited Save fire `Haptics.success()` on its way to dismiss, `Haptics.warning()` on a thrown error. Consistent with every other edit-sheet pattern shipped today.

- [x] [A11y] **My-shift indicator dot has no accessibility label.** A 7-pt accent-tinted dot at the right edge of the row signals "this is yours" visually; VoiceOver users hear nothing.
      `ios/Wisconsin/Views/EventDetailSheet.swift:644-648`.
      Suggested fix: `.accessibilityLabel("Your shift")` on the dot — paired with combining the row into a single VO element so the label flows into the row's announcement.

- [x] [A11y] **`ShiftRow` is not a combined accessibility element.** VoiceOver walks each piece (call time, end time, worker type pill, assigned person, status pill, my-shift dot) when a single combined "Call time {time}, {worker type}, {assigned person}" announcement is friendlier.
      `ios/Wisconsin/Views/EventDetailSheet.swift:614-655`.
      Suggested fix: `.accessibilityElement(children: .combine)` + explicit row label that puts the most important fact first.

- [x] [A11y] **Approve / Decline mini buttons in `assignedPersonView` have no explicit accessibility label.** Their text is "Approve" / "Decline" but VO doesn't know WHICH assignment they target without context.
      `ios/Wisconsin/Views/EventDetailSheet.swift:744-758`.
      Suggested fix: `.accessibilityLabel("Approve \(assignment.user.name)")` / `.accessibilityLabel("Decline \(assignment.user.name)")`. Mirrors the context-menu treatment.

- [x] [A11y] **Sport pill ("VFB" / "MBB" / etc.) has no accessibility label.** VO reads the abbreviation char-by-char; a fuller label like "Sport: Football" would be more useful, but for parity with how other pills work just announce the visible text.
      `ios/Wisconsin/Views/EventDetailSheet.swift:349-358`.
      Decision: **Skip.** Sport codes are intentionally short tokens; a wider lookup would conflict with other surfaces that don't have it.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Prep-gear flow swallows the new booking ID (`{ _ in }` callback) — after creating prep gear, the user has no way to navigate to the new booking. Requires multi-surface coordination (ScheduleView / HomeView pass a callback in via the sheet present site). Worth wiring once a "see what I just booked" UX gap is documented.
- [ ] [Polish] **Deferred.** Action-error alert title is generic ("Couldn't update shift") for all action types (request, approve, decline, delete, etc.). Per-type titles would be more specific but also more code; the body of the alert carries the actual server message which is the actionable part.
- [ ] [Polish] **Deferred.** Action-error alert is OK-only (no Retry path). Same shape of fix as create-booking shipped today, but the seven action handlers complicate which to retry. Skip until a documented friction point.
- [ ] [Polish] **Deferred.** Race-protection on rapid taps of Approve/Decline mini buttons. Server enforces idempotency; the second tap's API call returns 409 and surfaces. Acceptable.
- [ ] [Polish] **Deferred.** "Replace…" assign-someone flow needs to surface the current assignee for context — today the picker just shows the roster; the staffer has to remember who they're replacing.

## Acceptance criteria status

Per `AREA_SHIFTS.md` and the prior schedule audit:

- [x] AC: event header (sport, home/away, date, time, location, weather).
- [x] AC: per-area shift blocks with coverage pill.
- [x] AC: open-slot Assign/Request affordance respects role + worker type.
- [x] AC: pending-request approve/decline both in context menu AND inline.
- [x] AC: shift CRUD for STAFF (add, duplicate, edit times, delete).
- [x] AC: my-shift indicator visible.
- [x] AC: token discipline aligned with cross-app status taxonomy — **closed by P1 fix.**
- [x] AC: edit-times sheet feels like every other edit sheet — **closed by P1 fix.**
- [x] AC: VoiceOver users can navigate the row context — **closed by P1 a11y fixes.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web has same shape; aligned post-fix)
- [x] Accessibility
