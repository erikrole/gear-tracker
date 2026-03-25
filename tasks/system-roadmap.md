# Gear Tracker — System Roadmap

## Document Control
- Author: System Architecture Review
- Date: 2026-03-24
- Status: Living roadmap — update when shipping features or revising priorities
- Scope: Full-system analysis and three-version evolution plan
- Previous: 2026-03-23 (V1 planning); this revision reflects V1 completion and V2 planning

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
| **Booking** (checkouts, reservations, drafts) | `/checkouts`, `/reservations`, `/bookings/[id]` | **Solid** | Unified detail page, reference numbers, scan flow, partial check-in, equipment picker V2 |
| **Inventory** (items, bulk SKUs, accessories) | `/items`, `/items/[id]`, `/bulk-inventory` | **Solid** | DataTable with sort/filter, derived status, numbered bulk units, parent-child accessories, 9-field search |
| **Kits** (equipment grouping) | `/kits`, `/kits/[id]` | **MVP** | V1 shipped: CRUD, member management, search, archive/restore. V2: checkout integration |
| **Events** (calendar, ICS sync) | `/events/[id]`, `/schedule` | **Solid** | ICS ingest, unified schedule page (merged /events + /schedule), D-026/D-027 accepted |
| **Users** (roles, profiles) | `/users`, `/users/[id]` | **Solid** | Tiered RBAC, profile merged into user detail, 5-pass hardened, stress-tested |
| **Shifts** (scheduling, trades) | `/schedule` | **Solid** | Auto-generation, trade board, gear integration, event command center, V2 enhancements |
| **Dashboard** (ops console) | `/` | **Polished** | V3 shipped, decomposed into hooks + 7 leaf components, sport/location filters, saved filters, overdue banner, drafts |
| **Notifications** (escalation, email) | `/notifications` | **MVP** | In-app + email dual-channel, 4 escalation triggers, dedup, pagination, mark-as-read |
| **Reports** | `/reports/*` | **MVP** | 4 report types (checkouts, overdue, utilization, audit), URL-persisted filters, drill-down links, data freshness |
| **Settings** (admin config) | `/settings/*` | **Solid** | Categories, sports, escalation, calendar sources, venue mappings, DB diagnostics |
| **Import** | `/import` | **Solid** | Generic CSV with Cheqroom preset, dry-run, lossless, batched DB ops |
| **Search** | `/search`, Cmd+K | **MVP** | Command palette searches assets/checkouts/reservations; no unified cross-domain |
| **Scan** | `/scan` | **Solid** | 5-pass hardened, optimistic updates, auto-clear feedback, spam-click guards |
| **Labels** | `/labels` | **Scaffold** | Label generation exists but not linked from other workflows |

---

## STEP 2: CURRENT ARCHITECTURE

### Pages & Flows

**Complete page tree** (20+ pages under `(app)/`):

| Page | Primary Flow | Inbound From | Outbound To |
|------|-------------|--------------|-------------|
| `/` (Dashboard) | Daily ops triage | Login, sidebar | Checkout/reservation detail, scan, schedule |
| `/checkouts` | Browse all checkouts | Sidebar, dashboard | Checkout detail, create checkout |
| `/reservations` | Browse all reservations | Sidebar, dashboard | Reservation detail, create reservation |
| `/checkouts/[id]` | Checkout detail + actions | Dashboard row, list row, search | Scan, item detail, user detail |
| `/reservations/[id]` | Reservation detail + actions | Dashboard row, list row, search | Item detail, user detail, convert to checkout |
| `/items` | Browse/manage inventory | Sidebar | Item detail, create item |
| `/items/[id]` | Item detail + history | Items list, scan, search | Checkout/reservation links, QR, labels |
| `/kits` | Kit management | Sidebar (staff+) | Kit detail |
| `/kits/[id]` | Kit detail + members | Kits list | Item detail (member links) |
| `/schedule` | Events + shifts + trades | Sidebar | Shift detail panel, trade board, event command center |
| `/events/[id]` | Event detail | Schedule page | Command center, shift assignments |
| `/scan` | QR scan entry point | Sidebar, dashboard, mobile nav | Item detail, checkout detail |
| `/users` | User management | Sidebar | User detail |
| `/users/[id]` | User detail + activity | Users list, profile redirect | Booking links |
| `/profile` | Redirect → `/users/{id}` | Sidebar | User detail |
| `/notifications` | Notification center | Header bell icon | Booking detail links |
| `/reports/*` | Operational metrics (4 sub-pages) | Sidebar | Checkout/reservation lists (drill-down links) |
| `/settings/*` | Admin configuration (6 sub-pages) | Sidebar | — |
| `/import` | CSV import pipeline | Sidebar | Items list (post-import) |
| `/labels` | Label generation | Sidebar | — |
| `/search` | Cross-entity search | Cmd+K, sidebar | Item/booking detail |
| `/bulk-inventory` | Bulk SKU management | Sidebar | — |

