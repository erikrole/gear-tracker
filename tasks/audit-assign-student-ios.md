# Audit: assign student (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the highlighted-area badge code is dead (call site always passes `primaryArea: nil`), the row ignores `avatarUrl`, the failure haptic uses `.error()` instead of `.warning()`, and the row isn't a combined VoiceOver element.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `AssignStudentSheet` + `AssignRow` in `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift`. STAFF/ADMIN-only — reachable from `EventDetailSheet`'s open-slot Assign affordance and the row-level "Replace…" / "Assign someone" context-menu items.

**Surrounding context:** today's previous passes already wired the title-case area label in this sheet's navigation title ("Assign Video"). Loading state, empty state, and load-failure recovery already ship. The row Button wrapper exists ✓; what's missing is the data and the combined a11y.

## P0 — blocks MVP

_None._ The flow is correct. Auth handled. Inflight assignment correctly disables all rows + shows a per-row spinner. Cancel + dismiss work.

## P1 — polish before ship

- [x] [Gaps] **Highlighted-area badge code is dead.** `AssignRow` accepts `primaryArea: String?` and renders a tinted capsule when `primaryArea == highlightArea` — but the call site passes `primaryArea: nil` (line 49), so the badge never appears. The intent is real and useful: when assigning to a "Video" shift, a student whose `primaryArea == "VIDEO"` should be visually surfaced as a strong fit.
      `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift:49, 124-136`.
      Suggested fix: pass `primaryArea: user.primaryArea` from the call site. Render the badge text via `.shiftAreaLabel` (today's helper) so "VIDEO" displays as "Video". Match-state visual treatment stays as the existing `Color.accentColor.opacity(0.18)` / `.secondary` logic.

- [x] [Gaps] **`AppUser.avatarUrl` discarded — initials only.** Same drift the kiosk + user-detail surfaces had until today's passes. Staffer assigning a student would benefit from the photo (faster face-to-name recognition).
      `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift:115, 149-157`.
      Suggested fix: `AsyncImage(url:)` with the existing initials disc as the placeholder/failure state. Match the `UserAvatarSmall` pattern shipped on the Users list row.

- [x] [Hardening] **`Haptics.error()` instead of `.warning()` on failure.** Cross-app convention for non-fatal form-save failures is `.warning()`; `.error()` is reserved for fatal/blocking conditions. Same outlier pattern fixed today on `AddShiftSheet`.
      `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift:101`.
      Suggested fix: `Haptics.warning()` to align.

- [x] [A11y] **`AssignRow` not a combined accessibility element.** VoiceOver walks initials circle + name + email + area badge + chevron-or-spinner — five separate announcements per row. Combine into "Erik Mason, role@wisc.edu, Video specialist" matching today's row patterns.
      `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift:113-147`.
      Suggested fix: `.accessibilityElement(children: .combine)` + an explicit row label that names the user, email, and (when set) primary-area match state. Decorative initials circle, area capsule, chevron, and spinner all pick up `.accessibilityHidden(true)` so the combined label carries the meaning. Email row should remain readable but not character-by-character (combining handles this — VO reads the whole label as one phrase).

- [x] [UI polish] **Primary-area badge text is raw enum code.** Once wired (P1 #1), "VIDEO" should display as "Video" via `.shiftAreaLabel` so the badge speaks the same language as the rest of the app post today's title-case pass.
      Already incorporated into the wiring fix above.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Filter list by `sportCode` when present (use `sportRoster` API). The shift's sportCode is passed in (`event.sportCode` from EventDetailSheet:141) but the iOS view loads all users via `users(search: nil, limit: 200)`. Web likely narrows to the sport's roster when applicable. For a small school the all-users path is fine; defer until roster cardinality justifies the complexity.
- [ ] [Polish] **Deferred.** Pagination beyond 200 users. Same disposition.
- [ ] [Polish] **Deferred.** Sort by primary-area match (matches first, then alphabetical). After P1 wires the badge, manually scanning is easier; sort polish can come later.
- [ ] [Hardening] **Deferred.** `assignError` alert with Retry action. Today's retry path is "tap the same row again" — one tap, low cost. `confirmationDialog` with Retry would re-trigger `assign(userId:)` for the previously-tapped user, which adds little over re-tapping. Skip.

## Acceptance criteria status

Per `AREA_SHIFTS.md`:

- [x] AC: STAFF/ADMIN can pick any user and direct-assign them to an open shift.
- [x] AC: search by name.
- [x] AC: per-row inline spinner during assign.
- [x] AC: server error surfaces with humanized message.
- [x] AC: success haptic via centralized `Haptics` enum.
- [x] AC: primary-area highlight visible — **closed by P1 wiring fix.**
- [x] AC: avatar image when available — **closed by P1 fix.**
- [x] AC: failure haptic follows cross-app convention — **closed by P1 fix.**
- [x] AC: VoiceOver users hear each row as a combined element — **closed by P1 a11y fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (sport-roster filter deferred to P2)
- [x] Accessibility
