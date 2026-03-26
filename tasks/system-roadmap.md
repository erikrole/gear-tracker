# Gear Tracker — System Roadmap

## Document Control
- Author: System Architecture Review
- Date: 2026-03-26
- Status: Living roadmap — update when shipping features or revising priorities
- Scope: Full-system analysis and three-version evolution plan
- Previous: 2026-03-24 (V2 planning); this revision reflects V2 near-completion and V3 planning

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
| **Booking** (checkouts, reservations, drafts) | `/checkouts`, `/reservations`, `/bookings/[id]` | **Polished** | Unified detail page, ref numbers, scan flow, partial check-in, equipment picker V2, kit integration, overdue priority sort |
| **Inventory** (items, bulk SKUs, accessories) | `/items`, `/items/[id]`, `/bulk-inventory` | **Solid** | DataTable with sort/filter, derived status, numbered bulk units, parent-child accessories, 9-field search |
| **Kits** (equipment grouping) | `/kits`, `/kits/[id]` | **Solid** | V1 CRUD + member management shipped. V2 kit-to-booking integration shipped (kitId FK, selector, display) |
| **Events** (calendar, ICS sync) | `/events/[id]`, `/schedule` | **Solid** | ICS ingest, unified schedule page, D-026/D-027 accepted, event detail hardened |
| **Users** (roles, profiles) | `/users`, `/users/[id]` | **Solid** | Tiered RBAC, profile merged into user detail, 5-pass hardened, stress-tested |
| **Shifts** (scheduling, trades) | `/schedule` | **Polished** | Decomposed (1,012→117 lines), auto-generation, trade board, gear integration, V2 enhancements |
| **Dashboard** (ops console) | `/` | **Polished** | V3 shipped, decomposed into hooks + 7 leaf components, sport/location filters, saved filters, overdue banner, drafts |
| **Notifications** (escalation, email) | `/notifications` | **MVP** | In-app + email dual-channel, 4 escalation triggers, dedup, pagination, mark-as-read |
| **Reports** | `/reports/*` | **MVP** | 5 report types (checkouts, overdue, utilization, audit, scans), URL-persisted filters, drill-down links |
| **Settings** (admin config) | `/settings/*` | **Solid** | Categories, sports, escalation, calendar sources, venue mappings, DB diagnostics |
| **Import** | `/import` | **Solid** | Generic CSV with Cheqroom preset, dry-run, lossless, batched DB ops |
| **Search** | `/search`, Cmd+K | **MVP** | Command palette searches assets/checkouts/reservations; no unified cross-domain |
| **Scan** | `/scan` | **Polished** | Decomposed (1,038→251 lines), 5-pass hardened, optimistic updates, spam-click guards |
| **Labels** | `/labels` | **Scaffold** | Label generation exists; linked from item detail context menu but isolated |

---

## STEP 2: CURRENT ARCHITECTURE

### Pages & Flows

**Complete page tree** (34 pages under `(app)/`):

