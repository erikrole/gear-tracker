# Gear Tracker — System Roadmap

## Document Control
- Author: System Architecture Review
- Date: 2026-03-23
- Status: Living roadmap — update when shipping features or revising priorities
- Scope: Full-system analysis and three-version evolution plan

---

## STEP 1: SYSTEM OVERVIEW

### Core System Purpose

Gear Tracker is the internal gear management system for Wisconsin Athletics Creative. It replaces Cheqroom with an **event-driven, athletics-specific operational system** built for game-day media operations at Camp Randall Stadium and Kohl Center.

**Primary value**: Operational speed, clarity, and trust for check-outs, reservations, and gear handling. The right metric is not feature count — it's whether a student can check out a camera kit in three taps, and whether staff always know who has what gear.

### Primary Users

| Mode | Who | Context | Success Metric |
|------|-----|---------|---------------|
| **Students** | Student crew members | Phone, stadium/arena, often rushed | Find and act on due/overdue checkouts within 2 taps |
| **Staff** | Full-time Athletics Creative staff | Desktop + mobile, managing all users/gear | Act on any booking from dashboard within 1 click |
| **Admins** | Technical admins, senior leads | Desktop-primary, lower frequency | Investigate any incident from audit log alone |

### Key Domains — Current Maturity

| Domain | Pages | Maturity | Notes |
|--------|-------|----------|-------|
| **Booking** (checkouts, reservations, drafts) | `/checkouts`, `/reservations`, `/bookings/[id]` | **Solid** | Unified detail page, reference numbers, scan flow, partial check-in |
| **Inventory** (items, bulk SKUs, accessories) | `/items`, `/bulk-inventory` | **Solid** | DataTable, derived status, numbered bulk units, parent-child accessories |
| **Events** (calendar, ICS sync) | `/events` | **MVP** | ICS ingest works; no multi-source, no staleness thresholds formalized |
| **Users** (roles, profiles) | `/users`, `/profile` | **Solid** | Tiered RBAC, profile merged into user detail, 5-pass hardened |
| **Shifts** (scheduling, trades) | `/schedule` | **Solid** | Auto-generation, trade board, gear integration, command center |
| **Dashboard** (ops console) | `/` | **Solid** | V3 shipped, sport filter chips, overdue banner, stat strip, drafts |
| **Notifications** (escalation, email) | `/notifications` | **MVP** | In-app + email shipped; multi-recipient escalation pending |
| **Reports** | `/reports` | **MVP** | Basic metrics, URL-persisted filters, data freshness; no deep analytics |
| **Settings** (admin config) | `/settings/*` | **Solid** | Categories, sports, escalation, calendar sources, DB diagnostics |
| **Import** | `/import` | **Solid** | Generic CSV with Cheqroom preset, dry-run, lossless |
| **Search** | `/search`, Cmd+K | **MVP** | Command palette searches assets/checkouts/reservations; no unified cross-domain |
| **Scan** | `/scan` | **Solid** | 5-pass hardened, auto-clear feedback, spam-click guards |
| **Labels** | `/labels` | **Scaffold** | Label generation exists but minimal UI |
| **Kits** | `/kits` | **Scaffold** | Full schema (D-020), zero UI |

---

## STEP 2: CURRENT ARCHITECTURE

### Pages & Flows

**Complete page tree** (16 pages under `(app)/`):

