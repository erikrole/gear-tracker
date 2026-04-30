# Audit: Dashboard / HomeView (iOS) — 2026-04-24

**MVP verdict:** READY — all P0 + P1 addressed (2026-04-24, pending Xcode build verification). Overdue-count consistency verified in source 2026-04-30: `HomeView.swift:105-106` renders `OverdueBanner(totalCount: dash.overdueCount, items: dash.overdueItems)`; banner header reads `totalCount` from the dashboard payload, list rows read from the truncated `items` array, and a `+ N more` footer appears at `:429-433` when `totalCount > items.count`. Stat strip and banner now agree.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

## P0 — blocks MVP
- [x] [Flows] Overdue banner count is wrong vs the stat strip — `ios/Wisconsin/Views/HomeView.swift:74-79, 256`
      Why it blocks ship: The banner is computed from `myCheckouts.items + teamCheckouts.items` filtered by `isOverdue`. Both lists are capped at 5 by the backend. So if 12 checkouts are overdue, the stat strip says "12 Overdue" while the banner header reads "2 Overdue Checkouts" — different numbers, same screen. Students/teachers will trust the visible list and miss escalation. The backend already returns `overdueItems` (top 5, with bookingId/title/requesterName/endsAt/etc.) but iOS doesn't decode or use it.
      Suggested fix: Add `overdueItems: [DashboardOverdueItem]` to `DashboardData` (mirror the web type) and render the banner from that list with the count from `dash.overdueCount`. Deletes the local filter at line 74 entirely.

## P1 — polish before ship
- [x] [Flows] Tab-back stale data — `ios/Wisconsin/Views/HomeView.swift:11-13, 143`
      Why: `HomeViewModel.load` early-returns when `hasLoaded == true && !forceRefresh`. The `.task` modifier fires on every view appearance, so leaving the Bookings tab and returning to Home re-fires `load()` which immediately bails. Student backgrounds the app for 20 minutes, swipes back to Home, sees yesterday's overdue count.
      Suggested fix: drop the `hasLoaded` guard (or replace with a 60s freshness check). `appState.refresh()` already runs on focus; HomeViewModel can mirror that or simply not gate.

- [x] [Flows] Refresh failures silently keep stale data — `HomeView.swift:43-69`
      Why: When a subsequent refresh fails, `vm.error` is set but `vm.dashboard` still holds prior data, so the error branch never renders and the user sees no indication of the failure. Web dashboard solved this via toast + persistent data. iOS shows nothing.
      Suggested fix: surface an inline failure pill near the title (or a toast via a small overlay) when `vm.error != nil && vm.dashboard != nil`.

- [x] [Flows] No empty/welcome state for a first-run student — `HomeView.swift:73-118`
      Why: When `dash` exists but every section list is empty (first-run student with zero checkouts/reservations/shifts), the user sees four "0" stat cells and nothing else — looks broken. Web has a Welcome Banner with onboarding links; iOS has nothing.
      Suggested fix: when all dash lists are empty, render a small `ContentUnavailableView`-style block: "You're all set" / "Open the Scan tab to check out gear." Student-friendly, points to next action.

- [x] [Hardening] `appState.refresh()` and `HomeViewModel.load()` both call the heavy `/api/dashboard` route independently — `ios/Wisconsin/Core/AppState.swift:21`, `HomeView.swift:17`
      Why: Cold launch fires `/api/dashboard` twice (AppState in WisconsinApp boot path + HomeView `.task`). Notifications sheet dismiss calls `appState.refresh()` which fetches the full payload again just to update `overdueCount` and `myShiftCount`. With the new web-side rate limit (30/min per user), a busy student tab won't hit it but it's wasteful, runs 10+ DB queries per refresh, and contributes to Vercel function time.
      Suggested fix: switch `appState.refresh()` to call `/api/dashboard/stats` (already returns `overdueCount` and now `role`) and add a separate small endpoint or expand `/api/dashboard/stats` to also return `myShiftCount`. Reserve the full `/api/dashboard` call for HomeView only.

## P2 — post-MVP
- [ ] [UI] No live tick — overdue labels (`overdueLabel`) only recompute on render, so a session left open shows increasingly-stale "Xh overdue" values until manual pull-to-refresh. Web ticks `now` every 60s.
- [ ] [UI] Hardcoded `Color.red` for overdue/error — web uses brand `var(--wi-red)`. Cosmetic parity gap.
- [ ] [UI] StatStrip cells use the same shadow stack as the cards — could feel "samey." Minor visual hierarchy nit.
- [x] [Flows] No role-adaptive UI: students see Team Checkouts / Team Reservations sections; web V3 hides the team column from students. AREA_MOBILE rule 3 explicitly grants students "broad read visibility" so this is allowed, but iOS-vs-web layout drifts. Decide intentionally.
- [ ] [UI] `ContentUnavailableView` error label is "Error" — could be "Couldn't load dashboard" with the underlying message in description.
- [ ] [Parity] iOS lacks: drafts section, my-reservations section (web shows it under My Gear), flagged items banner (staff/admin), lost bulk units card (admin), filter chips, overdue-banner inline Nudge / Check-in actions.
- [ ] [DEBUG] `#if DEBUG` Kiosk button on toolbar (`HomeView.swift:125-131`) is gated correctly, but worth mentioning so it's not accidentally turned on for TestFlight.

## Acceptance criteria status (from AREA_MOBILE.md + AREA_DASHBOARD.md V1)
- [x] Mobile is a first-class operational surface — Home is dedicated, not a desktop clone
- [x] Student flows: My check-outs, My reservations (partial — reservations not in iOS), due/overdue handling, scan — checkouts ✓, reservations missing on Home (only team reservations rendered)
- [x] Tap targets ≥ 44px — primary nav uses TabView (system-managed); rows wrap NavigationLink which gives a full row tap target. OK.
- [x] Scan reachable in one tap — yes via TabView tab item (AppTabView.swift:21)
- [x] Pull-to-refresh — `.refreshable` at line 142
- [ ] AC-2 (web): Overdue banner and overdue list counts consistent — **NOT MET on iOS**, see P0 #1
- [x] AC-7 (web): Refresh failures preserve visible data — partially met (data preserved, but no signal to user)
- [x] AC-10 (web): "Updated X ago" — N/A on iOS, swipe-down-to-refresh is the convention

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- docs/AREA_MOBILE.md
- docs/AREA_DASHBOARD.md (web)
- ios/Wisconsin/Views/HomeView.swift
- ios/Wisconsin/Views/AppTabView.swift (top half — tab + badging)
- ios/Wisconsin/Models/DashboardModels.swift
- ios/Wisconsin/Core/APIClient.swift (dashboard method)
- ios/Wisconsin/Core/AppState.swift

## Notes
- Static audit only — Xcode build/UI test verification is the user's responsibility.
- The P0 is the only thing that actually misleads; the rest are real but contained polish.
- iOS Home does NOT show `myReservations`, `drafts`, `flaggedItems`, `lostBulkUnits` — all P2 parity gaps. None block student golden path.
- Backend now returns `role` in both `/api/dashboard` and `/api/dashboard/stats` — iOS `DashboardData.role` is already declared and decoded but not used for any role-adaptive UI yet. Hook for future role-gating exists.