| Page | Primary Flow | Inbound From | Outbound To |
|------|-------------|--------------|-------------|
| `/` (Dashboard) | Daily ops triage | Login, sidebar | Checkout/reservation detail, scan, schedule |
| `/checkouts` | Browse all checkouts | Sidebar, dashboard | Checkout detail, create checkout |
| `/checkouts/[id]` | Checkout detail + actions | Dashboard row, list row, search | Scan, item detail, user detail |
| `/reservations` | Browse all reservations | Sidebar, dashboard | Reservation detail, create reservation |
| `/reservations/[id]` | Reservation detail + actions | Dashboard row, list row, search | Item detail, user detail, convert to checkout |
| `/bookings` | Unified booking list | Sidebar | Booking detail |
| `/items` | Browse/manage inventory | Sidebar | Item detail, create item |
| `/items/[id]` | Item detail + history | Items list, scan, search | Checkout/reservation links, QR, labels |
| `/kits` | Kit management | Sidebar (staff+) | Kit detail |
| `/kits/[id]` | Kit detail + members | Kits list | Item detail (member links) |
| `/schedule` | Events + shifts + trades | Sidebar | Shift detail panel, trade board, event detail |
| `/events/[id]` | Event detail + command center | Schedule page | Shift assignments, bookings |
| `/scan` | QR scan entry point | Sidebar, dashboard, mobile nav | Item detail, checkout detail |
| `/users` | User management | Sidebar | User detail |
| `/users/[id]` | User detail + activity | Users list, profile redirect | Booking links |
| `/profile` | Redirect → `/users/{id}` | Header avatar | User detail |
| `/notifications` | Notification center | Header bell icon | Booking detail links |
| `/reports` | Report hub | Sidebar | Sub-report pages |
| `/reports/checkouts` | Checkout metrics | Reports hub | Checkout list (drill-down) |
| `/reports/overdue` | Overdue metrics | Reports hub | Checkout list (drill-down) |
| `/reports/utilization` | Utilization metrics | Reports hub | Item list (drill-down) |
| `/reports/audit` | Audit log viewer | Reports hub | — |
| `/reports/scans` | Scan activity | Reports hub | — |
| `/settings` | Admin config hub | Sidebar | Settings sub-pages |
| `/settings/categories` | Category tree CRUD | Settings | — |
| `/settings/sports` | Sport shift configs | Settings | — |
| `/settings/escalation` | Notification rules | Settings | — |
| `/settings/calendar-sources` | ICS source management | Settings | — |
| `/settings/venue-mappings` | Venue→location mapping | Settings | — |
| `/settings/database` | Schema diagnostics | Settings | — |
| `/import` | CSV import pipeline | Sidebar | Items list (post-import) |
| `/labels` | Label generation | Sidebar, item detail context menu | — |
| `/search` | Cross-entity search | Cmd+K, sidebar | Item/booking detail |
| `/bulk-inventory` | Bulk SKU management | Sidebar | — |

**Navigation Health**:
- **Dead ends resolved**: Reports pages have drill-down links; labels linked from item detail
- **Remaining weak links**: `/labels` has limited outbound navigation; `/bulk-inventory` isolated from main item flows; `/reports/audit` and `/reports/scans` no drill-down
- **Orphan risk**: `/bookings` page exists but unclear if sidebar links to it distinctly from checkouts/reservations

### Shared Components & Patterns

**Consistent patterns (established)**:
- `withAuth()` / `withHandler()` API route decorators — all 106+ routes
- `requirePermission()` enforcement on all mutation endpoints
- `createAuditEntry()` on all mutations (D-007, verified in hardening passes)
- shadcn/ui components system-wide (42 components installed)
- `AbortController` fetch pattern on all client pages
- Refresh-preserves-data pattern (toast on failure, not error screen wipe)
- `BookingDetailPage` unified for checkout + reservation detail via `kind` prop
- `InlineTitle` + `SaveableField` / `useSaveField` for inline edits
- Toast feedback on all mutations via Sonner
- High-fidelity skeletons on all list pages
- 401 → login redirect on all fetch calls
- Error differentiation (network vs server) on all hardened pages

**Shared hooks (fully adopted as of 2026-03-25)**:
- `useFetch<T>(url, options)` — loading/error/refresh with AbortController + Page Visibility API
- `useUrlState(key, defaultValue)` — URL-persisted state
- `useFormSubmit(schema, endpoint)` — Zod validation → fetch → error → toast
- `useDashboardData()` / `useDashboardFilters()` — dashboard-specific
- `useScheduleData()` — schedule page data + filtering
- `useScanSession()` / `useScanSubmission()` — scan page state machines
- `useBookingDetail()` / `useBookingActions()` — booking detail pages
- `useMobile()` — responsive breakpoint detection

**Remaining inconsistencies**:
- **Data fetching strategy**: Some pages use dedicated init endpoints (`/api/items-page-init`), others make multiple parallel fetches. No SWR/React Query.
- **Form handling**: `useFormSubmit` extracted but only applied to Create User dialog. Checkout/reservation/kit creation forms still use ad-hoc patterns.
- **Page sizes**: `/import` (701 lines), `/items/[id]` (700 lines), `/kits/[id]` (588 lines), `/events/[id]` (475 lines) are acceptable but items detail should extract tabs into components.
- **Detail page patterns**: Items detail is the gold standard; events detail page diverges somewhat in structure.

