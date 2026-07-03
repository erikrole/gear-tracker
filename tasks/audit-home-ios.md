# Audit: Home / Dashboard (iOS) — 2026-07-02

**MVP verdict:** NOT READY — 0 P0, 4 P1
**Fix pass:** all four P1s shipped 2026-07-02 (same day); see change log in `docs/AREA_MOBILE.md`. 2026-07-03 simulator follow-up fixed the duplicated Home hero accessibility label. P2s remain open.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

Follow-up to the 2026-05-08 audit (all its VoiceOver P1s shipped; that file's
component list is now stale — the card grid was replaced by `HomeActionQueue`).
This pass focuses on flow correctness and routing now that BookingsView has
Mine/All/Attention scopes.

## P0 — blocks MVP

_None._ No crash paths, no force-unwraps on nullable data, every async surface
has loading/empty/error states, role gating (staff section, admin-only lost
bulk units) is correct, logging is count-only (no PII).

## P1 — polish before ship

- [x] [Flows] **"Next Up" can render as an empty card.** `HomeActionQueue.hasActions`
      counts any active checkout (`!dash.myCheckouts.items.isEmpty`) —
      `ios/Wisconsin/Views/HomeView.swift:566-575` — but the body only renders
      rows for overdue, due-today, my pickups, my reservations, and event work
      (`:581-633`). A student whose only booking is a checkout due later in the
      week gets a header-only empty card, and the All Clear state is suppressed.
      Why it blocks ship: a visibly broken/empty primary card on the highest-traffic screen.
      Suggested fix: render upcoming (not-due-today) checkouts as neutral-tone
      rows ("Due Friday at 5:00 PM · Return on time"), so the queue is complete
      and `hasActions` matches what renders.

- [x] [Flows] **Drafts card is a dead end.** `DraftRow` draws a trailing chevron
      but has no tap action (`HomeView.swift:1065-1099`), and the card's
      "See all" routes to the Bookings tab (`:190`), which lists only active
      checkouts/reservations — drafts never appear there.
      Why it blocks ship: an affordance that promises navigation and does nothing.
      Suggested fix: wire row tap to `BookingDetailView(bookingId: draft.id)` if
      detail renders DRAFT status cleanly (verify), else remove the chevron and
      the See-all.

- [x] [Flows] **Overdue / Due Today stat tiles route through dead plumbing to the
      wrong scope.** `openCheckouts` sets `appState.pendingBookingsTab = "Checkouts"`
      (`HomeView.swift:147-150`), which `BookingsView.consumePendingTab` now
      discards (`BookingsView.swift:313-314`) — the user lands on the default
      All list and has to find the urgent work themselves. The Attention scope
      and overdue/due-today filters now exist.
      Why it blocks ship: AC-1 ("act on overdue within two taps") is weakened;
      the tap lands somewhere that doesn't answer the number just tapped.
      Suggested fix: replace `pendingBookingsTab` with a `pendingBookingsScope`
      hint; Overdue/Due Today tiles land on scope `.needsAttention`.

- [x] [UI polish] **"See all" tap target is far under 44pt.** caption2 text +
      8pt chevron with no frame minimum (`HomeView.swift:946-959`). Its only
      current use is the Drafts card.
      Suggested fix: `.frame(minHeight: 44)` + `.contentShape(Rectangle())`,
      or removed entirely with the Drafts dead-end fix.

## P2 — post-MVP

- [x] [Accessibility] **Simulator snapshot exposed the Home hero twice.** The
      visual header was correct, but the accessibility tree included a combined
      `Good evening, Erik` node plus separate `Good evening,` and `Erik` text
      nodes. `DashboardHero` now ignores child text for accessibility and
      exposes one label containing the visible date plus greeting.
- [ ] [Polish] "Synced in 0 seconds" right after refresh — `.relative(presentation:
      .named)` (`HomeView.swift:388-399`). Add a "just now" branch under ~10s.
- [ ] [Polish] "You're all set" can render directly above a staff Drafts card:
      `isAllEmpty` ignores `drafts` (`HomeView.swift:116-130`, `:160`).
      Contradictory mood; tighten the condition.
- [ ] [Gaps] Stat tiles are team-wide numbers (`stats.overdue` = `totalOverdue`,
      `src/app/api/dashboard/route.ts:543-547`) sitting above an all-personal
      queue, with no visual cue. The Attention-scope routing fix resolves most
      of the confusion; consider student-scoped tiles later.
- [ ] [Perf] `/api/dashboard?scope=ios-home` still ships `teamCheckouts`,
      `teamReservations`, `upcomingEvents`, `overdueItems` that iOS barely uses,
      and `DashboardData.init` decodes them non-optionally
      (`DashboardModels.swift:221-238`) — payload trim opportunity, but the
      decoder must become tolerant (`decodeIfPresent`) before the server trims.
- [ ] [Polish] Next Up groups cap at `prefix(3)` silently (`HomeView.swift:582-631`);
      no "+N more" affordance.
- [ ] [Polish] `TradeBoardSheet(myShifts: [], ...)` from Home (`HomeView.swift:292-298`)
      gives the trades sheet no shift context when opened via a notification.

## Acceptance criteria status (AREA_MOBILE.md)

- [x] AC-1: overdue actionable in two taps — via queue rows; tile routing weakens it (P1 #3)
- [x] AC-3: overdue red everywhere — StatCard .red tone, queue rows .red rail
- [x] AC-5: role gating — staff section behind `dash.isStaff`, lost bulk behind `isAdmin`
- [x] AC-6: chart-light, action-first — no chart widgets; queue is the centerpiece
- [x] "Dashboard on Mobile" contract: overdue, due-today, pickups, reservations,
      shift priorities all present; scan lives in Search per contract

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening (count-only os_log, no force-unwraps, freshness window guards)
- [x] Breaking (refresh failure keeps data + pill; skeleton VO-hidden; retry paths present)
- [x] Parity (informational: web keeps charts/team cards; iOS action queue per `feedback_ios_vs_web_role`)

## Files read
- ios/Wisconsin/Views/HomeView.swift (full)
- ios/Wisconsin/Models/DashboardModels.swift (full)
- ios/Wisconsin/Core/APIClient.swift (dashboard endpoints)
- ios/Wisconsin/App/WisconsinApp.swift (lifecycle entry)
- ios/Wisconsin/App/AppDelegate.swift (push routing)
- ios/Wisconsin/Views/AppTabView.swift (tab tags and shell order)
- ios/Wisconsin/Views/BookingsView.swift (full, earlier this session — scope plumbing)
- docs/AREA_MOBILE.md (contract + ACs; change log skimmed)
- docs/AREA_DASHBOARD.md (Home/dashboard scope + change log)
- docs/DESIGN_LANGUAGE.md (accessibility baseline)
- docs/GAPS_AND_RISKS.md (iOS entries, grep pass)
- src/app/api/dashboard/route.ts (scope param + stats semantics, targeted)
- tasks/audit-home-ios.md (2026-05-08 predecessor)

## Notes
- WisconsinApp/AppDelegate lifecycle not re-read this pass; covered by the
  2026-04-24 broad audit and untouched since per git log. No findings cited from them.
- Static audit only; no simulator/UI-test verification.