| Page | Primary Flow | Inbound From | Outbound To |
|------|-------------|--------------|-------------|
| `/` (Dashboard) | Daily ops triage | Login, sidebar | Checkout/reservation detail, scan, events |
| `/checkouts` | Browse all checkouts | Sidebar, dashboard | Checkout detail, create checkout |
| `/reservations` | Browse all reservations | Sidebar, dashboard | Reservation detail, create reservation |
| `/checkouts/[id]` | Checkout detail + actions | Dashboard row, list row, search | Scan, item detail, user detail |
| `/reservations/[id]` | Reservation detail + actions | Dashboard row, list row, search | Item detail, user detail, convert to checkout |
| `/items` | Browse/manage inventory | Sidebar | Item detail, create item |
| `/items/[id]` | Item detail + history | Items list, scan, search | Checkout/reservation links, QR |
| `/events` | Browse athletics calendar | Sidebar | Event detail (inline), command center |
| `/schedule` | Shift management | Sidebar | Shift detail panel, trade board |
| `/scan` | QR scan entry point | Sidebar, dashboard, mobile nav | Item detail, checkout detail |
| `/users` | User management | Sidebar | User detail |
| `/users/[id]` | User detail + activity | Users list, profile redirect | Booking links |
| `/profile` | Redirect → `/users/{id}` | Sidebar | User detail |
| `/notifications` | Notification center | Header bell icon | Booking links from notifications |
| `/reports` | Operational metrics | Sidebar | — (dead end for drill-down) |
| `/settings/*` | Admin configuration | Sidebar | — |
| `/import` | CSV import pipeline | Sidebar | Items list (post-import) |
| `/labels` | Label generation | Sidebar | — |
| `/search` | Cross-entity search | Cmd+K, sidebar | Item/booking detail |
| `/bulk-inventory` | Bulk SKU management | Sidebar | — |
| `/kits` | Kit management (empty) | Sidebar (staff+) | — |

**Dead Ends** (no outbound drill-down):
- `/reports` — metrics display only, no drill into individual bookings or items
- `/labels` — generates labels, no navigation to items
- `/bulk-inventory` — manages SKUs but limited cross-linking

**Orphan-ish Pages**:
- `/kits` — navigable via sidebar but empty (zero UI, D-020)
- `/labels` — accessible but not linked from other workflows

### Shared Components & Patterns

**Consistent patterns (good)**:
- `withAuth()` / `withHandler()` API route decorators — all routes use these
- `requirePermission()` enforcement on all mutation endpoints
- `createAuditEntry()` on all mutations (D-007)
- shadcn/ui components system-wide (41 components installed)
- `AbortController` fetch pattern on all client pages (prevents race conditions)
- Refresh-preserves-data pattern (toast on failure, not error screen wipe)
- `InlineTitle` component shared between booking detail and item detail
- `BookingDetailPage` unified for checkout + reservation detail
- `useSaveField` / `SaveableField` pattern for inline edits
- Toast feedback on all mutations
- High-fidelity skeletons on all list pages
- 401 → login redirect on all fetch calls

**Inconsistent patterns (needs attention)**:
- **Page decomposition**: Dashboard is a single large client component; items page has been decomposed into hooks + leaf components. No standard established.
- **Data fetching**: Some pages use dedicated init endpoints (`/api/items-page-init`), others make multiple parallel fetches. No SWR/React Query — all manual fetch + useState.
- **Form handling**: No unified form library. Some pages use controlled inputs + manual validation, others use Zod schemas. No react-hook-form or similar.
- **URL state**: Dashboard uses `useSearchParams` for sport filter. Reports page uses URL-persisted filters. Items page has `use-url-filters` hook. Three different implementations of the same concept.
- **Error handling**: Most pages differentiate network vs server errors post-hardening, but the pattern isn't extracted into a shared utility.
- **Empty states**: The `<Empty>` shadcn component exists and is used in most places, but some pages still have inline "No data" text.

### Schema Surface with Zero UI

| Model | UI Status | Notes |
|-------|-----------|-------|
| Kit, KitMembership | **Zero UI** | Full schema, D-020 accepted, `/kits` page is empty |
| LocationMapping | **Admin-only** | `/api/location-mappings` exists, minimal settings UI |
| SystemConfig | **Zero UI** | Key-value config store, no settings surface |
| FavoriteItem | **Partial** | API exists (`/api/assets/[id]/favorite`), no favorites page/filter |

---

## STEP 3: SYSTEM VERSION ROADMAP

### V1 — Cohesive Foundation

**Goal**: Every page feels like it belongs to the same product. Consistency and reliability across the system.

#### 3.1 Extract Shared Patterns (Size: M) ✅ Shipped

| Pattern | Current State | Target | Status |
|---------|--------------|--------|--------|
| URL state management | 3 different implementations | `useUrlState(key, defaultValue)` in `src/hooks/use-url-state.ts` | ✅ Shipped |
| Fetch + loading/error | Manual `useState` + `useEffect` + `AbortController` | `useFetch<T>(url, options)` in `src/hooks/use-fetch.ts` | ✅ Shipped |
| Error classification | Inline `if (!res.ok)` with ad-hoc checks | `classifyError(error)` in `src/lib/errors.ts` | ✅ Shipped |
| Page init pattern | Mix of single init endpoints and multiple parallel fetches | Standardize: pages with 3+ fetches get a consolidated init endpoint | ✅ Shipped |