### Schema Surface Coverage

| Model | UI Status | Notes |
|-------|-----------|-------|
| Kit, KitMembership | **Solid** | V1 CRUD + V2 booking integration shipped |
| LocationMapping | **Admin UI** | `/settings/venue-mappings` — CRUD, pattern validation (D-027) |
| SystemConfig | **Zero UI** | Key-value config store, no settings surface |
| FavoriteItem | **Partial** | API exists (`/api/assets/[id]/favorite`), no favorites page/filter |
| EscalationRule | **Admin UI** | `/settings/escalation` with trigger management |
| StudentSportAssignment / StudentAreaAssignment | **Read-only** | Displayed on user detail; no CRUD UI for editing |

### API Surface (106+ Routes)

| Category | Count | Notes |
|----------|-------|-------|
| Auth | 5 | Login, register, logout, forgot/reset password |
| Assets | 15 | CRUD + accessories + duplicate + QR + image + maintenance + retire + insights + brands + bulk + export |
| Bookings | 17 | CRUD + cancel + extend + availability check + reservations (CRUD + cancel + convert + duplicate) |
| Checkouts | 12 | Scan suite (scan, scan-status, start-scan, checkin variants, complete) + admin-override |
| Bulk SKUs | 7 | CRUD + adjust + convert-to-numbered + units |
| Calendar | 7 | Events + sources CRUD + sync + command center |
| Shifts | 15 | Shifts + groups + assignments (CRUD + approve/decline/swap/request) + trades |
| Users | 7 | CRUD + activity + role + reset-password + me + profile + avatar |
| Admin Config | 10 | Locations + categories + departments + sport-configs + roster + student-areas + location-mappings |
| Kits | 4 | CRUD + members |
| Notifications | 4 | List + nudge + process + escalation settings |
| Reports | 1 | POST with type parameter |
| Other | 7 | Items-page-init, drafts CRUD, migrate, seed, db-diagnostics, cron |

---

## STEP 3: SYSTEM VERSION ROADMAP

### V1 — Cohesive Foundation ✅ COMPLETE (2026-03-24)

**Goal**: Every page feels like it belongs to the same product. Consistency and reliability across the system.

All V1 items shipped:
- Shared hooks extracted (`useFetch`, `useUrlState`, `useFormSubmit`, `classifyError`)
- Dashboard decomposed (1,004→262 lines; hooks + 7 leaf components)
- Dashboard filters (sport/location chips, saved filters, URL-persisted)
- Unified calendar page (`/schedule` merges events + shifts)
- Kit management V1 (CRUD, member management, search, archive)
- Reports drill-down links (MetricCards → filtered booking/item lists)
- Empty state audit (shadcn `<Empty>` on all pages)
- Form handling pattern established (`useFormSubmit` reference implementation)

---

### V2 — Connected Experience ✅ MOSTLY COMPLETE (2026-03-25)

**Goal**: Reduce friction between pages. The system remembers context, reduces manual work, and surfaces actionable information proactively.

#### V2 Completed Items

| Item | Status | Date | Notes |
|------|--------|------|-------|
| Scan page decomposition | ✅ | 2026-03-25 | 1,038→251 lines; 2 hooks + 4 components + shared types |
| Schedule page decomposition | ✅ | 2026-03-25 | 1,012→117 lines; 1 hook + 3 components + shared types |
| Hook adoption across all pages | ✅ | 2026-03-25 | All data-loading pages migrated to `useFetch`, `useUrlState`, `useDebounce` |
| Kit-to-booking integration | ✅ | 2026-03-25 | `kitId` FK, kit selector in CreateBookingSheet, kit badge on detail |
| Sidebar notification badge | ✅ | 2026-03-24 | Overdue badge on Checkouts, unread badge on Notifications |
| D-009 escalation completion | ✅ | 2026-03-15 | Multi-recipient (+24h → requester + admins), fatigue controls |
| Booking page hardening | ✅ | 2026-03-25 | AbortController, 401 redirect, error differentiation, manual refresh |
| Overdue priority sort | ✅ | 2026-03-25 | Overdue bookings float to top of list pages |
| Labels cross-linking | ✅ | 2026-03-24 | "Print label" in item detail context menu → `/labels?items=id` |
| Event detail hardening | ✅ | 2026-03-25 | 4-pass: design system, data flow, resilience, UX polish |

