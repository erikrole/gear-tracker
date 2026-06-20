# AREA: Reports & Analytics

## Document Control
- Area: Reports & Analytics
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-06-20
- Status: Active
- Version: V1

## Direction
Provide staff and admin with analytics dashboards to track checkout/reservation activity, utilization patterns, scan success rates, badge awards, and audit events. Reports are read-only views gated to ADMIN/STAFF.

## Core Rules
1. All reports are ADMIN/STAFF only (enforced on routes and endpoints).
2. Reports are tab-based: users navigate between report types via sidebar link to `/reports` which redirects to `/reports/utilization`.
3. Each report has filters (date range, status, location) and metrics cards.
4. Data is cached via React Query with focus refresh.
5. Empty states and error states handled with EmptyState + retry.
6. Report-local CSV exports download only the currently visible report rows and must say that in the action/copy, except Utilization, Checkouts, Overdue, Audit, Scans, and Missing Units where the CSV action exports the full filtered, report-evidence, or row-level inventory result from a bounded server-backed endpoint.

## Routes

### `/reports`
- **Page:** `src/app/(app)/reports/page.tsx`
- **Behavior:** Redirects to `/reports/utilization`

### `/reports/layout.tsx`
- **Layout:** Shared section navigation bar showing all 7 report types:
  - Utilization (default)
  - Checkouts
  - Overdue
  - Scans
  - Missing Units
  - Audit
  - Badges
- **Styling:** Uses the shared `SectionNav` treatment with a quiet translucent shell, 40px+ link targets, and an active underline; responsive on mobile

### `/reports/utilization`
- **Page:** `src/app/(app)/reports/utilization/page.tsx`
- **Type:** Charts + metrics dashboard
- **Metrics:** Total inventory, checked out, available, maintenance, retired
- **Charts:** Utilization trends (equipment category breakdown, location breakdown, time-series checkout rate)
- **Filters:** Date range, location, category
- **Data:** `GET /api/reports/utilization?from=...&to=...&location=...&category=...`
- **Export:** `GET /api/reports/utilization?format=csv` returns up to 5,000 inventory rows with derived status, stored status, physical identity fields, location, department, category, availability flags, `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` headers when capped.

### `/reports/checkouts`
- **Page:** `src/app/(app)/reports/checkouts/page.tsx`
- **Type:** Tabular report with filterable list
- **Columns:** Title, requester, due date, item count, status
- **Metrics:** Total custody checkout activity in the selected period, currently overdue checkouts
- **Charts:** Daily checkout trend, top requesters, 365-day heatmap
- **Filters:** Period (7d, 30d, 90d)
- **Data:** `GET /api/reports/checkouts?days=...`
- **Export:** `GET /api/reports/checkouts?format=csv&days=...` returns up to 5,000 matching custody checkout activity rows with `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` headers when capped.
- **Semantics:** Checkout activity metrics, charts, heatmap, and CSV exports count actual custody rows only: `OPEN` and `COMPLETED` checkouts. `DRAFT`, `PENDING_PICKUP`, and `CANCELLED` checkout rows are excluded so awaiting pickup does not inflate custody analytics.

### `/reports/overdue`
- **Page:** `src/app/(app)/reports/overdue/page.tsx`
- **Type:** List of overdue bookings with escalation status
- **Columns:** Requester, overdue bookings, average overdue time, location, outstanding item summary
- **Metrics:** Total overdue, highest priority escalations, days-overdue distribution
- **Filters:** Date range, location, escalation count
- **Behaviors:** Expand requester row to inspect overdue bookings and deep-link to booking detail.
- **Data:** `GET /api/reports/overdue`
- **Export:** `GET /api/reports/overdue?format=csv` returns up to 5,000 overdue checkout rows with requester, booking, due time, overdue hours, location, outstanding item count, outstanding item summary, `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` headers when capped.
- **Semantics:** Only open checkouts past `endsAt` are overdue. Item summaries count active serialized allocations and outstanding bulk quantities, not already-returned gear.

