# Dashboard Improvement Audit
**Date**: 2026-04-28
**Target**: src/app/(app)/page.tsx
**Type**: Page

---

## What's Smart

1. **Two-endpoint parallel data fetching** (`page.tsx:39-47`, `use-dashboard-data.ts:64-129`)
   - Heavy full payload (5-min TTL) and lightweight stats (60s TTL) run in parallel via `Promise.all`
   - Stats endpoint returns role, enabling early-render gating before full data loads — avoids staff-only button flash for students on warm cache
   - Overlay pattern merges fresh stats onto cached full payload, keeping counts current without re-querying expensive events/shifts/flagged data

2. **React Query integration for persistence and optimistic updates** (`use-dashboard-data.ts`, `page.tsx:94-95`)
   - `setData` preserves queryClient state for optimistic draft deletion (remove locally, rollback on failure)
   - Both endpoints use `queryKey` constants (`DASHBOARD_KEY`, `DASHBOARD_STATS_KEY`) to sync cache across page and hooks

3. **Comprehensive error classification** (`use-dashboard-data.ts:99-102`, `page.tsx:172-184`)
   - Differentiates auth (401 redirect), network (TypeError), and server errors distinctly
   - Only shows error screen on initial load with no cache; refresh failures toast and preserve visible data

4. **Ref guard pattern for mutation safety** (`page.tsx:78-112`)
   - `actionBusyRef` prevents double-click races on async handlers without blocking other UI updates
   - Replicated across `handleDeleteDraft`, `handleExtend`, `handleConvert` — consistent guards on all mutations

5. **Role-gated rendering with early role resolution** (`page.tsx:47, 193-194, 222, 324`)
   - Role sourced from full payload with fallback to cached stats — no flicker even on first load
   - `roleKnown` gate defers staff buttons until role is confirmed (prevents show-then-hide flash)

6. **URL-persisted filters with safety carve-out** (`use-dashboard-filters.ts:36-119`)
   - Sport and location filters sync to search params, survive navigation
   - Overdue banner intentionally unfiltered (safety-critical feature never hidden, per comment:102)
   - Pre-filtered views via `useMemo` prevent N+1 filtering — all views computed once per render

7. **Skeleton fidelity and two-load-state handling** (`page.tsx:189`, `use-dashboard-data.ts:107-129`)
   - Full skeleton only on true first load; on return visits with cache hit, stats show immediately
   - `DashboardSkeleton({ columnsOnly })` shows column structure while top section renders from cache
   - Skeleton rows vary widths (`dashboard-skeleton.tsx:19-22`) to match real layout

8. **Comprehensive 401 handling on all mutations** (`page.tsx:98, 133, 156`, `overdue-banner.tsx:37`)
   - Every fetch handler includes `handleAuthRedirect(res, "/")` — no inline `window.location.href` calls
   - Redirect happens before toast/state reset, preventing UI state pollution on logout

---

## What Doesn't Make Sense

1. **`myShiftsCount` in stats response is unused** (`dashboard-types.ts:18`, `stats/route.ts:77`)
   - API computes and returns `myShiftsCount` but page never reads or displays it
   - My Shifts section uses `data.myShifts.length` from full payload (`page.tsx:180`) instead
   - Dead field in the stats response — either remove it or use it for a count badge

2. **Live countdown ticks every 60s but stat cards stay frozen** (`page.tsx:71-75`, `use-dashboard-data.ts:83-87`)
   - `now` state updates every 60 seconds for relative time formatting
   - Stats TTL is also 60s but only on the first fetch, then falls back to 5-min full payload refresh
   - "Due today" countdown advances while the stat card count stays stale for up to 5 min

3. **Three separate state variables for mutation blocking** (`page.tsx:52, 78, 116`)
   - `actionBusyRef` (ref guard), `inlineActionId` (spinner on active item), `deletingDraftId` (mark item as deleting)
   - Inconsistent: some handlers check `actionBusyRef.current`, some check `inlineActionId !== null`
   - Page passes `acting={inlineActionId !== null || deletingDraftId !== null}` to subcomponents, ignoring `actionBusyRef`

4. **`isFirstRun` condition has an edge case** (`page.tsx:195-201`)
   - If `data === null` but `stats` exist, condition returns `false` immediately
   - Misses the "getting started" banner on first load when full data hasn't arrived yet but stats have

5. **BookingDetailsSheet dynamically imported but always mounted** (`page.tsx:8, 345-349`)
   - Imported with `{ ssr: false }` but `selectedBookingId` starts as `null` — sheet mounts immediately (just hidden)
   - Dynamic import doesn't defer initialization; sheet code runs on every dashboard load
   - Should conditionally render: `{selectedBookingId && <BookingDetailsSheet ... />}`