#### V2 Remaining Items

##### 3.1 Inline Dashboard Actions (Size: M)

Dashboard is decomposed and ready for inline actions:

- **Overdue quick actions**: Extend and check-in buttons directly on overdue rows
  - Extend: `POST /api/bookings/[id]/extend` — API exists
  - Check-in all: `POST /api/checkouts/[id]/checkin-items` — API exists
  - Confirm dialog inline, success toast, row updates optimistically
- **Reservation convert**: "Start checkout" button on reservation dashboard rows
  - `POST /api/reservations/[id]/convert` — API exists
- **Notification actions**: Each notification row gets a primary CTA (View booking, Check in, Extend)

##### 3.2 Cross-Page State Awareness (Size: M)

Reduce the "amnesia" between pages:

- **Event context propagation**: Event Command Center → Create Checkout passes `?eventId=X`; form pre-selects event
- **Scroll position preservation**: Dashboard → detail sheet → back preserves scroll (currently resets)
- **Notification deep-links**: Overdue notification links to booking detail with check-in action pre-highlighted
- **Item availability timeline**: Item detail calendar tab shows conflict warnings for overlapping reservations

##### 3.3 Smarter Defaults & Persistence (Size: S)

- **Remember filters**: Last-used sport/location filter in `localStorage`, restored on load (URL param overrides)
- **Auto-select current event**: During active event, checkout creation pre-selects it
- **Recent searches**: Cmd+K remembers last 5 searches in localStorage

##### 3.4 Student Availability Tracking (Size: M)

- Students declare unavailable dates
- Shift auto-generation skips unavailable students
- Admin override available
- Schema: new `StudentAvailability` model (userId, date, reason)

##### 3.5 Shift Email Notifications (Size: S)

- Email channel for trade claims and shift assignment changes
- V1 = in-app audit only; email extends existing Resend infrastructure
- Non-fatal on failure (same pattern as checkout notifications)

---

### V3 — Intelligent System

**Goal**: The system anticipates needs, automates repetitive tasks, and provides operational intelligence.

#### 3.6 React Query Migration (Size: L)

Replace manual `useState` + `fetch` + `AbortController` with React Query:
- Automatic shared cache — Dashboard → Detail → Dashboard reuses cached data instead of 3 full fetches
- Background refresh with stale-while-revalidate
- Optimistic updates with automatic rollback
- Request deduplication across components
- **Migration path**: One page at a time, starting with dashboard (highest traffic)
- **Prerequisite**: V2 hook adoption complete ✅ — `useFetch` is the stepping stone

#### 3.7 Game-Day Mode (Size: L)

Dashboard adapts when an event is within 4 hours:

- **Game-Day Readiness Score**: Aggregate metric (shift coverage % + gear checkout % + overdue count)
- **Prominent display**: Shift coverage, gear readiness, outstanding checkouts shown above normal dashboard
- **Time-of-day adaptation**: Morning = upcoming today. Evening = overdue + tomorrow prep.
- **Role-specific emphasis**: Students see My Gear first (already true). Staff see readiness score. Admins see system health.

#### 3.8 Unified Search V2 (Size: L)

- Current: Cmd+K searches assets, checkouts, reservations in separate sections
- Target: Single search returning results across all domains with type indicators
- Include: items, checkouts, reservations, users, events, kits
- Backend: Server-side search endpoint returning mixed results (avoid client-side filtering at scale)
- UX: Keyboard-navigable, recent searches, type-ahead, category filters
- Enables "find anything" workflow — critical for staff acting fast during game day