### `/reports/scans`
- **Page:** `src/app/(app)/reports/scans/page.tsx`
- **Type:** Scan activity analytics
- **Columns:** Timestamp, actor, item, phase, booking, result
- **Metrics:** Total scans in the selected period, success rate
- **Charts:** Daily scan volume by success/fail
- **Filters:** Period (all, 7d, 30d, 90d), phase (all, checkout, check-in)
- **Data:** `GET /api/reports/scans?limit=...&offset=...&startDate=...&endDate=...&phase=...`
- **Export:** `GET /api/reports/scans?format=csv&startDate=...&endDate=...&phase=...` returns up to 5,000 matching rows with `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` headers when capped.
- **Semantics:** API rejects invalid dates, inverted date ranges, and phases outside `CHECKOUT` or `CHECKIN`.

### `/reports/bulk-losses`
- **Page:** `src/app/(app)/reports/bulk-losses/page.tsx`
- **Type:** Missing-unit tracking for quantity-tracked and unit-tracked families
- **Columns:** Item family, category, missing count, date detected, location, battery unit number, last holder, booking handoff
- **Metrics:** Missing units, item families affected, users involved, battery units, missing batteries, missing rate, repeated battery patterns
- **Tables:** Missing units by family, missing units by requester, recent missing-unit events, missing rate by family, missing battery units, recent battery checkout history
- **Signals:** Repeated missing battery patterns by item family and by last known requester
- **Filters:** Date range, category, location
- **Data:** `GET /api/reports/bulk-losses`
- **Export:** `GET /api/reports/bulk-losses?format=csv` returns up to 5,000 report-evidence rows across missing-unit family counts, requester attribution, recent missing-unit events, battery family summaries, missing battery units, battery checkout history, and repeat patterns with `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` headers when capped.

### `/reports/audit`
- **Page:** `src/app/(app)/reports/audit/page.tsx`
- **Type:** Audit log viewer (admin only within ADMIN/STAFF)
- **Columns:** Timestamp, actor, action, resource (item/booking/user), details, outcome
- **Metrics:** Total events (period), events by action type, events by actor role
- **Charts:** Event frequency over time, action breakdown, actor breakdown
- **Filters:** Date range, action type, actor, resource type
- **Data:** `GET /api/reports/audit?from=...&to=...&action=...&actor=...&resourceType=...`
- **Export:** `GET /api/reports/audit?format=csv&startDate=...&endDate=...&action=...` returns up to 5,000 matching rows with `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` headers when capped.

### `/reports/badges`
- **Page:** `src/app/(app)/reports/badges/page.tsx`
- **Type:** Staff analytics for badge recognition, not the primary profile experience
- **Metrics:** Total awards, awards in the past 30 days, active definitions, manual award count/rate
- **Tables:** User leaderboard, badge distribution, underused active definitions, recent manual recognition, recent awards
- **Data:** `GET /api/reports/badges`

## Components

**Shared across reports:**
- `MetricCard` — report-local adapter around `OperationalMetricCard`, preserving report drill-down links, tooltips, badges, and string values while using the shared operational metric primitive
- `ReportExportButton` / report export helpers — shared CSV export actions with duplicate-click guards, formula-safe CSV escaping, dated filenames, server-backed filename/error parsing, and completion copy that names the exported scope
- Charts from `recharts` (line, bar, pie charts as needed per report)
- `Card` + `CardHeader` + `CardContent` for sections
- Filter bar with date range picker, select dropdowns
- Table/skeleton loading states
- EmptyState for no data

**Key files:**
- `src/app/(app)/reports/MetricCard.tsx` — metric display card
- `src/app/(app)/reports/[reportType]/charts.tsx` — recharts components per report
- `src/app/(app)/reports/[reportType]/page.tsx` — report page (data fetching + layout)

## Data Model
- Reports aggregate from existing models: `Booking`, `ScanEvent`, `BulkStockMovement`, `AuditLog`
- No new tables; reports are read-only views via API endpoints that SELECT/aggregate