#### 3.2 Complete Missing States (Size: S)

- **Reports drill-down**: Reports page is a dead end — add "View bookings" links from metric cards to filtered checkout/reservation lists
- **Labels cross-linking**: Add "Print label" action from item detail page → `/labels?items=id1,id2`
- **Bulk inventory → item detail**: Add row click → item detail navigation on bulk SKU rows
- **Kits page placeholder**: Replace empty page with "Coming soon" card explaining D-020 status (prevents user confusion)

#### 3.3 Page Decomposition Standard (Size: M) ✅ Shipped

Dashboard decomposed from 1004-line monolith into hooks + 7 leaf components:
- `use-dashboard-data.ts`, `use-dashboard-filters.ts` extracted
- Section components: `OverdueBanner`, `StatStrip`, `FilterChips`, `MyGearColumn`, `TeamActivityColumn` extracted
- Sport filter chips, saved filters shipped on top of decomposed architecture

#### 3.4 Form Handling Standardization (Size: L — but incremental) ✅ Shipped

- `useFormSubmit(schema, endpoint)` hook extracted to `src/hooks/use-form-submit.ts`
- Handles client-side Zod validation, API fetch with auth redirect, error classification, toast feedback, per-field errors, double-submit prevention
- Applied across highest-traffic forms

#### 3.5 Remaining shadcn Component Gaps (Size: S)

All 41 shadcn components are installed. Remaining custom primitives to replace:
- `CategoryRow` inline rename → should use `SaveableField` pattern (per lessons.md)
- Any remaining `<select>` elements → shadcn `<Select>` or `<NativeSelect>`
- Verify no pages still use raw `<input>` instead of shadcn `<Input>`

#### 3.6 Location Filter Chip (Size: S)

- Sport filter chips shipped (2026-03-23). Location filter is the natural next step.
- `BookingSummary.locationName`, `MyReservation.locationName`, `EventSummary.location`, `MyShift.locationName` — data already in API responses
- Add `activeLocation` alongside `activeSport`, URL param `?location=Camp+Randall`
- Handle field name inconsistency: events use `location`, everything else uses `locationName`
- **No dependency on dashboard decomposition** — same pattern as sport filter, added to existing page

#### 3.7 Unified Calendar Page (Size: M) ✅ Shipped 2026-03-23

- Events + Schedule merged into unified `/schedule` page
- Old `/events` list page removed (detail page `/events/[id]` unchanged); sidebar shows "Schedule"
- Venue Mappings moved to `/settings/venue-mappings`
- Calendar Sources moved to `/settings/calendar-sources`
- Trade Board kept as tab (no regression)
- See `tasks/calendar-roadmap.md` for V2/V3 enhancements

---

### V2 — Connected Experience

**Goal**: Reduce friction between pages. The system remembers context and reduces manual work.

#### 3.7 Cross-Page State Awareness (Size: L)

- **Checkout page knows the current event**: If user navigates from Event Command Center → Create Checkout, event should be pre-selected (pass `?eventId=X` in URL)
- **Item detail shows availability timeline**: Calendar tab exists but could show conflict warnings when creating overlapping reservations
- **Dashboard → detail → back**: Preserve dashboard scroll position when returning from detail sheets (currently resets)
- **Notification → action**: Overdue notification should deep-link to booking detail with "Check in" action pre-highlighted

#### 3.8 Smarter Defaults & Persistence (Size: M)