#### 3.9 Automation (Size: L)

- **Auto-generate bookings from recurring events**: Football Home always needs Camera Kit A → auto-create reservation when event syncs
- **Bulk check-in by scan session**: Scan all items → system matches to open bookings → one-tap confirm all returns
- **Scheduled notifications**: "Tomorrow you have MBB at Kohl Center — your gear is reserved" (evening before game day)
- **Shift → checkout auto-linking**: Shift assignment auto-creates checkout reservation for standard kit per area

#### 3.10 Operational Intelligence (Size: L)

- **Usage analytics**: Most-used items, peak checkout times, average duration by sport
- **Equipment health scoring**: Age + usage frequency + maintenance history + damage reports
- **Peak usage prediction**: Historical data → forecast busy periods → suggest pre-staging gear
- **Loss/damage trends**: Which items/categories have highest loss rates
- **Audit log search**: Admin UI for searching/filtering audit entries (currently read-only timeline)

#### 3.11 Deeper Integration (Size: L)

- **Event changes cascade**: Rescheduled event updates all linked bookings' dates (with confirmation dialog)
- **Maintenance scheduling**: Track usage hours, suggest maintenance intervals, auto-flag overdue service
- **Multi-source event ingestion**: Beyond UW Badgers ICS (Phase C from NORTH_STAR.md)
- **Admin-configurable equipment guidance**: Database rules replacing code-defined rules in `equipment-guidance.ts` (D-016 Phase C)
- **Kiosk mode**: Self-serve scan station for game-day operations (Phase C from NORTH_STAR.md)

---

## STEP 4: CROSS-CUTTING FEATURES

| Feature | Current State | V2 Target | V3 Target |
|---|---|---|---|
| **Error handling** | `classifyError()` shared; all pages differentiate network vs server; 401 redirect everywhere | Automatic retry for transient failures on mutations | React Query handles retries automatically |
| **Loading states** | High-fidelity skeletons on all hardened pages; scan + schedule decomposed | Validate all decomposed components have proper skeletons | Streaming/suspense boundaries for progressive loading |
| **Empty states** | shadcn `<Empty>` on all pages; contextual messages on filtered views | Context-aware CTAs ("No MBB checkouts — create one?") on all filtered empty states | Proactive suggestions based on role and current event |
| **Toast notifications** | Sonner on all mutations; success/error patterns established | Standardize messages (success: past tense, error: what + retry); undo on destructive toasts | — |
| **Confirmation dialogs** | AlertDialog on all destructive actions | Batch confirmations ("Cancel 3 selected reservations?") | — |
| **Form validation** | `useFormSubmit` with Zod; applied to Create User dialog | Adopt across checkout/reservation/kit creation, all settings forms | Inline field-level validation with debounced server checks |
| **RBAC enforcement** | `requirePermission()` on all mutations; UI gating; stress-tested | No gaps — maintain coverage on new features | Row-level security if multi-tenant scope expands |
| **Audit logging** | `createAuditEntry()` on all mutations (verified) | No gaps — maintain coverage; add to remaining endpoints (nudge, mark-as-read, avatar) | Audit log search/filter UI for admins |
| **Mobile responsiveness** | All pages validated; 44px+ tap targets; iOS fixes; input zoom prevention | Validate inline dashboard actions work on mobile | PWA with offline read cache |
| **Keyboard accessibility** | Cmd+K palette; tab shortcuts (1-N) on item detail; arrow keys in picker | Audit tab order; keyboard shortcuts on all detail pages | Full shortcut layer (J/K navigation, Enter/Esc) |

---

## STEP 5: DATA & STATE STRATEGY

### Current State

| Layer | Pattern | Used By |
|-------|---------|---------|
| **Server state** | `useFetch()` hook with AbortController + Visibility API refresh | All data-loading pages (fully migrated 2026-03-25) |
| **URL state** | `useUrlState()` hook + `useSearchParams` | Dashboard, reports, items, schedule, notifications, search |
| **Local state** | `useState` for form inputs, modals, loading flags | All pages |
| **Derived state** | `useMemo` for filtered/sorted views | Dashboard (filtered sections), items (derived status), schedule |
| **Persisted local** | `localStorage` for saved filters, view mode, My Shifts toggle | Dashboard, schedule |
| **No shared cache** | Each page re-fetches on mount; no cross-page cache | All pages |

