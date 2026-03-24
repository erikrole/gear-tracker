# Item Details Page Roadmap

## Context

The Item Details page (`/items/[id]/page.tsx`) is the single-item deep-dive for Wisconsin Athletics Creative's gear management. It serves ADMIN/STAFF as an operational control surface (edit metadata, toggle policies, manage accessories) and STUDENT as a read-only status lookup (scan QR → see who has it, when it's back).

This roadmap covers the **detail page only** — the items list page has its own roadmap at `tasks/items-roadmap.md`.

---

## Current State Assessment

### What works well (keep in all versions)
- **7-tab architecture**: Info, Bookings, Calendar, Insights, History, Accessories, Settings — clean separation of concerns
- **URL-synced tab navigation** with keyboard shortcuts (1-7) — power-user friendly
- **Live countdown timer** (60s tick + visibility refresh) on active bookings
- **Inline editing** via `SaveableField` pattern — blur/Enter saves, Escape cancels, status indicator
- **Derived status line** with color-coded badges and deep links to active bookings (D-001 compliant)
- **Properties strip** — Notion-style inline badges (status, location, category, department, serial)
- **Hero image** with upload/change via Vercel Blob
- **QR code** generation, manual entry, and thumbnail display
- **Insights tab** — 10 charts across 4 time windows with ChartContainer/Recharts
- **Audit history** — full diff-tracked activity feed with actor attribution
- **Accessories** — attach/detach/move with search (D-023)
- **Role gating** — ADMIN/STAFF edit; STUDENT view-only; financial fields hidden from STUDENT
- **Dynamic imports** — BookingDetailsSheet, InsightsTab lazy-loaded for performance
- **Actions menu** — Duplicate, Maintenance toggle, Retire, Delete with policy gating

### What's missing or broken

| Issue | Severity | Notes |
|-------|----------|-------|
| No AbortController on fetches | Medium | Race conditions possible on rapid navigation |
| No 401 redirect handling | Medium | Silent failure if session expires mid-page |
| Error state is a dead end | Medium | "Item not found" with no retry button, no differentiation (network vs 404) |
| No refresh-preserves-data pattern | Medium | Any fetch failure replaces entire page with error |
| No loading indicator on data refresh | Low | Only initial skeleton; subsequent reloads show stale data with no signal |
| No data freshness indicator | Low | Other hardened pages show "Updated X ago" |
| No breadcrumb | Low | Other detail pages use PageBreadcrumb for navigation context |
| 7 tabs overflow on small mobile screens | Medium | TabsList doesn't scroll horizontally — tabs get crushed |
| No tab badge counts | Low | Bookings and Accessories tabs don't show count indicators |
| Header Reserve/Check out buttons show for STUDENT | Low | Buttons visible to students who can create bookings — not gated by asset eligibility |
| No favorite toggle | Low | API exists (`POST /api/assets/{id}/favorite`) but no UI on detail page |
| `notes` field not visible except via JSON hack in metadata | Low | No dedicated notes section |
| Booking history in Bookings tab has no pagination | Medium | Could grow unbounded for frequently-used items |
| 4 separate fetch calls on mount (categories, departments, locations, /api/me) | Low | Pattern fragmentation (GAP-7), no batching |

### Schema data available but not surfaced on detail page

| Field | In Schema | In Detail | Notes |
|-------|-----------|-----------|-------|
| `consumable` | ✅ | ❌ | Boolean flag, no UI anywhere |
| `primaryScanCode` | ✅ | ❌ | Not editable or visible |
| `kitMemberships` | ✅ | ❌ | Blocked by GAP-10 (kit UI) |
| `favoritedBy` | ✅ | ❌ | API exists, no UI |
| `sportCode` on bookings | ✅ | ❌ | History doesn't show sport context |

### Role experience assessment

| Role | Experience | Gap |
|------|-----------|-----|
| ADMIN | Good — full edit, all tabs, financial fields | Missing: batch label printing, notes editing |
| STAFF | Good — same as ADMIN minus user management | Same gaps as ADMIN |
| STUDENT | Adequate — view-only, status lookup works | Missing: favorite, QR scan → detail < 2s not measured |

### Mobile viability
Partially usable. Hero image + header work. **Tab bar is the main problem** — 7 tabs crush on 375px screens. Info tab split layout stacks correctly. Bookings table is cramped. Actions menu works via dropdown.

---

## V1 — Hardened (resilient, complete, spec-compliant)

**Principle:** Close the gap between the shipped detail page and the 5-pass hardening standard applied to every other page. No new features — just reliability, polish, and spec compliance.

### Features

