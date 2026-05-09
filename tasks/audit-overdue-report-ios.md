# Audit: overdue report (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the summary row + booking rows aren't combined VoiceOver elements, decorative icons leak names, and toggling a leaderboard row is silent (no haptic).
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `OverdueReportView` + `OverdueReportViewModel` in `ios/Wisconsin/Views/OverdueReportView.swift`. Slice 2 (2026-05-07) shipped this surface as the Profile → Overdue Bookings destination for STAFF/ADMIN; today's audit is the focused follow-up.

**Surrounding context:** STAFF/ADMIN-only accountability surface ("who has gear overdue, and for how long"). Reachable from `ProfileView` → Overdue Bookings stat. 60-second revalidation cache. Stale-on-failure semantics keep last data visible. Web equivalent has a recharts chart + CSV export; iOS intentionally skipped those (power-user info per `feedback_ios_vs_web_role.md`).

## P0 — blocks MVP

_None._ The flow works. Server returns the leaderboard sorted by total overdue time. Empty state ("Everything is back on time") + error state with Retry both render correctly. Pull-to-refresh forces a fresh load. The leaderboard row is already a combined accessibility element with an expand/collapse hint (slice 2 work).

## P1 — polish before ship

- [x] [A11y] **`bookingRow` (the per-booking nested rows under an expanded leaderboard entry) is not a combined accessibility element.** VoiceOver walks title, overdue duration, and the secondary line (location, items) separately. A combined "{title}, overdue {duration}, {location}, {items}" announcement matches the patterns shipped across kiosk + booking-detail surfaces today.
      `ios/Wisconsin/Views/OverdueReportView.swift:158-176`.
      Suggested fix: `.accessibilityElement(children: .combine)` + an explicit row label that surfaces the most critical fact first ("Overdue {duration}: {title}, {location}").

- [x] [A11y] **`summaryRow` is not combined either.** Two metric blocks (Overdue count + People count) get read piece-by-piece; the trailing `exclamationmark.circle.fill` icon adds noise.
      `ios/Wisconsin/Views/OverdueReportView.swift:101-112`.
      Suggested fix: `.accessibilityElement(children: .combine)` on the row HStack + explicit label "{N} overdue checkouts across {M} {person/people}". The decorative trailing icon picks up `.accessibilityHidden(true)`.

- [x] [A11y] **Decorative chevrons in `leaderboardRow` are read by VoiceOver inside the combined element.** The `chevron.up`/`chevron.down` icon is already inside the `.accessibilityElement(children: .combine)` wrapper, but its name still bleeds into the combined announcement when SwiftUI's a11y inference fails. Explicit hide is safer.
      `ios/Wisconsin/Views/OverdueReportView.swift:146-148`.
      Suggested fix: `.accessibilityHidden(true)` on the chevron Image. The combined row's `accessibilityHint` already conveys the expand/collapse semantic.

- [x] [Flows] **No haptic on leaderboard row tap.** Floor staff expanding rows to inspect bookings — one-tap toggles silently. `Haptics.selection()` is the canonical iOS pattern for accordion-style state changes.
      `ios/Wisconsin/Views/OverdueReportView.swift:127-156, 189-195`.
      Suggested fix: fire `Haptics.selection()` inside `toggleExpand(_:)`. Mirrors today's notifications-sheet swipe-mark-read pattern.

- [x] [UI polish] **`bookingRow` NavigationLink wraps the row but the row's `secondaryLine` can wrap to 2 lines without explicit `.lineLimit(2)`.** Already has `.lineLimit(2)` ✓ — actually fine. Skip.
      Decision: **No-op.** Re-reading line 173 confirms `.lineLimit(2)` is set.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Per-row "Send reminder" / "Mark contacted" affordance. Web likely has email-overdue functionality; iOS could expose a `mailto:` link or in-app message kick-off. Out of scope for the read-only floor lookup; defer until requested.
- [ ] [Polish] **Deferred.** Sort options (by oldest overdue, by item count, by location). Today only one sort: total overdue time. The leaderboard cardinality is small enough that scanning serves; sort UI adds complexity without clear ROI.
- [ ] [Polish] **Deferred.** "X minutes since last refresh" stamp. The 60-s cache + pull-to-refresh covers freshness; explicit timestamp would be visual noise.
- [ ] [Polish] **Deferred.** Charts / CSV export. Per slice 2 explicit decision — power-user info stays on web.

## Acceptance criteria status

Per `AREA_REPORTS.md` and slice 2:

- [x] AC: STAFF/ADMIN can reach the overdue report from Profile.
- [x] AC: leaderboard sorted by total overdue time.
- [x] AC: per-person expandable booking list.
- [x] AC: tap a booking → BookingDetailView.
- [x] AC: empty state when nothing overdue.
- [x] AC: pull-to-refresh + 60-s revalidation cache.
- [x] AC: stale-on-failure (data stays visible if refresh fails).
- [x] AC: combined VoiceOver elements on summary + booking rows — **closed by P1 fixes.**
- [x] AC: haptic on leaderboard row toggle — **closed by P1 fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (chart + CSV export intentionally web-only per slice 2)
- [x] Accessibility
