# Audit: schedule (iOS) — 2026-04-24

**MVP verdict (post-fix, pre-Xcode-verify):** all P0 + P1 addressed plus practical niceties (Today button, swipe gesture, dot legend, success toasts, presentation detents, freshness label, trade-board prominence, time-block compaction). Needs build verification.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

Scope: `ScheduleView` (List + Calendar modes) + `ScheduleCalendarView` + `ScheduleViewModel` + `EventDetailSheet` (sheet) + Schedule/`PostTradeSheet` + Schedule/`TradeBoardSheet`.

## P0 — blocks MVP

- [x] [Breaking] A refresh failure blanks the entire schedule. The `Group { … }` if/else puts `else if let err = vm.error` ABOVE the events branch, so any error after a successful first load replaces the list/calendar with "Couldn't load schedule" — even though `vm.events` still holds the previous payload.
      `ios/Wisconsin/Views/ScheduleView.swift:108-115` (error branch); `:54` clears the error on each new load attempt; `:67` writes the error.
      Why it blocks ship: pull-to-refresh on a flaky network turns the schedule screen into an error screen at exactly the moment a student needs to glance at their next shift. Tapping Retry recovers, but the visible disappearance is a confidence-destroying hiccup in front of a class.
      Suggested fix: only show the error placeholder when `vm.events.isEmpty`. When events exist, surface a non-blocking inline error toast/banner (or a single-line footer row) and keep rendering the list/calendar.

## P1 — polish before ship

- [x] [Flows] `ScheduleViewModel.load()` is gated by `hasLoaded`, so coming back to the Schedule tab never refreshes — events go stale until the user pulls to refresh or kills the app.
      `ios/Wisconsin/Views/ScheduleView.swift:46-47` (`guard !hasLoaded || forceRefresh else { return }`); `WisconsinApp.swift:32-36` only refreshes `appState.refreshUnread()` on scene reactivation, not the schedule.
      Why it matters: AREA_MOBILE.md performance section calls out "stale-data detection across browser tabs or after backgrounding" — closed on web via Page Visibility, missing on iOS for this screen specifically. A staffer pulling out their phone to check who's on tonight's shift sees yesterday's data.
      Suggested fix: trigger `vm.load(forceRefresh: true)` on `scenePhase == .active` (or via a `lastLoadedAt` staleness check inside `load`). Same hook as `appState.refreshUnread`.

- [x] [Flows] In Calendar mode, navigating prev/next month does not move `selectedDate`. The grid scrolls but the bottom day-list stays anchored on today's date — users see the right month but the wrong day's events.
      `ios/Wisconsin/Views/ScheduleView.swift:301-336` (chevrons mutate `displayedMonth` only) vs `:246-251` (`selectedDayEvents` reads from `selectedDate`).
      Why it matters: a student tapping forward to next week's home game still sees today's events and assumes there's nothing to see.
      Suggested fix: when changing `displayedMonth`, also clamp `selectedDate` to the first day of that month (or the same weekday-of-month if more useful). Update the day list copy at `:345` too.

- [x] [Flows] The "My Shifts" toggle on List mode silently empties the screen when the filtered groups are empty — no empty-state message.
      `ios/Wisconsin/Views/ScheduleView.swift:85-91` (`displayedGroups` returns `[]` when filter eats everything); `eventList` then renders an empty `List` with no copy.
      Why it matters: looks broken. Student toggles "My Shifts" expecting to see only their shifts, gets a blank screen, doesn't know if it's filtered out vs. broken.
      Suggested fix: in `eventList`, if `displayedGroups.isEmpty && myShiftsOnly`, render a `ContentUnavailableView("No shifts assigned to you", systemImage: "person")`.

- [x] [Flows] PostTradeSheet `Cancel` button stays enabled while `isPosting` is true; user can dismiss mid-`postShiftTrade` and orphan the request.
      `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift:53-55` (Cancel always enabled).
      Suggested fix: `.disabled(isPosting)` on Cancel; mirror the bookings/items pattern (`interactiveDismissDisabled` while posting; discard-changes confirm if `selectedShift != nil` or `notes.nonEmpty`).