#### 1. Data flow hardening ✅ Shipped
- **AbortController** on all fetches (loadAsset, loadCategories, loadDepartments, loadLocations, /api/me) with cleanup on unmount and re-fetch
- **401 redirect** — check `res.status === 401` on every fetch, redirect to `/login`
- **Refresh-preserves-data** — on reload failure, keep previous `asset` state visible, show toast error instead of replacing page
- **Race condition prevention** — abort in-flight requests before starting new ones
- **Files**: `page.tsx` (main fetch logic)
- **Components**: None new — pattern exists on dashboard, items list, schedule pages

#### 2. Error state improvements ✅ Shipped
- **Differentiated errors**: network (WifiOff icon + "Check your connection") vs server (AlertTriangle + "Something went wrong") vs 404 ("Item not found")
- **Retry button** on error state
- **Components**: shadcn `Alert`, `Button`
- **Files**: `page.tsx` error rendering section

#### 3. Refresh indicator + freshness ✅ Shipped
- **Manual refresh button** with `RefreshCw` icon in header (next to Actions)
- **"Updated X ago" tooltip** on refresh button (pattern from dashboard/reports)
- **Shimmer progress bar** during background refresh (not initial load)
- **Components**: shadcn `Tooltip`, `Button`, `Progress`
- **Files**: `page.tsx` header section

#### 4. Breadcrumb ✅ Shipped
- Add `PageBreadcrumb` with `Items > {assetTag}` path
- **Components**: shadcn `Breadcrumb`
- **Files**: `page.tsx` — add above page-header div

#### 5. Mobile tab overflow ✅ Shipped
- Make `TabsList` horizontally scrollable on mobile with `overflow-x-auto` and `scrollbar-hide`
- Hide keyboard shortcut hints (`kbd` elements) on mobile (already `hidden sm:inline-block`)
- **Components**: No new — CSS on existing `TabsList`
- **Files**: `page.tsx` Tabs section

#### 6. Tab badge counts ✅ Shipped
- **Bookings tab**: show count of active + upcoming bookings (e.g., "Bookings (3)")
- **Accessories tab**: show count of attached accessories (e.g., "Accessories (2)")
- Counts derived from already-loaded `asset` data — no new API calls
- **Components**: shadcn `Badge` (small inline variant)
- **Files**: `page.tsx` tabDefs rendering

#### 7. Notes display
- Show `notes` field in Info tab as a read-only text block (or inline-editable for ADMIN/STAFF)
- Currently stored as JSON metadata — extract and show as plain text section
- **Components**: shadcn `Textarea` (read-only or editable)
- **Files**: `ItemInfoTab.tsx`

### NOT included in V1
- Favorite toggle (V2 — needs optimistic UI pattern)
- Booking history pagination (V2 — needs API changes)
- React Query migration (V2 — items list roadmap dependency)
- Print QR label (V2)
- Real-time updates (V3)

### Loading, error, and empty states
- **Initial load**: High-fidelity skeleton (already exists, good quality)
- **Refresh**: Shimmer progress bar at top, previous data stays visible
- **Error (initial)**: Differentiated Alert with retry button
- **Error (refresh)**: Toast with error type, data preserved
- **Empty tabs**: Already have Empty + EmptyDescription patterns (keep)

### RBAC
- All 7 features are role-neutral (resilience applies to all roles)
- Refresh button: visible to all
- Notes editing: ADMIN/STAFF only; STUDENT sees read-only
- Breadcrumb: visible to all

### Mobile behavior
- Breadcrumb: truncated on mobile (show "..." > assetTag)
- Tab overflow: horizontal scroll with momentum
- Refresh button: icon-only (no text label)
- Progress bar: full-width below tabs

### Build order (Thin Slice Protocol)
1. Data flow: AbortController + 401 redirect + refresh-preserves-data
2. Error states: differentiated rendering + retry button
3. UI: breadcrumb + refresh indicator + freshness tooltip
4. UI: mobile tab scroll fix
5. UI: tab badge counts
6. UI: notes section in Info tab
7. Verify: `npm run build` passes, test all 7 tabs, test on 375px viewport

---

## V2 — Enhanced (faster workflows, reduced friction)

**Principle:** Now that the detail page is reliable, make it faster and smarter. Reduce clicks, surface contextual data, and connect to the broader system.

### Features

#### 1. Favorite toggle
- Star icon in header (between title and Actions button)
- Optimistic toggle with rollback on error
- **API**: `POST /api/assets/{id}/favorite` already exists
- **Components**: `Star`/`StarOff` from lucide-react, shadcn `Button` (ghost)
- **RBAC**: All roles (personal preference)
- **Mobile**: 44px tap target