**Navigation Health**:
- **Dead ends eliminated**: Reports pages now have drill-down links to filtered booking lists (shipped 2026-03-24)
- **Remaining dead ends**: `/labels` (no outbound links to items), `/bulk-inventory` (limited cross-linking)
- **Remaining weak links**: `/labels` not reachable from item detail ("Print label" action missing)

### Page Size Analysis (Decomposition Candidates)

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `/scan` | 1,038 | **Needs decomposition** | Largest page; scan logic + UI + state interleaved |
| `/schedule` | 1,012 | **Needs decomposition** | Calendar + list + trade board + filters in one file |
| `/import` | 701 | Acceptable | Multi-step wizard; natural complexity |
| `/items/[id]` | 700 | Acceptable | 6 tabs; extract tabs into components for V2 |
| `/kits/[id]` | 588 | Acceptable | Recently shipped; monitor growth |
| `/events/[id]` | 475 | Acceptable | Event detail + command center |
| `/bulk-inventory` | 440 | Acceptable | CRUD page |
| `/users/[id]` | 422 | Acceptable | 2 tabs + inline editing |
| `/items` | 420 | Acceptable | DataTable + toolbar + bulk actions |
| `/` (Dashboard) | 262 | **Decomposed** | Down from 1,004 lines; hooks + 7 leaf components extracted |

### Shared Components & Patterns

**Consistent patterns (established)**:
- `withAuth()` / `withHandler()` API route decorators — all 106 routes use these
- `requirePermission()` enforcement on all mutation endpoints
- `createAuditEntry()` on all mutations (D-007, verified in hardening passes)
- shadcn/ui components system-wide (43 components installed)
- `AbortController` fetch pattern on all client pages (prevents race conditions)
- Refresh-preserves-data pattern (toast on failure, not error screen wipe)
- `BookingDetailPage` unified for checkout + reservation detail via `kind` prop
- `InlineTitle` + `SaveableField` / `useSaveField` pattern for inline edits
- `useBookingDetail` + `useBookingActions` hooks for booking pages
- Toast feedback on all mutations via Sonner
- High-fidelity skeletons on all list pages
- 401 → login redirect on all fetch calls
- Error differentiation (network vs server) on all hardened pages

**Extracted shared hooks (V1 foundation)**:
- `useFetch<T>(url, options)` — standardized loading/error/refresh with AbortController + Page Visibility API refresh
- `useUrlState(key, defaultValue)` — URL-persisted state via `useSearchParams` + `replaceState`
- `useFormSubmit(schema, endpoint)` — Zod validation → fetch → error classification → toast → per-field errors
- `useDashboardData()` / `useDashboardFilters()` — dashboard-specific data + filter state
- `useMobile()` — responsive breakpoint detection

**Remaining inconsistencies**:
- **Page decomposition**: Dashboard decomposed; scan (1,038 lines) and schedule (1,012 lines) still monolithic
- **Hook adoption**: `useFetch`, `useUrlState`, `useFormSubmit` extracted but not yet adopted by all pages — existing pages still use inline fetch + useState patterns
- **Data fetching**: Some pages use dedicated init endpoints (`/api/items-page-init`), others make multiple parallel fetches. No SWR/React Query.
- **Empty states**: Most pages use shadcn `<Empty>` component; some stragglers may still have inline "No data" text

### Schema Surface Coverage