- [x] [Flows] TradeBoard "My Active Posts" swipe-to-cancel destroys the post with no confirmation — one mis-swipe at the corner of the row throws away a posted shift.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:156-165`.
      Why it matters: Cancel is destructive (the post disappears, has to be re-created). Claim has a confirmation dialog; Cancel should match.
      Suggested fix: gate the swipe action behind a `confirmationDialog` showing the shift area + time and a "Cancel Trade" destructive button.

- [x] [UI polish] EventRow uses hardcoded `Color.black.opacity(0.04)` + `0.06` shadows — invisible in dark mode; cards lose their lift.
      `ios/Wisconsin/Views/ScheduleView.swift:564-565`.
      Suggested fix: `Color.primary.opacity(0.05-0.08)` or a `Color(.separator)` border (matches the FormCard / AssetThumbnail fixes already shipped this week).

- [x] [Hardening] `PostTradeSheet.eligibleShifts` filters by string-equal `status == "ACTIVE"` instead of using a typed enum.
      `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift:13-16`.
      Why it matters: any backend status rename silently empties the picker. The rest of the codebase uses Swift enums for booking/asset status.
      Suggested fix: introduce `enum MyShiftStatus: String, Codable { case active = "ACTIVE", … }` on the model and compare via `.active`.

## P2 — post-MVP

- [ ] [Parity] AREA_SHIFTS lists three view modes — List / Week / Calendar — iOS has only List + Calendar (no Week strip). Acceptable for V1.
- [ ] [Parity] My Hours stat strip (`GET /api/shifts/my-hours`) not on iOS. Useful for shift-totaling but not on the V1 student bar.
- [ ] [Parity] AREA_SHIFTS filter bar (Sport / Area / Coverage / Time / My Shifts) — iOS has only "My Shifts". Power-user surface.
- [ ] [Parity] ShiftDetailPanel (per-event admin assignment management) not on iOS — admin-only, web-first by design.
- [ ] [UI polish] Calendar prev/next month chevrons have no bounds; tapping forward past the last event date is a dead-end with no hint. Cosmetic.
- [ ] [UI polish] Toolbar Picker `.frame(width: 150)` — only 2 segments, fine on most devices, may clip on iPhone SE in landscape with all toolbar items.

## Acceptance criteria status

AREA_MOBILE.md:
- [x] AC-2 — schedule list supports search-equivalent (My Shifts toggle) + scope (mode picker) + row→detail.
- [ ] AC-3 — overdue-style red treatment isn't applicable here; not relevant to this screen.
- [x] AC-5 — Trade Board UI exposes Post + Claim + Cancel; server gates remain authoritative; no admin-only affordance leaks to STUDENT.

AREA_SHIFTS.md (iOS surface only):
- [x] Trade board: students post shifts for trade.
- [x] Trade claims: instant claim flow with confirmation.
- [x] Calendar view: month grid with coverage indicators (green/orange/secondary).
- [x] List view: grouped by date, "My Shifts" filter present.
- [x] Mobile: card layout + sheet-based event detail.
- [ ] Week view: not implemented on iOS (P2 parity).
- [ ] My Hours stat strip: not implemented on iOS (P2).
- [ ] Filter bar (Sport/Area/Coverage/Time): not implemented on iOS (P2).

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- `ios/Wisconsin/Views/ScheduleView.swift`
- `ios/Wisconsin/Views/Schedule/PostTradeSheet.swift`
- `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift`
- `ios/Wisconsin/App/WisconsinApp.swift` (scenePhase wiring)
- `docs/AREA_SHIFTS.md` (acceptance + IA)
- `docs/AREA_MOBILE.md` (no schedule-specific ACs beyond cross-cutting)

## Notes
- Static audit only.
- `EventDetailSheet` content was not opened in this pass; if you want it included, request a follow-up audit on it specifically.
- The error-shadowing P0 is the same shape as the bookings pagination-error fix already shipped — a `pageError`-style banner pattern would close it.