### How Data Flows Across Pages

- **Re-fetch on mount**: Every page fetches fresh data. Dashboard → Checkout Detail → Dashboard = 3 full fetches.
- **URL params for context**: `?sport=MBB`, `?draftId=X`, `?eventId=X`, `?location=Camp+Randall` pass minimal context.
- **Detail sheets**: `BookingDetailsSheet` receives ID, fetches own data. Parent refreshes on close via `onUpdated`.
- **Visibility refresh**: `useFetch` hook includes Page Visibility API — re-fetches when tab becomes active (universally adopted).
- **No WebSocket/SSE**: All data is request-response. No real-time updates across tabs.

### Data Risks

| Risk | Severity | Current Mitigation | Recommendation |
|------|----------|-------------------|----------------|
| **Re-fetch on every navigation** | Medium | No shared cache; `useFetch` Visibility refresh helps tab-switching | V3: React Query with stale-while-revalidate |
| **Stale data across tabs** | Low | Visibility API refresh in `useFetch` (universally adopted) | Adequate for now; V3: React Query |
| **Race conditions on mutations** | Low | SERIALIZABLE transactions + P2034 retry; cancel upgraded to SERIALIZABLE | Adequate |
| **N+1 queries** | Low | Consolidated init endpoints where needed; batch DB ops in sync | Monitor events/schedule pages |
| **Unbounded result sets** | Low | Pagination on all list pages; activity endpoint paginated (cursor-based) | Adequate |
| **Audit log growth** | Medium | No retention policy; no archival | Monitor quarterly; implement archival at 10x scale |
| **Optimistic update inconsistency** | Low | Used for draft delete, checkin; rollback on failure | V3: React Query handles automatically |
| **Dashboard monolithic response** | Low | Single `/api/me` + dashboard endpoint returns everything | V3: Break into section endpoints if performance degrades |

### Recommendations by Version

**Remaining V2** (no new dependencies):
- Adopt `useFormSubmit` across remaining create/edit forms (checkout, reservation, kit creation)
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

### V2 Remaining Dependency Graph

```
Independent (no blockers):
    ├──→ Inline dashboard actions (dashboard already decomposed)
    ├──→ Cross-page state awareness (URL params, scroll preservation)
    ├──→ Smarter defaults & persistence (localStorage patterns)
    ├──→ Student availability tracking (new model + shift gen changes)
    └──→ Shift email notifications (extends Resend infrastructure)
```

All V2 items are independent — no sequential blockers remain. The decomposition and hook adoption prerequisites are complete.

### What Blocks V3 Improvements

| Blocker | What It Blocks | Status |
|---------|---------------|--------|
| V2 hook adoption | React Query migration (need consistent patterns first) | ✅ Complete |
| Dashboard decomposition | Game-Day Mode (needs component-level control) | ✅ Complete |
| Kit-to-booking integration | Automation (kit-based auto-reservations) | ✅ Complete |
| Student availability model | Shift automation (skip unavailable students) | V2 remaining |
| Historical usage data | Equipment health scoring, peak prediction | Needs time to accumulate |

### V3 Dependency Graph

```
React Query migration
    │
    └──→ Game-Day Mode (benefits from cache + background refresh)
              │
              └──→ Scheduled notifications (game-day context awareness)

Unified Search V2
    └──→ Independent (new endpoint + Cmd+K upgrade)

Automation features
    │
    ├──→ Auto-generate bookings (requires event sync + kit integration ✅)
    ├──→ Bulk check-in by scan (requires scan decomposition ✅)
    └──→ Shift-checkout auto-linking (requires shift + kit integration ✅)

Operational Intelligence
    └──→ Independent (new reports endpoints + admin UI)

Deeper Integration
    ├──→ Event cascade (requires event sync foundation ✅)
    ├──→ Maintenance scheduling (requires new schema)
    └──→ Kiosk mode (requires scan foundation ✅)
```