| Model | UI Status | Notes |
|-------|-----------|-------|
| Kit, KitMembership | **V1 Shipped** | List + detail pages, CRUD, member management |
| LocationMapping | **Admin UI** | `/settings/venue-mappings` with CRUD, pattern validation (D-027) |
| SystemConfig | **Zero UI** | Key-value config store, no settings surface |
| FavoriteItem | **Partial** | API exists (`/api/assets/[id]/favorite`), no favorites page/filter |
| EscalationRule | **Admin UI** | `/settings/escalation` with trigger management |

### API Surface (106 Routes)

| Category | Count | Notes |
|----------|-------|-------|
| Auth | 5 | Login, register, logout, forgot/reset password |
| Assets | 15 | CRUD + accessories + duplicate + QR + image + maintenance + retire + insights + brands + bulk + import + export |
| Bookings | 17 | CRUD + cancel + extend + availability check + reservations (CRUD + cancel + convert + duplicate) |
| Checkouts | 12 | CRUD + scan + scan-status + start-scan + checkin (scan/items/bulk/complete) + complete-checkout + admin-override |
| Bulk SKUs | 7 | CRUD + adjust + convert-to-numbered + units (CRUD) |
| Calendar | 7 | Events CRUD + sources CRUD + sync + command center |
| Shifts | 15 | Shifts + shift-groups + assignments (CRUD + approve/decline/swap/request) + trades (CRUD + claim) + my-shifts |
| Users | 7 | CRUD + activity + role + reset-password + me + profile + avatar |
| Admin Config | 10 | Locations + categories + departments + sport-configs + roster + student-areas + location-mappings |
| Kits | 4 | CRUD + members |
| Notifications | 4 | List + nudge + process + escalation settings |
| Reports | 1 | POST with type parameter |
| Other | 7 | Items-page-init, drafts (CRUD), migrate, seed, db-diagnostics, cron/notifications |

---

## STEP 3: SYSTEM VERSION ROADMAP

### V1 — Cohesive Foundation ✅ COMPLETE

**Goal**: Every page feels like it belongs to the same product. Consistency and reliability across the system.

**Status**: All V1 items shipped as of 2026-03-24. The system has a consistent foundation.

#### 3.1 Extract Shared Patterns ✅ Shipped

| Pattern | Implementation | Status |
|---------|---------------|--------|
| URL state management | `useUrlState(key, defaultValue)` in `src/hooks/use-url-state.ts` | ✅ Shipped |
| Fetch + loading/error | `useFetch<T>(url, options)` in `src/hooks/use-fetch.ts` with AbortController + Visibility API | ✅ Shipped |
| Error classification | `classifyError(error)` in `src/lib/errors.ts` | ✅ Shipped |
| Form handling | `useFormSubmit(schema, endpoint)` in `src/hooks/use-form-submit.ts` — Zod + toast + per-field errors | ✅ Shipped |
| Page init pattern | Consolidated init endpoints for complex pages (`/api/items-page-init`) | ✅ Shipped |

#### 3.2 Complete Missing States ✅ Shipped

- ✅ Reports drill-down links — MetricCards link to filtered checkout/reservation lists
- ✅ Kits page — full V1 shipped (list + detail + CRUD + member management)
- Remaining (deferred to V2): Labels cross-linking from item detail, bulk inventory → item detail navigation

#### 3.3 Page Decomposition ✅ Shipped (Dashboard)

Dashboard decomposed from 1,004 lines to 262 lines:
- `use-dashboard-data.ts`, `use-dashboard-filters.ts` hooks extracted
- 7 leaf components: `OverdueBanner`, `StatStrip`, `FilterChips`, `MyGearColumn`, `TeamActivityColumn`, `DraftSection`, `SkeletonDashboard`

#### 3.4 Dashboard Filters ✅ Shipped

- Sport filter chips (URL-persisted `?sport=MBB`, client-side filtering, contextual empty states)
- Location filter chips (URL-persisted `?location=Camp+Randall`, field name normalization across domains)
- Saved filters (localStorage presets, save/apply/delete)

#### 3.5 Unified Calendar Page ✅ Shipped 2026-03-23

- Events + Schedule merged into `/schedule` (calendar + list + trade board tabs)
- Old `/events` list page removed; detail page `/events/[id]` unchanged
- Venue Mappings → `/settings/venue-mappings`; Calendar Sources → `/settings/calendar-sources`

#### 3.6 Kit Management V1 ✅ Shipped 2026-03-24