#### 2. Print QR label
- "Print label" action in Actions dropdown menu
- Opens browser print dialog with a styled label layout (assetTag + QR + brand/model)
- **Components**: Hidden print-only `div` with `@media print` styles
- **Files**: `page.tsx` (ActionsMenu + print layout)
- **RBAC**: ADMIN/STAFF only
- **Alternative**: Could use `@react-pdf/renderer` for downloadable PDF — evaluate

#### 3. Booking history pagination
- Paginate the Bookings tab table (25 per page)
- "Load more" button at bottom (not full pagination — history is chronological)
- **API**: Extend `/api/assets/{id}` to accept `historyPage` param, or lazy-load history separately
- **Components**: shadcn `Button` for load-more
- **Files**: `ItemBookingsTab.tsx`

#### 4. Copy shareable link
- "Copy link" button in header (or in Actions menu)
- Copies current URL including active tab to clipboard
- Toast confirmation: "Link copied"
- **Components**: shadcn `Button`, `Copy` icon from lucide-react
- **RBAC**: All roles

#### 5. Related items sidebar
- "Related items" section at bottom of Info tab — items in same category or same parent
- Shows up to 5 related items with mini cards (image + assetTag + status dot)
- Click navigates to that item's detail page
- **API**: New `GET /api/assets/{id}/related` endpoint (same category, same location, excluding self)
- **Components**: Mini item card (reuse from items list `ItemCard`)
- **RBAC**: All roles

#### 6. Quick status actions from header
- When item is checked out: show "View checkout" button directly in header
- When item has upcoming reservation: show "View reservation" button
- Reduces one click (currently user must scroll to operational overview or Bookings tab)
- **Components**: shadcn `Button` (small, outline)
- **Files**: `page.tsx` header section

#### 7. Smart Reserve/Checkout buttons
- Disable "Reserve" when `availableForReservation === false`
- Disable "Check out" when `availableForCheckout === false` or item is already checked out
- Show tooltip explaining why button is disabled
- **Components**: shadcn `Tooltip` (already imported)
- **RBAC**: Keep buttons visible for ADMIN/STAFF; hide for STUDENT (students create bookings from booking pages)

#### 8. Sport context in booking history
- Show sport badge (e.g., "MBB", "WVB") on booking history rows
- Data already available in `history[].booking.sportCode`
- **Components**: shadcn `Badge` (outline)
- **Files**: `ItemBookingsTab.tsx`

### What V1 features get enhanced
- Refresh indicator → adds "last refreshed" timestamp to header
- Tab counts → become clickable (scroll to relevant section)
- Notes → adds rich text formatting (bold, links) if warranted

### NOT included in V2
- Real-time updates (V3)
- Item comparison (V3)
- Predictive maintenance indicator (V3)
- Depreciation chart (V3)

### Schema changes
None. All data needed is already in the schema or derivable from existing relations.

### Dependencies
- Items list roadmap V1 (favorite API enrichment — `isFavorited` on GET response)
- Existing `SaveableField` and `InlineTitle` components
- No new npm packages

### Build order
1. API: Related items endpoint + history pagination support
2. UI: Favorite toggle (optimistic)
3. UI: Smart Reserve/Checkout button gating + tooltips
4. UI: Quick status actions in header
5. UI: Booking history pagination (load-more)
6. UI: Sport context badges on history rows
7. UI: Copy shareable link
8. UI: Print QR label
9. UI: Related items section

---

## V3 — Advanced (proactive, predictive, intelligent)

**Principle:** The detail page anticipates needs. It surfaces the right information at the right time and connects item context to operational decisions.

### Features

#### 1. Real-time status polling
- Poll `/api/assets/{id}` every 30s when tab is focused
- Show subtle "Live" indicator when polling is active
- Pause on tab blur, resume on focus
- **Prerequisite**: React Query with `refetchInterval` (items list V2)
- **Components**: Small green dot indicator + shadcn `Badge`

#### 2. Maintenance prediction indicator
- Soft "Maintenance suggested" badge when item exceeds usage thresholds
- Factors: days since last maintenance, checkout count since last maintenance, average checkout duration trending up
- **API**: New `GET /api/assets/{id}/health` endpoint computing risk score
- **Schema**: Add `lastMaintenanceDate DateTime?` on Asset
- **Components**: Orange dot indicator on header, expandable explanation card on Info tab

