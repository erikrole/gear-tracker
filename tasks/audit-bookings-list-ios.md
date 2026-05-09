# Audit: bookings list (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but `BookingRow` isn't a combined VoiceOver element, the due-date label leaks the `exclamationmark.circle.fill` / `clock` icon names to VO, and the skeleton-loading state isn't accessibility-hidden.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `BookingsView` + `BookingsViewModel` + `BookingRow` + `StatusBadge` in `ios/Wisconsin/Views/BookingsView.swift`. Focused follow-up to `audit-bookings-ios.md` (2026-04-24, broad architectural audit) after today's pattern lock-in pass.

**Surrounding context:** today's drift detector reports 0 violations across all 45 swift files including this view. The 2026-04-24 audit already closed the load-task cancellation race, role/ownership gates on the toolbar `+`, pageError surfacing, "Mine" toggle, freshness stamp, GearStore cache seed/read, and CancellationError handling. What's left is per-row VoiceOver polish.

## P0 — blocks MVP

_None._ Cancellation guards correct (lines 30-39, 66, 75-76). Status tokens correct (line 212 mine-toggle uses `Color.statusText(.blue)`; line 291 overdue uses `Color.statusText(.red)`; `StatusBadge` routes to `StatusPill` via `tone: StatusTone`). Pull-to-refresh + pagination + cache + retry-page all wired. Skeleton + error + empty + populated states all render.

## P1 — polish before ship

- [x] [A11y] **`BookingRow` not a combined accessibility element.** VoiceOver walks each piece (title, status badge, requester · location, due-date Label) — four separate announcements per row. Combined into a single "{title}, {requester}, {location}, {status}, {due date}" announcement matches today's row-pattern across kiosk + booking-detail + item-detail surfaces.
      `ios/Wisconsin/Views/BookingsView.swift:259-300`.
      Suggested fix: `.accessibilityElement(children: .combine)` on the outer VStack + an explicit row label that puts the most relevant fact first ("Overdue: {title}, …" when applicable).

- [x] [A11y] **Due-date `Label` exposes icon name to VoiceOver.** The Label uses `Image(systemName: "exclamationmark.circle.fill" / "clock")` for its icon; VO reads the icon name alongside the date ("exclamation mark circle fill, Sep 11 9:00 AM"). Same family of fix shipped today across booking detail, item detail, etc.
      `ios/Wisconsin/Views/BookingsView.swift:283-296`.
      Suggested fix: `.accessibilityHidden(true)` on the icon (the combined row label above carries the overdue state); OR explicit `.accessibilityLabel(...)` on the Label that omits the icon name. The combined-row approach is simpler.

- [x] [A11y] **Skeleton-loading state isn't accessibility-hidden.** When the list is empty + loading, eight `BookingRowSkeleton` rows render. They're `.allowsHitTesting(false)` for tap blocking, but VoiceOver still announces them ("placeholder, placeholder, …") which is meaningless.
      `ios/Wisconsin/Views/BookingsView.swift:148-155`.
      Suggested fix: wrap the skeleton List in `.accessibilityHidden(true)` (the parent `Group` already conditionally renders this branch; hiding for VO complements the visual placeholder semantic).

- [x] [Polish] **Empty-state copy doesn't differentiate "Reservations vs Checkouts" cleanly when Mine is on.** When mineOnly + no results, the title says "No Reservations" / "No Checkouts" but the description "Nothing checked out or reserved by you." is a single sentence regardless of tab. Minor.
      `ios/Wisconsin/Views/BookingsView.swift:120-132`.
      Decision: **Skip with rationale.** The current copy is fine — students reading "No Checkouts" + "Nothing checked out or reserved by you." understand the scope. Tightening to "Nothing reserved by you yet." for the reservations tab would be marginally better but it's a copy preference, not a correctness fix.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Tab Picker has a generic accessibility label "Tab" (line 226). VO announces "Tab, Reservations, segmented control" — adequate but `.accessibilityLabel("Booking type")` would be clearer. Skip — segmented controls handle their own labeling reasonably.
- [ ] [Polish] **Deferred.** No haptic on tab change (Reservations ↔ Checkouts via segmented Picker). Picker self-handles its press feedback; an explicit `.sensoryFeedback` would be redundant. Skip.
- [ ] [Polish] **Deferred.** Stale `currentUserId` if session changes mid-session (e.g. logout + new login without app restart). Edge case; the `task` only fires on first appear. Reload happens via `RootView`'s session-driven view swap so this isn't reachable in practice.
- [ ] [Polish] **Deferred.** Status filter beyond just-active (web shows all statuses with a filter). Per `feedback_ios_vs_web_role.md` — power-user filtering stays on web. Skip.

## Acceptance criteria status

Per `AREA_BOOKINGS.md` and the prior audit:

- [x] AC: Reservations / Checkouts tab pick.
- [x] AC: search bar.
- [x] AC: pagination with retry on page error.
- [x] AC: pull-to-refresh.
- [x] AC: skeleton loading state.
- [x] AC: empty / error / populated states.
- [x] AC: Mine toggle.
- [x] AC: freshness stamp (slice 142).
- [x] AC: status pills via cross-app token system.
- [x] AC: VoiceOver users hear each row as a combined element — **closed by P1 fix.**
- [x] AC: skeleton rows don't pollute VoiceOver — **closed by P1 fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening (handled by prior audit; 0 drift today)
- [x] Parity (status filters intentionally web-only)
- [x] Accessibility
