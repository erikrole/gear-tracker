# iOS Items List Improvement Audit
**Date**: 2026-04-30
**Target**: `ios/Wisconsin/Views/ItemsView.swift` (+ `Models/AssetModels.swift`, `Core/APIClient.swift`)
**Type**: Page

---

## What's Smart

- **Cancellation-aware loading** — `loadTask?.cancel()` (`ItemsView.swift:29`) ensures filter/search changes win over the previous request. The web only got this via React Query's built-in abort signal; iOS got it explicitly. Keep.
- **Search debounce via `Task.sleep` + `searchTask` cancel** (`ItemsView.swift:81–88`) — clean, idiomatic, no leaked timers. Worth replicating across other iOS list pages.
- **Optimistic favorite toggle with rollback on failure** (`ItemsView.swift:90–135`) — same pattern as web, well structured.
- **Page-level error vs initial error split** (`pageError` / `error`) — distinguishes "couldn't load anything" from "couldn't load the next page". Sibling iOS pages don't all do this.
- **`GearStore.seedAssets` warming** (`ItemsView.swift:60`) — first unfiltered page double-duties as a cache seed for the rest of the app.
- **44pt tap targets enforced via `frame(minWidth: 44, minHeight: 44)`** on every toolbar button. Apple HIG-compliant.
- **`sensoryFeedback(.selection, ...)`** on the favorites toggle — meets the iOS 26 native feel bar.

---

## What Doesn't Make Sense

- **`Asset` triple-rebuild** (`ItemsView.swift:90–135` before this PR) — three nearly-identical 10-line struct copies because Asset is fully `let`. Now consolidated via `Asset.withFavorited(...)` in `AssetModels.swift`.
- **Single-status filter** (`selectedStatus: AssetComputedStatus?`) when the web has multi-select — drift. **Now closed** (this PR converts to `Set<AssetComputedStatus>` and updates the menu).
- **No location / category / department / brand filters** — web has all four. iOS only filters by status + favorites. For "I'm at Camp Randall, what's available here", the user has to scroll the full list.
- **No multi-select bulk actions** — admin/staff can't retire/move/delete in bulk on iOS. Per AREA_ITEMS the V1 plan defers admin actions to web; that's intentional, but explicitly documenting it on the iOS audit prevents drift.
- **`if reset && offset == result.data.count && searchText.isEmpty && selectedStatus == nil && !favoritesOnly`** (`ItemsView.swift:59`) — fragile heuristic for "first unfiltered load". Should be a simple `private var hasSeeded = false` flag flipped after the first successful unfiltered fetch.
- **`error.localizedDescription` straight to UI** (lines 66, 68) — Swift errors often surface raw JSON-decoder garbage ("The data couldn't be read because it isn't in the correct format"). Web has `parseErrorMessage`; iOS has nothing equivalent.
- **Reservation context-menu always present** — the "Reserve" menu item (`ItemsView.swift:187–191`) shows for retired items too. Should be gated on `computedStatus != .retired`.
- **`AssetListBadge` badge text picks `requesterName` only** when the booking exists; it says "Anna Smith" but doesn't say *what's about to happen* (return today? overdue?). **Now closed** — due-date sub-label added.

---

## What Can Be Simplified

- **`searchTask` and `loadTask` are tracked separately** with different cancel paths. Single state machine would be tighter.
- **The 3 favorite-update blocks** were 30+ lines for a one-field mutation. **Now a single `applyFavorite` helper** invoking `Asset.withFavorited`.
- **`AssetStatusFilterMenu` previously hardcoded `[nil, .available, .checkedOut, ...]`**. Multi-status filter is now an explicit set-toggle pattern.
- **`AssetStatusBadge` (line 368) and `AssetListBadge` (line 303)** define the same color mapping twice. Extract a `Color.forStatus(_)` (or `AssetComputedStatus.color`) helper.

---

## What Can Be Rethought

- **A real filter sheet** (status / location / category / favorites / accessories on/off) on iOS — the toolbar status menu doesn't scale. SwiftUI `Form` inside a `.presentationDetents([.medium, .large])` sheet is the iOS-native answer.
- **Status breakdown header chip-strip** — `LazyHStack` of `(count, label)` chips for Available / Out / Reserved / Maintenance, tap to filter. Mirrors web's summary bar and gives the "what shape is the inventory in" answer at a glance.
- **Pull-down `.searchable(scopes:)`** — replace the current single-field search with native iOS scope bars (All / Available / Mine).
- **Server-driven sort** — iOS currently just shows whatever the server returns. Add a sort menu (Most-recent / Brand / Category / Tag) like web has.
- **Bulk inventory** — currently absent from iOS list. Either explicitly out of scope or surface in a separate tab.

---

## Consistency & Fit