## Security
- `requirePermission("report", "view")` on all report routes + endpoints
- ADMIN/STAFF only
- Audit log endpoint logs report access (low priority)

## Acceptance Criteria
- [x] AC-1: Utilization report with inventory metrics + trend charts
- [x] AC-2: Checkouts report with list + status breakdown
- [x] AC-3: Overdue report with escalation tracking
- [x] AC-4: Scans report with device + phase analytics
- [x] AC-5: Missing Units report with item-family tracking
- [x] AC-6: Audit report with event log viewer (ADMIN only)
- [x] AC-7: Badge report with leaderboard, distribution, and recent awards
- [x] AC-8: Missing Units report includes unit-tracked battery missing-unit, missing-rate, custody-history, and repeat-pattern reporting

## Change Log
- 2026-06-20: Report toolbars inherit the refreshed shared active-filter chip treatment, keeping Checkouts, Scans, and Audit non-default filters removable while making applied filters read as lighter controls with 40px targets and active underline.
- 2026-06-20: Reports navigation now uses the shared `SectionNav` treatment adopted by Settings. The report switcher keeps mobile horizontal scrolling and active underlines, but drops the heavier bordered card shell so the nav reads as page chrome instead of another content panel.
- 2026-06-18: Schedule Source Of Truth Slice 13 added Schedule CSV exports outside the main Reports shell. `/api/schedule/export?type=...` is still governed by `report.view`, uses shared formula-safe CSV escaping, returns export count/truncation headers, caps date windows to 366 days, and supports roster, hours, open slots, conflicts, trades/open-work requests, and gear-readiness exports from the Schedule page.
- 2026-06-18: Kiosk-only custody Slice 5 tightened Checkouts report semantics. `/reports/checkouts` metrics, top requesters, recent rows, heatmap, and CSV export now count only custody checkout rows (`OPEN` and `COMPLETED`) so `PENDING_PICKUP` awaiting-pickup records and cancelled records do not inflate actual checkout activity.
- 2026-06-02: Web operator trust sweep added Utilization row-level CSV export. `/reports/utilization` now exports bounded server-backed inventory rows with derived status evidence, stored status, location, department, category, and availability flags while keeping JSON metric/card/chart behavior unchanged.
- 2026-06-02: Web operator trust sweep added Missing Units evidence CSV export. `/reports/bulk-losses` now exports bounded server-backed report-evidence rows across missing-unit groupings, requester attribution, recent loss events, battery family summaries, missing battery units, checkout history, and repeat patterns while keeping the JSON report sections and drill-down links unchanged.
- 2026-06-02: Web operator trust sweep tightened Overdue report CSV export semantics. `/reports/overdue` now exports overdue checkout rows through a bounded server-backed CSV path, includes outstanding item summaries that exclude already-returned bulk quantities, reports capped exports with row-count headers/copy, and keeps the JSON leaderboard grouping and expansion behavior unchanged.
- 2026-06-02: Web operator trust sweep tightened Checkouts report CSV export semantics. `/reports/checkouts` exports matching checkout activity rows for the selected period through a bounded server-backed CSV path, reports capped exports with row-count headers/copy, and keeps JSON report metrics/charts/heatmap unchanged.
- 2026-06-02: Web operator trust sweep tightened Scans report CSV export semantics. `/reports/scans` now exports all matching filtered scan events through a bounded server-backed CSV path, reports capped exports with row-count headers/copy, and keeps JSON report pagination/charts unchanged.
- 2026-06-02: Web operator trust sweep tightened Audit report CSV export semantics. `/reports/audit` now exports all matching filtered audit rows through a bounded server-backed CSV path, reports capped exports with row-count headers/copy, and keeps the JSON report browse pagination/charts unchanged.
- 2026-06-02: Web operator trust sweep tightened report CSV exports. Utilization, Checkouts, Overdue, Scans, Audit, and Badges now label exports as visible-row downloads, ignore rapid duplicate export clicks, and show completion copy that names the exact visible row scope without changing report APIs or analytics semantics.
- 2026-05-25: Web bug sweep Batch 49 cleaned up Utilization report status language. Metric cards, status chart labels, and CSV status rows now use shared equipment display labels such as `Awaiting Pickup` instead of raw enum values like `PENDING_PICKUP`, while keeping raw status keys only in drill-down URLs.
- 2026-05-25: Web bug sweep Batch 43 fixed Reports overdue drill-down links. Checkouts and Overdue metric cards now use `/checkouts?filter=overdue`, matching the booking list's special filter contract instead of sending invalid `status=overdue` links into the unified Bookings route.
- 2026-05-25: Web bug sweep Batch 39 hardened Audit report URL state. Audit period and pagination controls now rehydrate from browser Back/Forward or shared links, invalid filter params self-correct, and out-of-range pages clamp after report data loads.
- 2026-05-25: Web bug sweep Batch 38 hardened badge report display copy. Badge Distribution and Underused rows now show only operator-facing badge names, and badge category/source labels render as title-cased product language such as `On Time` and `Manual` instead of raw internal keys or enum strings.
- 2026-05-25: Web bug sweep Batch 23 hardened report URL-state rehydration. Checkouts and Scans now re-read filter and pagination state from the address bar after browser back/forward or external report links, keeping visible controls, active filters, and API query params aligned.
- 2026-05-25: Web bug sweep Batch 22 hardened the shared `useFetch` helper used by reports, Labels, and Fix Today. It now safe-parses JSON responses and rejects unreadable success bodies before report consumers treat malformed gateway responses as valid data.
- 2026-05-24: Web bug sweep Batch 11 moved the Reports layout permission check to the server before the report shell renders, matching the `/api/reports/*` `report.view` guard and redirecting non-staff users instead of showing a skeletonized forbidden reports shell.
- 2026-05-21: Report metric cards now render through the shared `OperationalMetricCard` primitive while preserving report-specific links, tooltips, badges, and string values.
- 2026-05-20: Reports period and phase filter state now uses shared `OperationalActiveFilterChips` through the report toolbar on Checkouts, Scans, and Audit so non-default filters can be removed without changing the segmented control directly.
- 2026-05-13: Missing Units report copy now avoids old lost/numbered wording in the battery audit sections, using Missing and battery families using Units instead.
- 2026-05-13: Battery audit reporting now lives under Missing Units. Staff/admin can see missing unit-tracked batteries by unit, missing rate by family, recent unit checkout history, repeated missing family/requester patterns, and a direct handoff to Battery Ops.
- 2026-05-10: Reports ownership pass. Checkout analytics now exclude draft bookings, overdue reports count only outstanding gear, and scan report filters are normalized in the UI with API-side validation for invalid dates and phases. Browser smoke also fixed the shared React Query provider hydration path so report pages no longer log hydration mismatches after reloads.
- 2026-05-25: Web bug sweep Batch 33 hardened shared current-user reads used by the reports shell and other role-aware navigation surfaces. `/api/me` success bodies now safe-parse through `useCurrentUser`, so an unreadable identity payload falls back through the normal unauthenticated/loading behavior instead of throwing during page render.
- 2026-05-09: Badge report insight polish added manual award rate, underused active definitions, and a recent manual recognition section so staff can see whether the badge catalog is being used consistently.
- 2026-05-09: Badge report shipped. `/reports/badges` now gives staff/admin read-only analytics for total awards, 30-day award volume, active definitions, manual awards, user leaderboard, badge distribution, and recent awards while keeping `/users/{id}?tab=badges` as the primary profile badge surface.
- 2026-05-09: Reports authenticated browser smoke completed. Chrome DevTools verified seeded-admin rendering for Utilization, Checkouts, Overdue, Missing Units, Scans, and Audit; the pass also fixed a Recharts responsive sizing warning centrally in the shared shadcn chart wrapper.
- 2026-05-09: Focused Reports UI polish slice. Added shared report UI helpers for toolbar rhythm, metric grids, section cards, and loading skeletons; upgraded the Reports header/tab shell; and migrated Utilization, Checkouts, Overdue, Missing Units, Scans, and Audit to the shared presentation patterns without changing report APIs or analytics semantics.
- 2026-05-09: Reports chart polish follow-up. Moved report chart components onto the shared report chart-card wrapper, centralized the chart palette, tightened chart legends and numeric alignment, and fixed utilization breakdown sorting so charts no longer mutate incoming data arrays.
- 2026-05-09: Reports filter polish follow-up. Checkouts, Scans, and Audit period/phase controls now use the shared Reports segmented-control helper backed by shadcn ToggleGroup, preserving URL sync and pagination reset behavior while removing hand-rolled button groups.
- 2026-05-09: Reports state polish follow-up. Added shared report error, empty, and pagination helpers; normalized retry layout across report pages; improved empty-state copy; and kept Scans/Audit pagination query behavior unchanged.
- 2026-05-09: Reports row polish follow-up. Added shared report row/link helpers, normalized dense table/mobile row hover and focus treatment, and replaced Overdue text disclosure arrows with lucide chevrons while preserving expansion behavior.
- 2026-05-09: Reports export polish follow-up. Added an icon-backed shared report export button and centralized CSV escaping/download behavior for Utilization, Checkouts, Overdue, Scans, and Audit exports.
- 2026-05-09: Reports loading cleanup follow-up. Added a shared chart-loading helper, migrated Utilization and Checkouts dynamic chart fallbacks to it, and finished the remaining Checkouts mobile requester row adoption.
- 2026-05-09: Reports overdue presentation follow-up. Reused the shared report table-link treatment inside expanded Overdue mobile rows and replaced the remaining inline red text styles with report-compatible utility classes while preserving expansion/navigation behavior.
- 2026-05-09: Reports metadata line follow-up. Added a shared compact metadata-line helper and migrated Checkouts and expanded Overdue row details away from raw separator strings while preserving displayed content.
- 2026-05-08: API hardening Wave 13. Audit and scan reports now use shared pagination parsing, dashboard stats polling has a mobile-friendly rate limit, and audit last-lookups are rate-limited by actor.
- 2026-05-08: API hardening Wave 11. Checkout reports now reject lookbacks outside 1-366 days before aggregation, and booking audit-log pagination validates cursors against the requested booking before returning another page.
- 2026-05-07: iOS Overdue report. First report ported to iOS as a stripped-down floor view: leaderboard sorted by total overdue time, expandable per-person, tap-through to booking detail. Chart + CSV deliberately omitted — those stay on web (per "iOS = day-to-day ops, web = power user" rule). Server enforces `report:view` = ADMIN/STAFF; client also gates Profile entry point. See `AREA_MOBILE.md` for context.
- 2026-03-15: Reports V1 shipped — 6 report pages (utilization, checkouts, overdue, scans, bulk-losses, audit). Tab navigation. Metrics cards. Charts (recharts). Filters. Table lists. Date range pickers. Empty states + error handling.
- 2026-04-09: Design refresh (Phase 3) — Linear/Notion refresh applied: one-off error div → Alert component, inline styles → Tailwind, legacy CSS removed. Text-secondary → text-muted-foreground. Doc sync.
- 2026-04-09: Created AREA_REPORTS.md as formal feature area documentation.
- 2026-05-01: Audit pass — split `/api/reports?type=X` mega-route into per-type routes under `/api/reports/{utilization,checkouts,overdue,scans,audit,bulk-losses}`; moved handlers to `src/lib/services/reports.ts`. Replaced in-memory daily aggregation with `date_trunc` `$queryRaw` GROUP BY in scan + checkout reports (no more pulling every row to bucket in JS). Removed dead heatmap block from utilization page (API never returned the field). Standardized `bulk-losses` loading/error guards to match siblings (preserves data on refresh). Extracted shared `syncUrl()` to `src/lib/url-sync.ts`; checkouts page now uses it.