- **Remember last-used sport filter**: Store in `localStorage`, restore on dashboard load (URL param still overrides)
- **Remember last-used location**: Same pattern
- **Auto-select current event**: When creating a checkout during an active event, pre-select it (don't just show it first)
- **Form field persistence**: Checkout creation form auto-saves as DRAFT (already shipped via D-017). Extend to reservation creation.

#### 3.9 Inline Dashboard Actions (Size: M)

- **Overdue quick actions**: Extend and check-in buttons directly on overdue dashboard rows (no navigate-to-detail first)
  - Extend: `POST /api/bookings/[id]/extend` — already exists
  - Check-in all: `POST /api/checkouts/[id]/checkin-items` — already exists
  - Confirm dialog inline, success toast, row updates optimistically
- **Draft resume**: Already shipped (dashboard Drafts section)
- **Reservation convert**: "Start checkout" button directly on reservation dashboard rows

#### 3.10 Unified Search (Size: L)

- Current: Cmd+K searches assets, checkouts, reservations separately
- Target: Single search that returns results across all domains with type indicators
- Include: items, checkouts, reservations, users, events, shifts
- Keyboard-navigable with recent searches
- This enables the "find anything" workflow — critical for staff who need to act fast

#### 3.11 Notification Improvements (Size: M)

- **Dashboard badge count**: Unread notification count in sidebar (API exists: `/api/notifications?unread=true`)
- **Multi-recipient escalation**: D-009 accepted — +24h escalation to requester + all admins
- **Alert fatigue controls**: Admin-configurable escalation intervals + per-booking caps (settings page)
- **Actionable notifications**: Each notification has a primary CTA button (View booking, Check in, Extend)

#### 3.12 Kit Management UI (Size: L) ✅ V1 Shipped 2026-03-24

- D-020 accepted. Full Prisma schema exists: `Kit`, `KitMembership`
- **Slice 1**: Kit CRUD (create, edit, delete kits; add/remove items) ✅
- **Slice 2**: Kit member management + archive/restore ✅
- Slices 3-4 (kit checkout, dashboard cards) deferred to V2

---

### V3 — Intelligent System

**Goal**: The system anticipates needs, automates repetitive tasks, provides operational intelligence.

#### 3.13 Predictive Behavior (Size: L)

- **Suggest gear by event type**: Football away game → standard travel kit. Basketball home → full broadcast setup. Learn from historical bookings per sport + event type.
- **Predict availability conflicts**: When creating a reservation, warn if items are likely unavailable based on recurring booking patterns
- **Smart reorder**: Suggest which gear to check out based on past checkouts for same sport/event type

#### 3.14 Context-Aware UI (Size: L)

- **Game-Day Mode**: Dashboard adapts when an event is within 4 hours — shows shift coverage, gear readiness, and outstanding checkouts prominently
- **Game-Day Readiness Score**: Aggregate metric (shift coverage % + gear checkout % + overdue count) — deferred from scheduling integration Slice 5
- **Role-specific dashboard layout**: Students see My Gear first (already true). Staff see Team Activity first. Admins see system health.
- **Time-of-day adaptation**: Morning = upcoming today. Evening = overdue + tomorrow prep.

#### 3.15 Automation (Size: L)

- **Auto-generate bookings from recurring events**: If Football Home always needs Camera Kit A, auto-create reservation when event syncs
- **Bulk check-in by scan session**: Scan all items → system matches to open bookings → one-tap confirm all returns
- **Scheduled notifications**: "Tomorrow you have MBB at Kohl Center — your gear is reserved" (evening before game day)

#### 3.16 Deeper Domain Integration (Size: L)

- **Shift → checkout auto-linking**: When a shift is assigned, auto-create a checkout reservation for the standard gear kit for that shift area
- **Event changes cascade**: If an event is rescheduled, update all linked bookings' dates (with confirmation)
- **Maintenance scheduling**: Track equipment usage hours, suggest maintenance intervals, auto-flag items that haven't been serviced

#### 3.17 Operational Intelligence (Size: L)

- **Usage analytics**: Most-used items, peak checkout times, average checkout duration by sport
- **Equipment health scoring**: Combine age, usage frequency, maintenance history, damage reports
- **Peak usage prediction**: Historical data → forecast busy periods → suggest pre-staging gear
- **Loss/damage trends**: Track which items/categories have highest loss rates

---

## STEP 4: CROSS-CUTTING FEATURES

| Feature | Current State | V1 Target | V2 Target |
|---|---|---|---|
| **Error handling** | Per-page inline, most differentiate network/server post-hardening | Extract `classifyError()` utility; all pages use same pattern | Automatic retry with exponential backoff for transient failures |
| **Loading states** | High-fidelity skeletons on all hardened pages (dashboard, items, users, scan, reports) | Ensure ALL pages have skeletons (events, schedule, kits, bulk-inventory may lack them) | Streaming/suspense boundaries for progressive loading |
| **Empty states** | shadcn `<Empty>` component used in most places | Audit and replace all inline "No data" text with `<Empty>` + actionable CTA | Context-aware empty states ("No checkouts for MBB — create one?") |
| **Toast notifications** | Sonner integrated; toast on all mutations post-hardening | Standardize toast messages (success: verb past tense, error: what went wrong + retry) | Undo support on destructive toasts (delete, cancel) |
| **Confirmation dialogs** | AlertDialog used for draft discard, item delete, booking cancel | Ensure ALL destructive actions use AlertDialog (audit for any missing) | Batch confirmations ("Cancel 3 selected reservations?") |
| **Form validation** | Mix of Zod schemas and manual checks; no unified library | Zod schemas for all create/edit forms; shared `useFormSubmit` hook | Inline field-level validation with debounced server checks |
| **RBAC enforcement** | `requirePermission()` on all mutations; UI hides/disables per role | No gaps identified — maintain coverage | Row-level security for multi-tenant if scope expands |
| **Audit logging** | `createAuditEntry()` on all mutations (verified in hardening passes) | No gaps identified — maintain coverage | Audit log search/filter UI for admins (currently read-only timeline) |
| **Mobile responsiveness** | All pages validated against AREA_MOBILE.md; 44px+ tap targets; iOS fixes | No gaps identified — maintain vigilance on new features | PWA with offline read cache |
| **Keyboard accessibility** | Cmd+K command palette; basic focus management | Audit tab order on all pages; ensure all actions keyboard-reachable | Full keyboard shortcut layer (J/K navigation, Enter to open, Esc to close) |

---

## STEP 5: DATA & STATE STRATEGY

### Current State

| Layer | Pattern | Used By |
|-------|---------|---------|
| **Server state** | `fetch()` + `useState` + `useEffect` + `AbortController` | All pages |
| **URL state** | `useSearchParams` + `router.replace` | Dashboard (sport filter), reports (filters), items (filters) |
| **Local state** | `useState` for form inputs, modals, loading flags | All pages |
| **Derived state** | `useMemo` for filtered/sorted views | Dashboard (filtered sections), items (derived status) |
| **No shared cache** | Each page re-fetches on mount; no cross-page cache | All pages |

### How Data Flows Across Pages

- **Re-fetch on mount**: Every page fetches fresh data on mount. No shared cache means navigating Dashboard → Checkout Detail → Dashboard triggers 3 full fetches.
- **URL params for cross-page context**: `?sport=MBB`, `?draftId=X`, `?eventId=X` pass minimal context between pages.
- **Detail sheets**: `BookingDetailsSheet` receives an ID prop, fetches its own data. Parent page refreshes on sheet close via `onUpdated` callback.
- **No WebSocket/SSE**: All data is request-response. No real-time updates across tabs.

### Data Risks

| Risk | Severity | Current Mitigation | Recommended |
|------|----------|-------------------|-------------|
| **Stale data across tabs** | Medium | None — each tab fetches independently | V2: Visibility API refresh on tab focus |
| **Stale data after background** | Medium | Manual refresh button + "Updated X ago" tooltip | V2: Auto-refresh on visibility change (already have AbortController) |
| **Race conditions on mutations** | Low | SERIALIZABLE transactions + P2034 retry | Adequate for V1 |
| **N+1 queries** | Low-Medium | Consolidated init endpoints for items page; others may have parallel fetches | V1: Audit remaining pages for unnecessary round-trips |
| **Unbounded result sets** | Low | Pagination on all list pages (limit 50 default, 200 max) | Adequate for V1 |
| **Optimistic update inconsistency** | Low | Used for draft delete, checkin. Rollback on failure. | V2: SWR/React Query for automatic cache invalidation |

### Recommendations by Version

**V1** (no new dependencies):
- Extract `useFetch` hook to standardize loading/error/refresh across pages
- Add visibility-based refresh (Page Visibility API → re-fetch when tab becomes active)
- Audit for N+1 query patterns on events page and schedule page

**V2** (adopt React Query or SWR):
- Replace manual `useState` + `fetch` + `AbortController` with React Query
- Benefits: automatic cache, background refresh, optimistic updates, deduplication
- Migration path: one page at a time, starting with dashboard (highest traffic)
- Shared cache means Dashboard → Detail → Dashboard reuses cached data

**V3** (real-time):
- Server-Sent Events for dashboard overdue count and checkout status
- Enables multi-user awareness ("Erik just checked in CO-0042")
- Only justified at scale or for game-day mode

---

## STEP 6: DEPENDENCIES & ORDER

### What Must Be Unified First

```
Extract shared hooks (useFetch, useUrlState)
        │
        ├──→ Dashboard decomposition (benefits from extracted hooks, not blocked by them)
        │           │
        │           ├──→ Inline overdue actions (depends on decomposed dashboard)
        │           └──→ Saved filters (depends on decomposed dashboard)
        │
        ├──→ Form standardization (useFormSubmit + Zod)
        │           │
        │           └──→ Kit management UI (depends on form patterns)
        │
        └──→ Error classification utility
                    │
                    └──→ React Query adoption (V2 — replaces useFetch with proper cache)

Independent (no blockers):
        ├──→ Unified Calendar page (merge /events + /schedule → /calendar)
        ├──→ Location filter chip (same pattern as sport filter)
        ├──→ Reports drill-down links
        ├──→ Labels cross-linking
        └──→ Empty state audit
```

### What Blocks Other Improvements

| Blocker | What It Blocks | Effort |
|---------|---------------|--------|
| Dashboard decomposition | Inline actions, saved filters, Game-Day Mode | M |
| Shared hook extraction | Consistent patterns across all new features | S |
| D-009 recipient model finalization | Multi-recipient escalation, notification improvements | S (decision, not code) |
| `BRIEF_KIT_MANAGEMENT_V1.md` | Kit UI implementation | S (planning doc) |

### Quick Wins (Ship Independently, Immediate Impact)

| Item | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Location filter chip | S | Medium — staff filter by venue | Sport filter already exists as pattern |
| Reports drill-down links | S | Medium — reports become actionable | None |
| Labels cross-linking from item detail | S | Low-Medium — completes the flow | None |
| Kits page placeholder card | XS | Low — prevents user confusion | None |
| Extract `classifyError()` utility | S | Medium — consistency | None |
| Visibility-based auto-refresh | S | Medium — stale data prevention | None |
| Empty state audit | S | Low — polish | None |

---

## STEP 7: RISKS & COMPLEXITY

### Overengineering Risks

| V3 Idea | Risk Level | Reasoning |
|---------|-----------|-----------|
| Predictive gear suggestions | High | Requires ML-scale historical data; team is small. Rule-based suggestions per sport are sufficient. |
| Real-time SSE/WebSocket | Medium | Only valuable for multi-user concurrent operations (game day). Polling + visibility refresh covers 90% of needs. |
| PWA offline mode | Medium | Students have reliable campus WiFi. Offline mutations add significant complexity for rare benefit. |
| Equipment health scoring | Low | Valuable but requires structured maintenance data that doesn't exist yet. Build maintenance tracking first. |

### Tight Coupling Concerns

- **Dashboard ↔ API shape**: Dashboard fetches a monolithic `DashboardData` object. Any new section requires API changes. Consider breaking into independent section endpoints for V2.
- **BookingDetailPage ↔ booking-actions.ts**: Action gating logic is shared but tightly coupled to status enum values. Status vocabulary (D-025) adds a translation layer that must stay in sync.
- **Equipment sections/guidance ↔ code**: D-016 keeps rules in code. This is fine for V1 but blocks operator self-service. Phase C should deliver admin-configurable rules.

### Migration Burden for V1 Consistency

- **Low**: Most pages are already hardened (5-pass audits on dashboard, items, users, scan, reports, login, profile). The remaining work is extracting shared patterns, not rewriting pages.
- **Medium**: Dashboard decomposition is the largest V1 item. The page likely has 500+ lines of interleaved state, effects, and rendering.
- **Low**: Form standardization can be incremental — new forms use the standard, existing forms migrate opportunistically.

### Scaling Considerations

| Dimension | Current Capacity | 2x Users | 10x Inventory |
|-----------|-----------------|----------|---------------|
| Page load time | Fast (Neon serverless, paginated) | Fine — stateless serverless | Need cursor-based pagination for items list |
| Dashboard query | Single API call, all sections | May need lazy-loaded sections | Need section-level caching |
| Search | Client-side filter in Cmd+K | Fine | Need server-side full-text search (Postgres `tsvector`) |
| Audit log | Unbounded growth | Fine short-term | Need retention policy or archival |
| Notification volume | Cron every 15min, dedup by booking | Fine | Fine — dedup prevents explosion |

### Scope Creep Boundaries

The V1/V2 boundary is most likely to blur on:
- **Inline dashboard actions** (V2) being pulled into V1 because they seem "simple" — but they require dashboard decomposition first
- **React Query adoption** (V2) being requested during V1 hook extraction — resist; `useFetch` is the V1 stepping stone
- **Kit management** (V2) being started before the brief is written — D-020 says schema-ready, but UI needs a `BRIEF_KIT_MANAGEMENT_V1.md`

---

## STEP 8: IMPLEMENTATION STRATEGY

### Rollout Plan

**Incremental (one page at a time)**:
- Shared hook extraction (`useFetch`, `useUrlState`, `classifyError`)
- Empty state audit
- Reports drill-down links
- Labels cross-linking
- Location filter chip (dashboard only)

**Coordinated changes (multiple files)**:
- Dashboard decomposition (page + new hook files + new component files)
- Form standardization (new hook + Zod schemas + first adopter page)
- React Query migration (install + one page at a time)

### Recommended V1 Order (Highest Impact → Lowest)

| # | Item | Effort | Impact | Files Touched | Dependencies |
|---|------|--------|--------|--------------|-------------|
| 1 | **Unified Schedule page** | M | High — merges two workflows | `/schedule` page, sidebar, old pages removed | None |
| 2 | Location filter chip | S | Medium — staff filter by venue | Dashboard page + new filter logic | None (same pattern as sport filter) |
| 3 | Extract `useUrlState` hook | S | Foundation | New: `src/hooks/use-url-state.ts` | None |
| 4 | Extract `useFetch` hook | S | Foundation | New: `src/hooks/use-fetch.ts` | None |
| 5 | Extract `classifyError` utility | S | Consistency | New: `src/lib/errors.ts` | None |
| 6 | Reports drill-down links | S | Medium — reports become actionable | `src/app/(app)/reports/page.tsx` | None |
| 7 | Dashboard decomposition | M | Enables V2 features | `src/app/(app)/page.tsx` → hooks + components | Benefits from 3-5 |
| 8 | Visibility-based auto-refresh | S | Data freshness | `useFetch` hook enhancement | Item 4 |
| 9 | Empty state audit | S | Polish | Multiple pages | None |
| 10 | Form standardization (`useFormSubmit`) | M | Foundation | New hook + checkout/reservation creation forms | Benefits from 5 |
| 11 | Kits placeholder page | XS | Polish | `src/app/(app)/kits/page.tsx` | None |

### Resource Strategy

**Can run in parallel** (independent):
- Item 1 (unified calendar) — independent new page
- Item 2 (location filter) — independent, same pattern as sport filter
- Items 3-5 (hook/utility extraction) — independent files
- Items 6, 9, 11 (reports links, empty states, kits placeholder) — independent pages

**Must be sequential**:
- Item 7 (dashboard decomposition) benefits from Items 3-5 but is not strictly blocked
- Item 8 (visibility refresh) depends on Item 4 (`useFetch` hook)
- Item 10 (form standardization) benefits from Item 5

### Effort Estimates

| Size | Definition | Example |
|------|-----------|---------|
| **XS** | < 1 hour, single file | Kits placeholder page |
| **S** | 1-3 hours, 1-3 files | Hook extraction, filter chip, drill-down links |
| **M** | 3-8 hours, 3-8 files | Dashboard decomposition, form standardization |
| **L** | 1-3 days, 8+ files | Kit management UI (4 slices), React Query migration, unified search |

---

## Change Log
- 2026-03-23: Initial system roadmap created. Full architecture analysis, three-version plan, cross-cutting feature matrix, data strategy, dependency graph, risk assessment, and implementation order.