### Pattern Drift
- **Status filter shape** — web is multi-select; iOS was single. **Closed.**
- **Due-date display** — web shows `due Xd` / `Xd overdue` on the badge (web slice 2). iOS now matches.
- **Error messaging** — web has `parseErrorMessage` mapping HTTP/network failures to friendly copy. iOS does `error.localizedDescription`. Worth a tight `iOSErrorMessage(error)` helper.

### Dead Code
- `AssetStatusBadge` (`ItemsView.swift:368`) is defined but unused inside `ItemsView.swift` after introducing `AssetListBadge`. Verify no external consumers (`ItemDetailView`?) before deleting.
- The `selectedStatus: AssetComputedStatus?` API parameter on `APIClient.assets(...)` is now dead — replaced by `statuses: Set<AssetComputedStatus>`. Closed.

### Ripple Map
- **`APIClient.assets(...)` signature** changed `status:` → `statuses:`. Affected call sites updated: `ItemsView.swift`, `CreateBookingSheet.swift`. Other callers (`SearchService.swift`, `LinkStickerWizard.swift`) didn't pass `status`, unchanged.
- **`Asset` model** gained `withFavorited(_:)`. Pure addition; nothing breaks.

### Navigation Integrity
- `NavigationStack` with `BookingRouteId` + `Asset` destinations both registered. ✅
- No broken links; `ItemDetailView(assetId:)` is the canonical destination.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | Three branches: error / favorites-only / no-search-match. Distinct copy and icon. |
| Skeleton fidelity | ✅ | `ItemRowSkeleton` × 10 with `allowsHitTesting(false)`. |
| Silent mutations | ⚠️ | Favorite toggle has haptic only; on failure it just reverts without telling the user. A toast/banner for failure ("Couldn't update favorite") would be more honest. |
| Confirmation quality | n/a | No destructive iOS actions today. |
| Touch targets | ✅ | 44×44 enforced on toolbar buttons. |
| Error message quality | ⚠️ | `error.localizedDescription` raw to UI. |
| Loading states | ✅ | `ProgressView` page-loader; pull-to-refresh; in-flight load cancels on filter change. |
| Role gating | n/a | Reservation context-menu visible to all. iOS is student-first; admin actions deferred. |
| Performance | ✅ | 30-row pages, infinite scroll, search-cancel — fine on Neon serverless. |
| Debug cleanup | ✅ | No `print`/`fputs`/`TODO` in items code. |
| Accessibility | ⚠️ | Toolbar has labels; rows do not have `accessibilityHint("Double-tap to view details")`. VoiceOver users only hear the asset tag. |

---

## Raise the Bar

iOS does several things web could borrow:

- **Explicit task cancellation on filter change** (`loadTask?.cancel()`) — web's React Query handles this implicitly, but the iOS code makes the intent explicit and easier to audit.
- **`searchable` + scope-bar groundwork** — already wired into `NavigationStack`, just needs scopes added.
- **44pt-enforced controls** — web toolbar has dense `h-9` buttons that fail mobile-touch heuristics; pattern from iOS could inform a `size="lg"` variant.

---

## Quick Wins (Shipped this slice)

- **`Asset.withFavorited(_:)` helper** — collapses 30 lines of struct rebuilds to a one-liner. (`AssetModels.swift`)
- **`applyFavorite(assetId:value:)` private helper** — three call sites collapse to three lines. (`ItemsView.swift`)
- **Multi-status filter** — `selectedStatus: AssetComputedStatus?` → `selectedStatuses: Set<AssetComputedStatus>`; menu now toggles per-status with checkmarks; "All" resets. APIClient signature updated to `statuses: Set<AssetComputedStatus>`. (`ItemsView.swift`, `APIClient.swift`, `CreateBookingSheet.swift`)
- **Due-date sub-label on CHECKED_OUT badge** — `due Xd` / `Xd overdue` derived from `activeBooking.endsAt`. Overdue rows turn red. (`ItemsView.swift`)

## Quick Wins (Still on the list)

- **Toast/banner on favorite-toggle failure** (currently silent revert).
- **`accessibilityHint("Double-tap to view details")`** on rows.
- **`computedStatus != .retired`** gate on the Reserve context-menu button.
- **Replace `if reset && offset == ...`** seed-detection heuristic with an explicit `hasSeeded` flag.
- **`AssetStatusBadge` dedup** — single `Color.forStatus` source of truth shared with `AssetListBadge`.

## Bigger Bets

- **Filter sheet** with location / category / department + multi-status + favorites, presented via `.sheet(detents:)`. Adds parity with web filters.
- **Status breakdown chip strip** above the list (Available / Out / Reserved / Maintenance), tap to filter.
- **Sort menu** mirroring web's sort options.
- **Friendly error mapping helper** (URLError vs DecodingError vs HTTP status) replacing `error.localizedDescription`.
