# Audit: home / dashboard (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but every row component (BookingSummaryRow, DashboardShiftRow, EventSummaryRow, StatCell, DraftRow) is a multi-piece VoiceOver readout, and the four banner Labels leak SF Symbol icon names. Drift detector reports clean — these are per-row VO gaps the static checks can't catch.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `HomeView` + `HomeViewModel` + every dashboard sub-component (`StatStrip`, `StatCell`, `StatStripSkeleton`, `OverdueBanner`, `RefreshFailurePill`, `AllClearEmptyState`, `DashboardCard`, `BookingSummaryNavRow`, `BookingSummaryRow`, `DashboardShiftRow`, `EventSummaryRow`, `FlaggedItemsBanner`, `LostBulkUnitsBanner`, `DraftRow`) in `ios/Wisconsin/Views/HomeView.swift`. Focused follow-up to `audit-dashboard-ios.md` (2026-04-24, broad architectural audit) after today's pattern lock-in pass and the recent Awaiting-Pickup card slice.

**Surrounding context:** today's drift detector reports 0 violations on this file. Status tokens are correctly applied (red overdue, orange warning, green success, blue active, purple reservation). The `BookingSummaryRow` already uses `Color.statusText/.statusBackground` for the leading bar + initials circle. What's left is per-row VoiceOver consolidation.

## P0 — blocks MVP

_None._ Every row renders correctly. Stat tiles use `contentTransition(.numericText())` + `monospacedDigit()` per today's animated-counts pattern. `RefreshFailurePill` correctly surfaces server failure inline without blanking populated data. The "All Clear" empty state condition is explicit and correct (line 83-91).

## P1 — polish before ship

- [x] [A11y] **`BookingSummaryRow` not a combined accessibility element.** This is the highest-traffic row component on the dashboard — used by Awaiting Pickup, My Checkouts, Team Checkouts, Upcoming Reservations cards. VoiceOver walks initials circle, title, requester · location, due/pickup/overdue text, and item-count badge — up to five separate announcements per row.
      `ios/Wisconsin/Views/HomeView.swift:551-638`.
      Suggested fix: `.accessibilityElement(children: .combine)` + explicit row label that surfaces overdue / late state first when applicable: "Overdue: {title}, {requester}, {location}, {N items}, {endsAt label}." Mirrors today's BookingRow + kiosk row patterns.

- [x] [A11y] **`DashboardShiftRow` not combined.** My Upcoming Shifts uses this. VO walks date column, time, summary, area · location, gear label — four+ pieces.
      `ios/Wisconsin/Views/HomeView.swift:642-693`.
      Suggested fix: combine + explicit "{summary}, {area}, {location}, {date}, {time}, gear ready" (last clause when applicable).

- [x] [A11y] **`EventSummaryRow` not combined.** Upcoming Events uses this.
      `ios/Wisconsin/Views/HomeView.swift:697-760`.
      Suggested fix: combine + explicit "{title}, {sport}, {date}, {N of M crew filled}, Home/Away" with the home/away state and the coverage state surfaced semantically.

- [x] [A11y] **`StatCell` Button announces "0, Overdue, button"** — minor but inverts the user's mental model. Better: "Overdue: 0 items" or "5 overdue items." `monospacedDigit` text and label live as separate VO pieces today.
      `ios/Wisconsin/Views/HomeView.swift:326-360`.
      Suggested fix: `.accessibilityElement(children: .combine)` + explicit `.accessibilityLabel("\(label): \(value) item\(value == 1 ? "" : "s")")` so VO reads the metric NAME first, then the value.

- [x] [A11y] **`StatStripSkeleton` not VO-hidden.** Placeholder rectangles pollute VO with meaningless shapes during the initial dashboard load.
      `ios/Wisconsin/Views/HomeView.swift:363-377`.
      Suggested fix: `.accessibilityHidden(true)` on the outer HStack. Same shape as today's `BookingsView` skeleton fix.