### V2 Quick Wins (Ship Independently)

| Item | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Remember last-used filters (localStorage) | S | Medium — fewer clicks per session | None |
| Auto-select current event in checkout creation | S | Medium — faster checkout for active events | None |
| Recent searches in Cmd+K | S | Low — power user convenience | None |
| Notification deep-links to booking detail | S | Medium — notifications become actionable | None |
| Event context propagation (`?eventId=` URL param) | S | Medium — fewer manual selections | None |
| Shift email notifications | S | Low — trade claim emails | None |

---

## STEP 7: RISKS & COMPLEXITY

### Overengineering Risks

| Idea | Risk Level | Reasoning |
|------|-----------|-----------|
| Predictive gear suggestions (V3) | High | Requires historical data at scale; team is small. Rule-based per sport sufficient. |
| Real-time SSE/WebSocket (V3) | Medium | Only for multi-user concurrent ops (game day). Polling + visibility refresh covers 90%. |
| PWA offline mode (V3) | Medium | Students have reliable campus WiFi. Offline mutations add complexity for rare benefit. |
| Equipment health scoring (V3) | Low | Valuable but requires structured maintenance data that doesn't exist yet. |
| React Query before V2 form adoption | Medium | Forms still use ad-hoc fetch. Migrate to `useFormSubmit` first, then React Query. |

### Tight Coupling Concerns

- **Dashboard ↔ API shape**: Dashboard fetches monolithic data object. New sections require API changes. V3 should break into independent section endpoints if performance degrades.
- **BookingDetailPage ↔ booking-actions.ts**: Action gating tightly coupled to status enum. Status vocabulary (D-025) adds translation layer that must stay in sync.
- **Equipment sections/guidance ↔ code**: D-016 keeps rules in code. Fine for V2 but blocks operator self-service. Phase C should deliver admin-configurable rules.
- **Scan hooks ↔ checkout API**: `useScanSession` and `useScanSubmission` are tightly coupled to checkout scan endpoints. Future "lookup mode" enhancements need separate hooks.

### Scaling Considerations

| Dimension | Current | 2x Users | 10x Inventory |
|-----------|---------|----------|---------------|
| Page load time | Fast (Neon serverless, paginated) | Fine — stateless serverless | Need cursor-based pagination for items list |
| Dashboard query | Single API call, all sections | May need lazy-loaded sections | Need section-level caching |
| Search | Client-side filter in Cmd+K | Fine | Need server-side full-text search (Postgres `tsvector`) |
| Audit log | Unbounded growth | Fine short-term | Need retention policy or archival |
| Notification volume | Daily cron + dedup by booking | Fine | Fine — dedup prevents explosion |
| API route count | 106+ routes | Fine | Fine — no consolidation needed yet |

### Scope Creep Boundaries

The V2/V3 boundary is most likely to blur on:
- **React Query adoption** being requested during remaining V2 work — resist; `useFetch` is adequate, React Query is V3
- **Game-Day Mode** being pulled into V2 because the readiness score seems "simple" — it requires significant dashboard rework and new data aggregation
- **Unified search** expanding into Postgres full-text — client-side is fine for current inventory size; defer `tsvector` until 10x scale
- **Automation** being started before student availability tracking ships — availability data is prerequisite for shift automation

---

## STEP 8: IMPLEMENTATION STRATEGY

### P0 Bug Fixes (Before V2 Features)

These items from `tasks/todo.md` should be addressed first — they represent correctness issues:

| Item | Effort | Impact |
|------|--------|--------|
| Fix reservation 7-day window filter (AC-4) | S | Dashboard shows too many reservations |
| Fix notification icon type mapping | S | Wrong/missing icons in notification center |
| Resolve cron schedule mismatch (daily vs sub-hourly) | S | Product decision needed |
| Add `sourcePayload` to importer (D-014 violation) | M | Data integrity — unmapped columns silently dropped |
| Add client-side auth guard on settings | S | Non-admin users see settings shell + 403 errors |
| Fix BulkSku routing in importer | S | Bulk items created as wrong entity type |