- Kit CRUD, member management via asset search, equipment section grouping
- Archive/restore, audit logging on all mutations
- List page (search, location filter, pagination, sort) + detail page (inline edit, member add/remove)

#### V1 Remaining Polish (Low Priority)

These V1 items are minor and can be addressed opportunistically:
- `CategoryRow` inline rename → should use `SaveableField` pattern (per lessons.md)
- Raw `<select>` audit → ensure all use shadcn `<Select>` or `<NativeSelect>`
- Labels cross-linking ("Print label" from item detail → `/labels?items=id`)

---

### V2 — Connected Experience (ACTIVE)

**Goal**: Reduce friction between pages. The system remembers context, reduces manual work, and surfaces actionable information proactively.

#### 3.7 Page Decomposition — Scan & Schedule (Size: M)

Two pages exceed 1,000 lines and need the same treatment dashboard received:

**Scan page** (1,038 lines → target ~300):
- Extract `useScanSession()` hook (scan state machine, QR handling, session lifecycle)
- Extract `ScanFeedback` component (success/error/warning states)
- Extract `ScanChecklist` component (item list with check-off state)
- Extract `ScanControls` component (camera controls, manual entry)

**Schedule page** (1,012 lines → target ~300):
- Extract `useScheduleData()` hook (events + shifts + coverage computation)
- Extract `CalendarView` component (month grid + coverage dots)
- Extract `ListView` component (date-grouped events + coverage badges)
- Extract `ScheduleFilters` component (sport, area, coverage, past events toggle)

**Why now**: Both pages will grow with V2 features (inline actions, richer filters). Decomposition must happen before adding complexity, not after.

#### 3.8 Hook Adoption Across Pages (Size: M)

Shared hooks exist but most pages still use inline fetch + useState. Migrate incrementally:

| Hook | Pages to Migrate | Priority |
|------|-----------------|----------|
| `useFetch` | scan, schedule, notifications, bulk-inventory, labels | High — eliminates copy-pasted AbortController patterns |
| `useUrlState` | schedule (view mode, filters), notifications (unread filter) | Medium — already URL-persisted in some, standardize |
| `useFormSubmit` | checkout creation, reservation creation, settings forms | High — highest-traffic forms benefit most |

**Migration strategy**: One page per slice. Each migration is independently testable and mergeable.

#### 3.9 Inline Dashboard Actions (Size: M)

Dashboard is decomposed and ready for inline actions:

- **Overdue quick actions**: Extend and check-in buttons directly on overdue rows
  - Extend: `POST /api/bookings/[id]/extend` — API exists
  - Check-in all: `POST /api/checkouts/[id]/checkin-items` — API exists
  - Confirm dialog inline, success toast, row updates optimistically
- **Reservation convert**: "Start checkout" button on reservation dashboard rows
  - `POST /api/reservations/[id]/convert` — API exists
- **Notification actions**: Each notification row gets a primary CTA (View booking, Check in, Extend)

#### 3.10 Cross-Page State Awareness (Size: L)

Reduce the "amnesia" between pages:

- **Event context propagation**: Event Command Center → Create Checkout passes `?eventId=X` in URL; checkout form pre-selects event
- **Scroll position preservation**: Dashboard → detail sheet → back preserves scroll (currently resets)
- **Notification deep-links**: Overdue notification links to booking detail with check-in action pre-highlighted
- **Item availability timeline**: Item detail calendar tab shows conflict warnings for overlapping reservations
- **Kit → booking context**: Kit detail "Check out this kit" button pre-fills equipment picker with kit members

#### 3.11 Smarter Defaults & Persistence (Size: M)

- **Remember filters**: Last-used sport/location filter stored in `localStorage`, restored on load (URL param overrides)
- **Auto-select current event**: During active event, checkout creation pre-selects it (not just shows first)
- **Reservation draft support**: Extend DRAFT booking state to reservation creation (currently checkout-only via D-017)
- **Recent searches**: Cmd+K remembers last 5 searches in localStorage

#### 3.12 Notification System Completion (Size: M)

Phase B remaining items:

- **Multi-recipient escalation**: D-009 accepted — +24h escalation to requester + all admins
- **Alert fatigue controls**: Admin-configurable escalation intervals + per-booking caps (settings page)
- **Actionable notifications**: Each notification has primary CTA button (View booking, Check in, Extend)
- **Sidebar badge**: Unread notification count in sidebar nav (API exists: `/api/notifications?unread=true`)

#### 3.13 Unified Search V2 (Size: L)

- Current: Cmd+K searches assets, checkouts, reservations in separate sections
- Target: Single search returning results across all domains with type indicators
- Include: items, checkouts, reservations, users, events, kits
- Backend: Server-side search endpoint returning mixed results (avoid client-side filtering at scale)
- UX: Keyboard-navigable, recent searches, type-ahead, category filters
- Enables "find anything" workflow — critical for staff acting fast during game day

#### 3.14 Kit Checkout Integration (Size: L)

Kit V2 — connect kits to the booking system:

- **Kit-based checkout**: Select kit → auto-populate equipment picker with all kit members
- **Kit availability**: Derived from member items' allocation status (all available = kit available)
- **Kit dashboard card**: "Kits ready for today" widget showing kit status for upcoming events
- **Kit-to-booking linking**: `kitId` FK on Booking for tracking kit-level checkouts

#### 3.15 Phase B Completion (Size: S-M)

Remaining Phase B items from NORTH_STAR.md:

- **Student availability tracking**: Students declare unavailable dates; shifts skip unavailable students during auto-generation
- **Shift email notifications**: Email channel for trade claims and shift assignment changes (V1 = in-app only)

---

### V3 — Intelligent System

**Goal**: The system anticipates needs, automates repetitive tasks, and provides operational intelligence.

#### 3.16 React Query Migration (Size: L)

Replace manual `useState` + `fetch` + `AbortController` with React Query:
- Automatic shared cache — Dashboard → Detail → Dashboard reuses cached data instead of 3 full fetches
- Background refresh with stale-while-revalidate
- Optimistic updates with automatic rollback
- Request deduplication across components
- **Migration path**: One page at a time, starting with dashboard (highest traffic)
- **Prerequisite**: V2 hook adoption should be complete first — `useFetch` is the stepping stone to React Query

#### 3.17 Game-Day Mode (Size: L)

Dashboard adapts when an event is within 4 hours:

- **Game-Day Readiness Score**: Aggregate metric (shift coverage % + gear checkout % + overdue count)
- **Prominent display**: Shift coverage, gear readiness, outstanding checkouts shown above normal dashboard
- **Time-of-day adaptation**: Morning = upcoming today. Evening = overdue + tomorrow prep.
- **Role-specific emphasis**: Students see My Gear first (already true). Staff see readiness score. Admins see system health.

#### 3.18 Automation (Size: L)

- **Auto-generate bookings from recurring events**: Football Home always needs Camera Kit A → auto-create reservation when event syncs
- **Bulk check-in by scan session**: Scan all items → system matches to open bookings → one-tap confirm all returns
- **Scheduled notifications**: "Tomorrow you have MBB at Kohl Center — your gear is reserved" (evening before game day)
- **Shift → checkout auto-linking**: Shift assignment auto-creates checkout reservation for standard kit per area

#### 3.19 Operational Intelligence (Size: L)

- **Usage analytics**: Most-used items, peak checkout times, average duration by sport
- **Equipment health scoring**: Age + usage frequency + maintenance history + damage reports
- **Peak usage prediction**: Historical data → forecast busy periods → suggest pre-staging gear
- **Loss/damage trends**: Which items/categories have highest loss rates
- **Audit log search**: Admin UI for searching/filtering audit entries (currently read-only timeline)

#### 3.20 Deeper Integration (Size: L)

- **Event changes cascade**: Rescheduled event updates all linked bookings' dates (with confirmation dialog)
- **Maintenance scheduling**: Track usage hours, suggest maintenance intervals, auto-flag overdue service
- **Multi-source event ingestion**: Beyond UW Badgers ICS (Phase C from NORTH_STAR.md)
- **Admin-configurable equipment guidance**: Database rules replacing code-defined rules in `equipment-guidance.ts` (D-016 Phase C)

---

## STEP 4: CROSS-CUTTING FEATURES