6. **Filter chips disappear when sport/location counts drop below threshold** (`filter-chips.tsx:97`)
   - Returns `null` when `availableSports.length <= 1 && availableLocations.length <= 1`
   - Active filter persists in URL but chip UI vanishes — confusing state
   - Should render filter chip even when no options are available

---

## What Can Be Simplified

1. **Merge three mutation-blocking mechanisms into single `acting` state**
   - Current: `actionBusyRef`, `inlineActionId`, `deletingDraftId` (three separate tracking vars)
   - Simpler: Single `acting: string | null` — id of item being acted on, `null` if idle
   - All handlers: `if (acting) return` at top, `setActing(id)` on start, `setActing(null)` in finally

2. **Extract role checks into computed vars at top of component**
   - Current: `data.role === "STAFF" || data.role === "ADMIN"` scattered across JSX
   - Simpler: `const isStaff = role === "STAFF" || role === "ADMIN"; const isAdmin = role === "ADMIN"`

3. **Move `now` tick into `useDashboardData` hook**
   - Current: Dashboard page manages `now` state and 60s interval separately from hook's stats refresh
   - Simpler: Hook manages both, returns `{ ..., now: Date }` — aligns countdown and stats TTLs

4. **Consolidate three banner components into parameterized `AlertBanner`**
   - Current: `OverdueBanner`, `FlaggedItemsBanner`, `LostBulkUnitsCard` all share duplicated styling
   - Simpler: `<AlertBanner title="..." type="overdue|flagged|lost" items={[...]} />`

5. **Use React Query's built-in `refetch` instead of custom `loadData()`**
   - Current: Custom refresh button with `loadData()` and manual `lastRefreshed` tracking
   - Simpler: Use `useQuery`'s `refetch` + `dataUpdatedAt` — already available from the hook

---

## What Can Be Rethought

1. **Split `/api/dashboard` into independent per-section queries**
   - Current: Single endpoint returns stats + checkouts + reservations + events + shifts + flags + drafts (7 concerns)
   - One slow nested query blocks the entire dashboard render
   - Better: `/api/dashboard/stats`, `/api/dashboard/checkouts`, `/api/dashboard/events`, etc. — each with own TTL and independent error boundary
   - Tradeoff: More API routes, partial loading UI required

2. **Move client-side filtering to backend query params**
   - Current: Loads all events/checkouts; page filters client-side
   - Better: `/api/dashboard?sport=MBB&location=Camp+Randall` returns pre-filtered data
   - Tradeoff: API change; mitigated by optional params defaulting to all results

3. **Role-differentiated API endpoints**
   - Current: Same response shape for all roles; page does visibility filtering
   - Better: Backend returns only what each role should see
   - Tradeoff: More endpoint variants or conditional query logic server-side

4. **Pagination per section instead of capping at 5**
   - Current: Sections show top 5 with "View all N →" link, but fetches all N
   - Better: Fetch 5 initially, cursor pagination on demand
   - Tradeoff: More complex API; worth it once checkout/event counts grow past ~50 per section

---

## Consistency & Fit

### Pattern Drift

- **Data fetching**: Dashboard uses custom `useDashboardData` hook; sibling pages (items, checkouts) use `useQuery` directly. The hook abstraction adds indirection without obvious gain — sibling pages are simpler. Not a bug, but worth standardizing.

- **Mutation error handling**: Dashboard uses `parseErrorMessage(res, fallback)` + `toast.error(msg)` consistently. Checkouts page uses inline `.json().catch(...)` + generic toast. Dashboard pattern is more defensive and should be the standard.

- **Mutation confirmation**: Dashboard uses `useConfirm` with destructive variant. Some sibling pages use inline confirmations. Dashboard pattern is correct — should propagate.

### Dead Code

None found. All imports, state variables, and props are actively used.

### Ripple Map

- **If `/api/dashboard` response shape changes** → `useDashboardData`, `my-gear-column.tsx`, `team-activity-column.tsx`, `overdue-banner.tsx`, `flagged-items-banner.tsx`, `dashboard-types.ts` all need updating.

- **If `/api/dashboard/stats` response shape changes** → `use-dashboard-data.ts:44-60`, `dashboard-types.ts`, stat cards in `page.tsx:233-236`.

- **If `DashboardSkeleton` props change** → Only `page.tsx` — contained.