### Recommended V2 Completion Order

| # | Item | Effort | Impact | Notes |
|---|------|--------|--------|-------|
| 1 | **P0 bug fixes** (above) | S-M | Critical | Correctness before features |
| 2 | **`useFormSubmit` adoption** | M | High | Checkout, reservation, kit creation — highest-traffic forms |
| 3 | **Inline dashboard actions** | M | High | Overdue extend/checkin without page navigation |
| 4 | **Cross-page state awareness** | M | Medium | Event context, scroll preservation |
| 5 | **Smarter defaults & persistence** | S | Medium | Remember filters, auto-select events |
| 6 | **Student availability tracking** | M | Medium | Schema + shift gen changes |
| 7 | **Shift email notifications** | S | Low | Extends existing Resend infrastructure |

### Page-Level Hardening Backlog

Several pages still need the 5-pass hardening treatment (from `tasks/todo.md`):

| Page | Effort | Priority |
|------|--------|----------|
| Events list (817 lines — monolith) | M | P0 — largest unhardened page |
| Events detail (475 lines) | M | P0 — hardened 2026-03-25 ✅ |
| Notification center | S | P1 — no loading skeleton, no error recovery |
| BookingListPage (shared checkouts/reservations) | M | P1 — needs full hardening pass |
| Item detail page | M | P1 — missing 5-pass treatment |
| Import page | M | P1 — no progress indicator |
| Settings sub-pages (categories, sports, escalation) | S each | P1 — hardening treatment |

### Parallelization Strategy

**Can run in parallel** (independent):
- P0 bug fixes (different domains, no overlap)
- Items 3, 4, 5 (dashboard actions, state awareness, defaults — touch different files)
- Items 6, 7 (availability, shift email — independent domains)
- Page hardening (each page is independent)

**Should be sequential**:
- Item 2 (`useFormSubmit` adoption) should happen before Item 3 (inline actions may use it)
- P0 bug fixes before new feature work

### V3 Rollout Plan

| Phase | Items | Approach |
|-------|-------|----------|
| **V3-A** | React Query migration | One page at a time: dashboard → items → checkouts → reservations → rest |
| **V3-B** | Unified Search V2 | New server endpoint + Cmd+K upgrade; independent of React Query |
| **V3-C** | Game-Day Mode | Dashboard widget + readiness score API; benefits from React Query cache |
| **V3-D** | Automation | Booking templates, bulk check-in, scheduled notifications; each independent |
| **V3-E** | Operational Intelligence | New report endpoints + admin analytics UI; fully independent |
| **V3-F** | Deeper Integration | Event cascade, maintenance scheduling, kiosk mode; each independent |

### Effort Estimates

| Size | Definition | Example |
|------|-----------|---------|
| **S** | 1-3 hours, 1-3 files | Smart defaults, shift email, notification deep-links |
| **M** | 3-8 hours, 3-8 files | Inline dashboard actions, student availability, page hardening |
| **L** | 1-3 days, 8+ files | React Query migration, unified search V2, game-day mode |

---

## Change Log
- 2026-03-23: Initial system roadmap created. Full architecture analysis, three-version plan.
- 2026-03-24: V2 revision. V1 marked complete. V2 plan detailed with decomposition, hook adoption, inline actions, notification completion.
- 2026-03-26: V3 revision. V2 mostly complete: scan decomposed (1,038→251), schedule decomposed (1,012→117), all pages migrated to shared hooks, kit-to-booking integration shipped, booking pages hardened, overdue priority sort shipped. Updated domain maturity levels (Booking→Polished, Kits→Solid, Scan→Polished, Shifts→Polished). V2 remaining items reduced to 5 (inline actions, state awareness, defaults, student availability, shift email). P0 bug fix queue formalized from todo.md. V3 plan refined with phased rollout (V3-A through V3-F). Page hardening backlog consolidated. New systemic gaps identified (GAP-19 through GAP-23).
