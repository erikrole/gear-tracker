# iOS Dashboard/Home Audit
**Date**: 2026-04-28
**Target**: HomeView.swift, ScheduleView.swift, DashboardModels.swift, ScheduleModels.swift
**Type**: iOS Views (SwiftUI)
**Comparison**: Web dashboard (Next.js)

---

## Current State

### HomeView.swift
- **Loading**: 60-second freshness window; skips reload if recent
- **Skeleton**: StatStripSkeleton + BookingRowSkeleton × 7 while loading with no cache
- **Error**: ContentUnavailableView with "Retry" when load fails with no data; non-blocking banner pill when refresh fails with data visible
- **Empty State**: `AllClearEmptyState()` when all lists empty → "You're all set" + next action hint
- **Pull-to-refresh**: `.refreshable()` with `forceRefresh: true`
- **Sections**: StatStrip, OverdueBanner, My Checkouts, Team Checkouts, Upcoming Reservations, Upcoming Events (6), My Shifts

### ScheduleView.swift
- **Loading**: 5-minute freshness; `async let` parallel fetch (events + shifts)
- **Skeleton**: EventRowSkeleton × 6 on first load
- **Error**: Blocking empty screen if no data; non-blocking banner if data visible
- **Empty States**: "No upcoming events" / "No shifts assigned to you" (contextual)
- **Features**: List + calendar view, "My shifts only" toggle, Home/Away filter, Trade board badge, Calendar subscribe, Weather badges

---

## Gaps vs Web Dashboard

| Feature | Web | iOS | Status |
|---------|-----|-----|--------|
| Stat Cards (4) | ✓ | ✓ | Complete |
| Overdue Banner | ✓ | ✓ | Complete |
| My Shifts | ✓ | ✓ | Complete |
| My Checkouts | ✓ | ✓ | Complete |
| Team Checkouts | ✓ | ✓ | Complete |
| Upcoming Reservations | ✓ | ✓ | Complete |
| Upcoming Events | ✓ | ✓ | Complete |
| **Role Gating (Staff)** | ✓ | ✗ | **MISSING** |
| **Drafts Section** | ✓ | ✗ | **MISSING** |
| **Flagged Items Banner** | ✓ | ✗ | **MISSING** |
| **Lost Bulk Units Card** | ✓ | ✗ | **MISSING** |
| Last refreshed timestamp | ✓ | ✗ | Missing |
| Live relative time tick | ✓ | ✗ | Missing |
| Calendar view | ✗ | ✓ | iOS only |
| Weather on events | ✗ | ✓ | iOS only |
| Trade board badge | ✗ | ✓ | iOS only |
| Calendar subscribe | ✗ | ✓ | iOS only |

### Staff Features Missing on iOS (Critical)
- **Flagged items banner**: Items marked damaged/lost not surfaced on iOS. Would need `flaggedItems: [FlaggedItem]` in `DashboardData`.
- **Lost bulk units card**: Inventory problem summary missing. Would need `lostBulkUnits: [LostBulkUnit]` in `DashboardData`.
- **Drafts section**: Staff creation drafts not shown. Would need `drafts: [BookingSummary]` in `DashboardData`.

---

## Error & Loading Quality

### What Works Well
- 401 handling centralized via NotificationCenter → `SessionStore` routes to LoginView cleanly
- Non-blocking refresh errors shown as banner, data stays visible (same pattern as web)
- Skeletons match layout reasonably (StatStrip + booking rows)
- Empty states include action hints ("Open Scan tab to check out gear")
- Pull-to-refresh on both tabs
- `@Observable` + `@MainActor` for thread-safety throughout

### Gaps
1. **Parallel request failure**: `ScheduleViewModel.load()` uses `async let` — if shifts fail, entire load fails even if events succeeded. No partial recovery.
2. **Raw error messages**: `error.localizedDescription` surfaces system noise like "NSURLErrorDomain error -1009" to users.
3. **No network reachability**: No distinction between "offline" and "server error" — same generic message either way.
4. **No stale data signal**: Schedule data can be up to 5 min old with no visual indicator.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | Contextual, with action hints |
| Skeleton fidelity | ✅ | Matches layout reasonably |
| Pull-to-refresh | ✅ | Both HomeView and ScheduleView |
| 401 handling | ✅ | Centralized, clean redirect to login |
| Non-blocking refresh errors | ✅ | Banner, data stays visible |
| Role gating | ❌ | No staff-only sections on iOS |
| Humanized error messages | ❌ | Raw `localizedDescription` shown |
| Partial failure recovery | ❌ | One bad request blanks the screen |
| Last refreshed timestamp | ⚠️ | Not shown |
| Stale data indicator | ⚠️ | No signal when data is aging |

---

## Quick Wins

1. **Add "Last Refreshed" timestamp to HomeView** (`HomeView.swift`) — show `vm.lastLoadedAt` as "Updated 2m ago" below stat strip. 5 min.

2. **Humanize error messages in APIClient** (`APIClient.swift`) — map NSURLError codes (-1009 → "No internet", -1001 → "Request timed out") before surfacing to UI. 10 min.

3. **Add stale data banner to ScheduleView** (`ScheduleView.swift`) — show subtle "Data may be outdated" indicator when `lastLoadedAt` is > 5 min ago and user is actively viewing. 10 min.

4. **Skeleton for overdue banner slot** (`HomeView.swift`) — add a faint placeholder row in the skeleton to hint at the overdue section before data loads, reducing layout shift. 8 min.

5. **Graceful partial failure in ScheduleView** (`ScheduleViewModel.swift`) — if events succeed but shifts fail (or vice versa), show what loaded + a non-blocking error banner instead of blanking the screen. 20 min.

---

## Bigger Gaps

1. **Role-based dashboard sections** (2h)
   - Extend `DashboardData` with `drafts`, `flaggedItems`, `lostBulkUnits`
   - Add role check in HomeView to conditionally render staff-only sections
   - Match web: Flagged Items Banner (red accent), Lost Bulk Units Card, Drafts list
   - **Impact**: Staff currently see a student-level dashboard on iOS — this is the biggest gap

2. **Network reachability + offline mode** (1h)
   - Wire existing `NetworkMonitor.swift` into HomeView/ScheduleView
   - Show offline banner when unreachable; skip network requests and show cached data
   - **Impact**: Graceful offline UX instead of generic error

---

## Recommendations (Priority Order)

| Priority | Task | Time |
|----------|------|------|
| P0 | Role-based sections (drafts, flagged, lost bulk) | 2h |
| P1 | Humanize error messages | 15m |
| P1 | Last refreshed timestamp | 5m |
| P2 | Graceful partial failures in ScheduleView | 30m |
| P2 | Stale data banner | 10m |
| P3 | Skeleton for overdue slot | 8m |
| P4 | Network reachability / offline mode | 1h |