- **If stat card hrefs change** (e.g., `/bookings?tab=checkouts`) → Grep `bookings?tab=` across `src/` before changing; hardcoded in `page.tsx:233-236`.

### Navigation Integrity

All links verified against app routes:
- `/checkouts`, `/bookings`, `/reservations`, `/items`, `/schedule`, `/bulk-inventory`, `/events/{id}`, `/scan`, `/import`, `/settings/calendar-sources` ✅
- Draft resume: `/{checkouts|reservations}?draftId=X` ✅
- Filter URL params: `/?sport=X&location=Y` ✅
- Create links: `/checkouts/new`, `/reservations/new` ✅

No dead links found.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | All sections have helpful empty states. First-run welcome banner covers zero-data state. |
| Skeleton fidelity | ✅ | Matches layout, varied row widths, mobile-aware. Minor: doesn't reflect conditional sections (Shifts/Drafts only when count > 0). |
| Silent mutations | ✅ | Draft delete, extend, convert, nudge all have success + error toasts. |
| Confirmation quality | ✅ | `useConfirm` with destructive variant, item-specific label, "This can't be undone" copy. |
| Mobile breakpoints | ✅ | `grid-cols-2 md:grid-cols-4` for stats. `grid-cols-1 md:grid-cols-2` for columns. Buttons wrap on mobile. |
| Error message quality | ✅ | Differentiates network vs server errors. Icons reinforce meaning. |
| Button loading states | ✅ | `actionBusyRef` prevents double-click. Per-item spinner via `inlineActionId`. Buttons disabled during operation. |
| Role gating | ✅ | New checkout/reservation hidden from students. Team Activity column staff/admin only. Nudge gated on `canAction`. |
| Performance (N+1, over-fetch) | ✅ | 2 queries total. Stats overlay avoids re-querying full payload every 60s. Sections capped at 5 rows. |
| Debug cleanup | ✅ | No `console.log`, TODO, or FIXME in page or dashboard components. |
| Accessibility basics | ⚠️ | Most buttons have `aria-label`. `role="button"` divs have `onKeyDown` handlers. Gap: verify `focus-visible:outline` on all interactive elements; gear avatar overflow "+N" lacks semantic label. |

---

## Raise the Bar

These patterns on the dashboard exceed the current norm elsewhere:

1. **Refresh-failure preservation** (`use-dashboard-data.ts:92-96`) — Keeps visible data on refresh failure, shows toast instead of replacing with error screen. Sibling pages replace all content with an error state. Should become the standard for all list pages.

2. **Role in stats response for early-render safety** (`stats/route.ts`) — Prevents staff-only UI from flashing on warm cache hits. All authenticated endpoints should include `role` so pages can gate rendering before the full payload arrives.

3. **Optimistic delete with rollback** (`page.tsx:94-95, 102-106`) — `setQueryData` removes item immediately, rolls back on failure. Sibling pages reload data on delete. Should become the standard for all destructive list mutations.

---

## Quick Wins

1. **`stats/route.ts:77` + `dashboard-types.ts:18`** — Remove unused `myShiftsCount` from stats response and type. Never read by the page. 5 min.

2. **`page.tsx:8, 345-349`** — Fix `BookingDetailsSheet`: change to `{selectedBookingId && <BookingDetailsSheet ... />}` with `Suspense`. True lazy load instead of always-mounted hidden component. 5 min.

3. **`page.tsx:195-201`** — Fix `isFirstRun` condition: `const isEmpty = data ? [check all arrays] : false` so welcome banner correctly shows when stats arrive before full data. 10 min.

4. **`page.tsx` (role checks)** — Extract `const isStaff = ...` and `const isAdmin = ...` at top of component. Replace all inline `data.role === "STAFF" || data.role === "ADMIN"` checks. 10 min.

5. **`filter-chips.tsx:97`** — Remove early `return null` when user has an active filter. Show chip even when no options available to reflect active URL state. 15 min.

---

## Bigger Bets

1. **Split `/api/dashboard` into independent per-section queries** (2–3 hours)
   - One slow query currently blocks entire render. Split into `/api/dashboard/stats`, `/api/dashboard/checkouts`, `/api/dashboard/events`, etc.
   - Sections render as they load independently; one failure doesn't blank the page.
   - Start with stats + checkouts as separate; keep others on full endpoint initially.

2. **Move sport/location filtering to backend query params** (2–3 hours)
   - Currently loads all data then filters client-side.
   - Add optional `?sport=` / `?location=` params; default to all if omitted (backward compat).
   - Worth it once event/checkout counts grow past ~50 items per section.