| Feature | Current State (V1 Complete) | V2 Target | V3 Target |
|---|---|---|---|
| **Error handling** | `classifyError()` extracted; most pages differentiate network vs server | Migrate all pages to shared utility; automatic retry for transient failures | React Query handles retries automatically |
| **Loading states** | High-fidelity skeletons on all hardened pages | Ensure scan, schedule, kits, bulk-inventory have skeletons after decomposition | Streaming/suspense boundaries for progressive loading |
| **Empty states** | shadcn `<Empty>` on most pages; audit completed 2026-03-24 | Context-aware empty states ("No checkouts for MBB — create one?") | Proactive suggestions based on user role and current event |
| **Toast notifications** | Sonner on all mutations; success/error patterns established | Standardize messages (success: past tense verb, error: what + retry); undo on destructive toasts | — |
| **Confirmation dialogs** | AlertDialog on all destructive actions (draft discard, delete, cancel) | Batch confirmations ("Cancel 3 selected reservations?") | — |
| **Form validation** | `useFormSubmit` hook with Zod schemas; applied to Create User dialog | Adopt across all create/edit forms (checkout, reservation, kit, settings) | Inline field-level validation with debounced server checks |
| **RBAC enforcement** | `requirePermission()` on all mutations; UI hides/disables per role; stress-tested | No gaps — maintain coverage on new features | Row-level security if multi-tenant scope expands |
| **Audit logging** | `createAuditEntry()` on all mutations (verified in hardening + stress tests) | No gaps — maintain coverage | Audit log search/filter UI for admins |
| **Mobile responsiveness** | All pages validated against AREA_MOBILE.md; 44px+ tap targets; iOS fixes | Validate new V2 features (inline actions, decomposed pages) | PWA with offline read cache |
| **Keyboard accessibility** | Cmd+K command palette; tab keyboard shortcuts (1-N) on item detail | Audit tab order; keyboard shortcuts on all detail pages | Full shortcut layer (J/K navigation, Enter to open, Esc to close) |

---

## STEP 5: DATA & STATE STRATEGY

### Current State

| Layer | Pattern | Used By |
|-------|---------|---------|
| **Server state** | `fetch()` + `useState` + `useEffect` + `AbortController` | All pages (extracted hooks available but not universally adopted) |
| **URL state** | `useUrlState` hook + `useSearchParams` | Dashboard (sport/location filters), reports (filters), items (filters) |
| **Local state** | `useState` for form inputs, modals, loading flags | All pages |
| **Derived state** | `useMemo` for filtered/sorted views | Dashboard (filtered sections), items (derived status) |
| **Persisted local** | `localStorage` for saved filters, view mode, My Shifts toggle | Dashboard, schedule |
| **No shared cache** | Each page re-fetches on mount; no cross-page cache | All pages |

### How Data Flows Across Pages

- **Re-fetch on mount**: Every page fetches fresh data. Dashboard → Checkout Detail → Dashboard = 3 full fetches.
- **URL params for context**: `?sport=MBB`, `?draftId=X`, `?eventId=X`, `?location=Camp+Randall` pass minimal context.
- **Detail sheets**: `BookingDetailsSheet` receives ID, fetches own data. Parent refreshes on close via `onUpdated`.
- **Visibility refresh**: `useFetch` hook includes Page Visibility API — re-fetches when tab becomes active.
- **No WebSocket/SSE**: All data is request-response. No real-time updates across tabs.

### Data Risks

| Risk | Severity | Current Mitigation | V2 Recommendation |
|------|----------|-------------------|-------------------|
| **Stale data across tabs** | Medium | Visibility API refresh in `useFetch` | Migrate pages to `useFetch` to get this benefit universally |
| **Re-fetch on every navigation** | Medium | No shared cache | V3: React Query with stale-while-revalidate |
| **Race conditions on mutations** | Low | SERIALIZABLE transactions + P2034 retry | Adequate |
| **N+1 queries** | Low | Consolidated init endpoints where needed | Audit schedule and events pages |
| **Unbounded result sets** | Low | Pagination on all list pages (50 default, 200 max) | Adequate |
| **Audit log growth** | Low | No retention policy | Monitor quarterly; archival at 10x scale |
| **Optimistic update inconsistency** | Low | Used for draft delete, checkin; rollback on failure | V3: React Query handles automatically |

### Recommendations by Version