- [x] [A11y] **Banner `Label("...", systemImage:)` headers leak icon names.** `OverdueBanner` ("exclamation triangle fill"), `RefreshFailurePill` (icon name), `FlaggedItemsBanner` ("flag fill"), `LostBulkUnitsBanner` ("exclamation triangle fill"), `AllClearEmptyState` ("checkmark seal fill") — all five banner-style components expose SF Symbol names to VO alongside the actual title.
      `ios/Wisconsin/Views/HomeView.swift:387, 439, 461-462, 769, 813`.
      Suggested fix: `.accessibilityHidden(true)` on each Image inside the Label; or replace the Label with explicit `accessibilityElement(children: .combine)` + explicit label on the outer banner.

- [x] [A11y] **`OverdueBanner` per-row NavigationLink not combined.** Three separate VO announcements per row (title, requester name, overdue label).
      `ios/Wisconsin/Views/HomeView.swift:392-415`.
      Suggested fix: combine + "{title}, {requester}, {overdue label}" with the overdue state surfaced as the first clause.

- [x] [A11y] **`DraftRow` leaks icons.** Leading `archivebox`/`calendar.badge.clock` icon AND trailing `chevron.right` both expose names.
      `ios/Wisconsin/Views/HomeView.swift:837-867`.
      Suggested fix: `.accessibilityHidden(true)` on both icons; combine the row + explicit "Draft: {title}, {N items}, updated {time}."

- [x] [A11y] **`FlaggedItemsBanner` per-row not combined.** Asset name + type · title + asset tag are three pieces per row.
      `ios/Wisconsin/Views/HomeView.swift:774-798`.
      Suggested fix: combine + explicit "Flagged: {asset name}, {type}, {booking title if any}, tag {asset tag}."

- [x] [A11y] **`AllClearEmptyState` icon leaks "checkmark seal fill".** Single combined element with the title "You're all set" + description suffices.
      `ios/Wisconsin/Views/HomeView.swift:458-475`.
      Suggested fix: combine outer VStack + hide the icon.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Per-stat-cell tap navigation could be more granular — today every cell routes to the bookings tab. Overdue → bookings + filter, Reserved → reservations tab, etc. would be useful but adds tab-state plumbing across HomeView and BookingsView. Skip until a documented friction case.
- [ ] [Polish] **Deferred.** "Updated Xs ago" stamp uses `formatted(.relative(presentation: .named))` which can read awkwardly ("in 0 seconds" right after refresh). Today's tradeoff: simple system formatter beats a custom one. Revisit if it becomes a live complaint.
- [ ] [Polish] **Deferred.** Banners auto-dismiss / can be swiped away. Today they re-render on every load. Acceptable.
- [ ] [Polish] **Deferred.** Drag-to-reorder dashboard cards. Power-user / personalization; not on the floor critical-path.

## Acceptance criteria status

Per `AREA_DASHBOARD.md` and the prior audit:

- [x] AC: stat strip + per-cell tap routing.
- [x] AC: overdue banner with role-gated visibility.
- [x] AC: flagged items + lost bulk units banners (STAFF / ADMIN).
- [x] AC: dashboard cards (My Checkouts, Team Checkouts, Reservations, Awaiting Pickup, My Shifts, Upcoming Events, Drafts).
- [x] AC: skeleton loading state.
- [x] AC: refresh-failure pill keeps populated data visible.
- [x] AC: pull-to-refresh + freshness window cache (60s).
- [x] AC: all status colors use cross-app token system.
- [x] AC: VoiceOver users hear each row as a combined element — **closed by P1 fixes.**
- [x] AC: skeleton state doesn't pollute VoiceOver — **closed by P1 fix.**
- [x] AC: banner Labels don't leak SF Symbol names to VO — **closed by P1 fixes.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening (handled by prior audit + drift detector; 0 violations today)
- [x] Parity (web has charts + drag-reorder; iOS skips per `feedback_ios_vs_web_role.md`)
- [x] Accessibility