#### 3. Depreciation timeline chart
- New chart in Insights tab: purchase price → current estimated value → residual value over time
- Straight-line depreciation curve with current position marker
- **Prerequisite**: `purchasePrice`, `purchaseDate`, `residualValue` populated
- **Components**: Recharts `AreaChart` within existing `ItemInsightsTab.tsx`
- **RBAC**: ADMIN/STAFF only (financial data)

#### 4. Similar items comparison
- "Compare with similar" action — opens side-by-side view with 1-2 related items
- Compares: utilization rate, avg checkout duration, booking count, maintenance frequency
- **API**: Reuses existing insights endpoint for each item
- **Components**: New comparison modal/sheet with mini-charts
- **RBAC**: ADMIN/STAFF only

#### 5. Checkout suggestion context
- When viewing an item, show "Frequently checked out with:" section
- Lists items that are commonly in the same bookings as this item
- **API**: New `GET /api/assets/{id}/co-booked` — aggregates booking overlap data
- **Components**: Mini item cards (reuse from V2 related items)
- **Files**: Info tab or new dedicated section

#### 6. Event-linked timeline
- Timeline view showing this item's journey across events
- Visual: horizontal timeline with event markers, checkout spans, and gaps
- **API**: Extend insights data with event-linked booking history
- **Components**: Custom timeline component (no shadcn equivalent)
- **RBAC**: All roles

#### 7. Item condition notes
- Structured condition tracking: "Good", "Fair", "Poor" with dated notes
- Staff records condition observations during check-in
- Shows condition history on Info tab
- **Schema**: New `AssetConditionLog` model (assetId, condition enum, note, actorId, createdAt)
- **Components**: shadcn `Select` for condition + `Textarea` for note

#### 8. QR label batch from accessories
- "Print all labels" action on Accessories tab — prints parent + all child labels in one PDF
- **Prerequisite**: V2 print single label
- **Library**: `@react-pdf/renderer`
- **RBAC**: ADMIN/STAFF only

### Schema changes
- Add `lastMaintenanceDate DateTime?` to Asset model
- New `AssetConditionLog` model for structured condition tracking
- No changes to existing fields or relations

### Dependencies
- React Query migration (items list V2)
- V2 print label feature (for batch printing)
- V2 related items endpoint (for co-booked suggestions)
- 6+ months of booking data for meaningful predictions

### Build order
1. Schema: Add `lastMaintenanceDate` + `AssetConditionLog` migration
2. API: Health score endpoint, co-booked endpoint
3. UI: Real-time polling setup
4. UI: Maintenance prediction indicator
5. UI: Depreciation timeline chart
6. UI: Condition tracking notes
7. UI: Checkout suggestion context
8. UI: Similar items comparison
9. UI: Event-linked timeline
10. UI: Batch QR label printing

---

## Risks

### V1 scope creep
- **Favorite toggle**: Tempting to add here, but it needs optimistic UI (React Query pattern) to feel right. Keep in V2.
- **Booking pagination**: Requires API changes — not just UI. V2.
- **React Query migration**: V1 hardening uses the same manual fetch pattern as the rest of the page. Don't mix paradigms mid-hardening.

### V2 YAGNI risks
- **Related items**: May be underused if staff already know their inventory. Ship it, but don't over-invest in the recommendation algorithm.
- **Print QR label**: Validate with actual staff — they may already have a label printer workflow. Browser print may not match physical label specs.

### V3 questionable ROI
- **Predictive maintenance**: System is new. Not enough historical data for meaningful predictions until 6+ months of usage. Don't build this prematurely.
- **Event-linked timeline**: Impressive visualization but may be a "look at" feature rather than an "act on" feature. Validate user need before building.
- **Item condition notes**: Could overlap with the existing `notes` field. Needs clear differentiation.

### Tight coupling
- **React Query (V3 real-time)**: Depends on items list V2 migration. If that slips, V3 real-time features are blocked.
- **Print label spec**: Physical label dimensions must match actual label stock. Needs user validation with printed output.

---

## Summary

| Version | Theme | Key Deliverables | Sessions |
|---------|-------|-----------------|----------|
| V1 | Hardened | AbortController, 401 redirect, error differentiation, refresh indicator, breadcrumb, mobile tabs, tab counts, notes | 1-2 |
| V2 | Enhanced | Favorites, print label, history pagination, related items, smart buttons, sport badges, copy link | 2-3 |
| V3 | Intelligent | Real-time polling, maintenance prediction, depreciation chart, condition tracking, co-booked suggestions, comparison | 4-6 |

Each version is independently complete. V1 brings the detail page to the same hardening standard as the rest of the app. V2 reduces daily friction for staff managing gear. V3 makes the system proactive and data-driven.