**V2** (no new dependencies):
- Migrate all pages to `useFetch` hook — gets AbortController, Visibility API refresh, error classification for free
- Audit schedule and events pages for unnecessary parallel fetches
- Add section-level caching on dashboard if performance degrades

**V3** (adopt React Query):
- Replace `useFetch` with React Query's `useQuery` — automatic cache, background refresh, deduplication
- Migration path: one page at a time, starting with dashboard
- Shared cache eliminates re-fetch-on-every-navigation problem

**V3+** (real-time):
- Server-Sent Events for dashboard overdue count and checkout status changes
- Only justified for game-day mode or multi-user concurrent operations

---

## STEP 6: DEPENDENCIES & ORDER

### V2 Dependency Graph

```
Page Decomposition (scan, schedule)
        │
        └──→ Hook adoption (useFetch, useFormSubmit across pages)
                    │
                    ├──→ Inline dashboard actions (dashboard already decomposed)
                    ├──→ Cross-page state awareness (URL params, scroll preservation)
                    └──→ Notification system completion (D-009 escalation)

Independent (no blockers):
        ├──→ Smarter defaults & persistence (localStorage patterns)
        ├──→ Labels cross-linking (item detail → labels)
        ├──→ Student availability tracking
        ├──→ Shift email notifications
        └──→ Unified search V2 (new endpoint + Cmd+K upgrade)

Sequential:
        Kit checkout integration ──→ requires Kit V1 ✅ ──→ booking system linking
        React Query migration ──→ requires hook adoption complete ──→ V3
```

### What Blocks V2 Improvements

| Blocker | What It Blocks | Effort |
|---------|---------------|--------|
| Scan/schedule decomposition | Adding features to these pages without increasing complexity | M |
| Hook adoption across pages | Consistent behavior (Visibility refresh, error handling) on all pages | M (incremental) |
| D-009 finalization (recipient model) | Multi-recipient escalation, alert fatigue controls | S (decision, not code) |

### V2 Quick Wins (Ship Independently)

| Item | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Labels cross-linking from item detail | S | Low-Medium — completes the flow | None |
| Sidebar notification badge | S | Medium — unread count visible globally | API exists |
| Notification deep-links | S | Medium — notifications become actionable | None |
| Event context propagation (eventId URL param) | S | Medium — fewer manual selections | None |
| Recent searches in Cmd+K | S | Low — power user convenience | None |
| Student availability tracking | M | Medium — shift generation respects availability | None |

---

## STEP 7: RISKS & COMPLEXITY

### Overengineering Risks

| Idea | Risk Level | Reasoning |
|------|-----------|-----------|
| Predictive gear suggestions (V3) | High | Requires historical data at scale; team is small. Rule-based per sport sufficient. |
| Real-time SSE/WebSocket (V3) | Medium | Only for multi-user concurrent ops (game day). Polling + visibility refresh covers 90%. |
| PWA offline mode (V3) | Medium | Students have reliable campus WiFi. Offline mutations add complexity for rare benefit. |
| Equipment health scoring (V3) | Low | Valuable but requires structured maintenance data that doesn't exist yet. |
| React Query before hook adoption | High | Premature abstraction. `useFetch` is the V2 stepping stone; migrate to React Query in V3. |

### Tight Coupling Concerns

- **Dashboard ↔ API shape**: Dashboard fetches monolithic `DashboardData` object. New sections require API changes. V2 should break into independent section endpoints if performance degrades.
- **BookingDetailPage ↔ booking-actions.ts**: Action gating tightly coupled to status enum. Status vocabulary (D-025) adds translation layer that must stay in sync.
- **Equipment sections/guidance ↔ code**: D-016 keeps rules in code. Fine for V1/V2 but blocks operator self-service. Phase C should deliver admin-configurable rules.
- **Scan page monolith**: At 1,038 lines, any bug fix or feature addition risks unintended side effects. Decomposition is a safety concern, not just aesthetics.

### Scaling Considerations

| Dimension | Current | 2x Users | 10x Inventory |
|-----------|---------|----------|---------------|
| Page load time | Fast (Neon serverless, paginated) | Fine — stateless serverless | Need cursor-based pagination for items list |
| Dashboard query | Single API call, all sections | May need lazy-loaded sections | Need section-level caching |
| Search | Client-side filter in Cmd+K | Fine | Need server-side full-text search (Postgres `tsvector`) |
| Audit log | Unbounded growth | Fine short-term | Need retention policy or archival |
| Notification volume | Cron every 15min, dedup by booking | Fine | Fine — dedup prevents explosion |
| API route count | 106 routes | Fine | Fine — no consolidation needed yet |

### Scope Creep Boundaries

The V2/V3 boundary is most likely to blur on:
- **React Query adoption** being requested during V2 hook migration — resist; `useFetch` is the stepping stone
- **Game-Day Mode** being pulled into V2 because the readiness score seems "simple" — it requires significant dashboard rework
- **Kit checkout integration** expanding into kit templates and kit scheduling — keep V2 scope to basic kit-to-booking linking only
- **Unified search** expanding into Postgres full-text — client-side is fine for current inventory size; defer `tsvector` until 10x scale

---

## STEP 8: IMPLEMENTATION STRATEGY

### Recommended V2 Order (Highest Impact → Lowest)

| # | Item | Effort | Impact | Dependencies |
|---|------|--------|--------|-------------|
| 1 | **Scan page decomposition** | M | High — unblocks scan feature work, reduces bug risk | None |
| 2 | **Schedule page decomposition** | M | High — unblocks schedule feature work | None |
| 3 | **Hook adoption (useFetch → scan, schedule, notifications)** | M | High — Visibility refresh + error handling everywhere | Benefits from 1-2 |
| 4 | **Inline dashboard actions** | M | High — overdue extend/checkin without navigation | Dashboard already decomposed |
| 5 | **Notification system completion (D-009)** | M | Medium — multi-recipient escalation, alert fatigue | None |
| 6 | **Cross-page state awareness** | M | Medium — event context, scroll preservation | None |
| 7 | **Smarter defaults & persistence** | S | Medium — remember filters, auto-select events | None |
| 8 | **Sidebar notification badge** | S | Medium — unread count visible globally | None |
| 9 | **Student availability tracking** | M | Medium — shift generation improvements | None |
| 10 | **Kit checkout integration** | L | Medium — connect kits to booking system | Kit V1 ✅ |
| 11 | **Unified search V2** | L | Medium — cross-domain search for power users | None |
| 12 | **Shift email notifications** | S | Low — email for trade claims | None |

### Parallelization Strategy

**Can run in parallel** (independent):
- Items 1-2 (scan + schedule decomposition) — different files, no overlap
- Items 5, 7, 8, 9, 12 (notifications, defaults, badge, availability, shift email) — independent domains
- Item 6 (cross-page awareness) — touches URL params, not page internals

**Must be sequential**:
- Item 3 (hook adoption) benefits from Items 1-2 (decomposed pages are easier to migrate)
- Item 4 (inline actions) can start immediately but benefits from Item 3 (useFetch on dashboard sections)
- Item 10 (kit checkout) depends on Item 4 being pattern-established
- Item 11 (unified search) should wait until other V2 items ship to avoid scope expansion

### Effort Estimates

| Size | Definition | Example |
|------|-----------|---------|
| **S** | 1-3 hours, 1-3 files | Sidebar badge, labels cross-linking, smart defaults |
| **M** | 3-8 hours, 3-8 files | Page decomposition, hook adoption, inline actions, D-009 |
| **L** | 1-3 days, 8+ files | Kit checkout integration, unified search V2, React Query migration |

---

## Change Log
- 2026-03-23: Initial system roadmap created. Full architecture analysis, three-version plan, cross-cutting feature matrix, data strategy, dependency graph, risk assessment, and implementation order.
- 2026-03-24: V2 revision. V1 marked complete (all items shipped: shared hooks, dashboard decomposition, dashboard filters, kit V1, reports drill-down, unified schedule, form standardization). Domain maturity levels updated (Kits: Scaffold→MVP, Dashboard: Solid→Polished, Events: MVP→Solid). V2 plan detailed with scan/schedule decomposition, hook adoption, inline actions, notification completion. New systemic observations: page size analysis (scan 1038, schedule 1012 lines), API surface inventory (106 routes), schema coverage audit. V3 items refined (React Query, Game-Day Mode, automation, operational intelligence).
